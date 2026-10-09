/**
 * useAudioMetadataEditor - composable + pure logic for the audio metadata
 * editor tool.
 *
 * Views and edits ID3 / Vorbis / MP4 tags (title, artist, album, album
 * artist, date, track, genre, comment) plus cover art, entirely in the
 * browser via ffmpeg.wasm (lazy-loaded):
 *  - Read: `ffprobe -show_format -show_streams` JSON → `format.tags` +
 *    attached-pic video stream for cover art.
 *  - Write: `-c copy -metadata key=value` (lossless remux, no re-encode).
 *  - Cover: extracted via `-map 0:v -c copy`; replaced by muxing the image
 *    as an attached-pic stream (mp3/flac/ogg) or `-disposition:v
 *    attached_pic`.
 *
 * Pure helpers (`TAG_FIELDS`, `buildTagWriteArgs`, `tagsFromProbe`) have
 * no Vue dependency. The composable wires up the embed PostMessage
 * protocol:
 *  - input  → `{ url, tags: {...}, action }`
 *  - output → `{ status, fileName, tags, hasCover, outputName, outputSize, error }`
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  blobToBytes,
  deleteQuiet,
  getFFmpeg,
  probeJson,
  readOutput,
  runFfmpeg,
} from '@/utils/ffmpeg';
import {
  detectMediaKind,
  downloadBytes,
  fileExtension,
  formatBytes,
  mimeForExtension,
  outputName,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Editable tag fields shown in the UI (ffmpeg `-metadata` keys). */
export const TAG_FIELDS: readonly { key: string; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'album', label: 'Album' },
  { key: 'album_artist', label: 'Album artist' },
  { key: 'date', label: 'Date / year' },
  { key: 'track', label: 'Track #' },
  { key: 'genre', label: 'Genre' },
  { key: 'comment', label: 'Comment' },
] as const;

export type TagMap = Record<string, string>;

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 256 * 1024 * 1024;

/** ffprobe JSON shape (subset). */
export interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  disposition?: { attached_pic?: number };
}
export interface FfprobeResult {
  format?: { tags?: Record<string, string> };
  streams?: FfprobeStream[];
}

/**
 * Normalise ffprobe `format.tags` into a lowercase-keyed TagMap. Tag keys
 * differ per container (TITLE vs title vs TIT2 mapped by the demuxer) so
 * everything is lowercased for consistent lookup.
 */
export function tagsFromProbe(probe: FfprobeResult | null): TagMap {
  const out: TagMap = {};
  const tags = probe?.format?.tags;
  if (!tags) return out;
  for (const [k, v] of Object.entries(tags)) {
    out[k.toLowerCase()] = String(v);
  }
  return out;
}

/** `true` when the probe shows an attached-picture (cover art) stream. */
export function hasCoverStream(probe: FfprobeResult | null): boolean {
  return (
    probe?.streams?.some(
      (s) => s.codec_type === 'video' && (s.disposition?.attached_pic ?? 0) === 1,
    ) ?? false
  );
}

/** Build ffmpeg args to write tags (stream copy, no re-encode). */
export function buildTagWriteArgs(
  inputName: string,
  outputFile: string,
  tags: TagMap,
  opts: { stripCover?: boolean } = {},
): string[] {
  const args = ['-i', inputName];
  if (opts.stripCover) {
    // Drop attached-pic video streams.
    args.push('-map', '0:a');
  }
  args.push('-c', 'copy');
  // Clear all existing tags first, then write the provided set.
  args.push('-map_metadata', '-1');
  for (const [k, v] of Object.entries(tags)) {
    if (v.trim() !== '') args.push('-metadata', `${k}=${v.trim()}`);
  }
  args.push(outputFile);
  return args;
}

/**
 * Build ffmpeg args to write tags AND replace cover art.
 * The image is muxed as a second input mapped to an attached-pic stream.
 */
export function buildTagCoverArgs(
  inputName: string,
  coverName: string,
  outputFile: string,
  tags: TagMap,
): string[] {
  return [
    '-i', inputName,
    '-i', coverName,
    '-map', '0:a',
    '-map', '1:v',
    '-c:a', 'copy',
    '-c:v', 'copy',
    '-disposition:v', 'attached_pic',
    '-map_metadata', '-1',
    ...Object.entries(tags)
      .filter(([, v]) => v.trim() !== '')
      .flatMap(([k, v]) => ['-metadata', `${k}=${v.trim()}`]),
    '-id3v2_version', '3',
    outputFile,
  ];
}

/** Build ffmpeg args to extract the cover art stream to an image file. */
export function buildCoverExtractArgs(inputName: string, outName: string): string[] {
  return ['-i', inputName, '-map', '0:v', '-c', 'copy', outName];
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export type EditorStatus =
  | 'idle'
  | 'loading-engine'
  | 'reading'
  | 'writing'
  | 'done'
  | 'error';

export interface PickedFile {
  name: string;
  size: number;
  mimeType: string;
}

export interface WriteResult {
  bytes: Uint8Array;
  url: string;
  name: string;
  size: number;
  mime: string;
}

export interface UseAudioMetadataEditorReturn {
  file: Ref<PickedFile | null>;
  tags: Ref<TagMap>;
  /** Extra tags present in the file but not in TAG_FIELDS. */
  extraTags: Ref<TagMap>;
  hasCover: Ref<boolean>;
  coverUrl: Ref<string | null>;
  status: Ref<EditorStatus>;
  error: Ref<string>;
  result: Ref<WriteResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => Promise<void>;
  setCover: (file: File) => void;
  removeCover: () => void;
  save: () => Promise<void>;
  download: () => void;
  clear: () => void;
}

export function useAudioMetadataEditor(): UseAudioMetadataEditorReturn {
  const file = ref<PickedFile | null>(null);
  const tags = ref<TagMap>({});
  const extraTags = ref<TagMap>({});
  const hasCover = ref<boolean>(false);
  const coverUrl = ref<string | null>(null);
  const status = ref<EditorStatus>('idle');
  const error = ref<string>('');
  const result = ref<WriteResult | null>(null);

  let inputBytes: Uint8Array | null = null;
  let pendingFile: File | null = null;
  /** Replacement cover image (null = keep, 'remove' sentinel via flag). */
  let newCover: File | null = null;
  let coverRemoved = false;

  function revokeResult(): void {
    if (result.value) {
      URL.revokeObjectURL(result.value.url);
      result.value = null;
    }
  }

  function revokeCover(): void {
    if (coverUrl.value) {
      URL.revokeObjectURL(coverUrl.value);
      coverUrl.value = null;
    }
  }

  async function onFile(f: File): Promise<void> {
    error.value = '';
    const kind = detectMediaKind(f.name, f.type);
    if (kind === 'video' || kind === 'image') {
      error.value = 'That looks like a video/image file - pick an audio file.';
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      error.value = `File is too large (max ${formatBytes(MAX_FILE_SIZE)}).`;
      return;
    }
    revokeResult();
    revokeCover();
    inputBytes = null;
    newCover = null;
    coverRemoved = false;
    pendingFile = f;
    tags.value = {};
    extraTags.value = {};
    hasCover.value = false;
    file.value = { name: f.name || 'audio', size: f.size, mimeType: f.type || '' };
    status.value = 'idle';

    // Read tags + cover via ffprobe/ffmpeg.
    try {
      status.value = 'loading-engine';
      const ffmpeg = await getFFmpeg();
      status.value = 'reading';
      inputBytes = await blobToBytes(f);
      const inName = safeFsName(file.value.name, 'input.audio');
      await ffmpeg.writeFile(inName, inputBytes);
      try {
        const probe = await probeJson<FfprobeResult>(ffmpeg, inName, [
          '-show_format',
          '-show_streams',
        ]);
        const all = tagsFromProbe(probe);
        const known = new Set(TAG_FIELDS.map((t) => t.key));
        const main: TagMap = {};
        const extra: TagMap = {};
        for (const [k, v] of Object.entries(all)) {
          if (known.has(k)) main[k] = v;
          else extra[k] = v;
        }
        tags.value = main;
        extraTags.value = extra;
        hasCover.value = hasCoverStream(probe);

        if (hasCover.value) {
          // Extract the attached pic to show a preview.
          const outName = 'cover.bin';
          const run = await runFfmpeg(
            ffmpeg,
            buildCoverExtractArgs(inName, outName),
          );
          if (run.exitCode === 0) {
            const bytes = await readOutput(ffmpeg, outName);
            if (bytes && bytes.byteLength > 0) {
              const mime =
                bytes[0] === 0xff && bytes[1] === 0xd8
                  ? 'image/jpeg'
                  : bytes[0] === 0x89 && bytes[1] === 0x50
                    ? 'image/png'
                    : 'image/jpeg';
              coverUrl.value = URL.createObjectURL(
                new Blob([bytes], { type: mime }),
              );
            }
          }
        }
      } finally {
        await deleteQuiet(ffmpeg, inName);
      }
      status.value = 'idle';
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'Could not read tags from this file.';
      status.value = 'error';
    }
  }

  function setCover(f: File): void {
    if (!f.type.startsWith('image/')) {
      error.value = 'Cover art must be an image file.';
      return;
    }
    newCover = f;
    coverRemoved = false;
    revokeCover();
    coverUrl.value = URL.createObjectURL(f);
    hasCover.value = true;
  }

  function removeCover(): void {
    newCover = null;
    coverRemoved = true;
    revokeCover();
    hasCover.value = false;
  }

  async function save(): Promise<void> {
    if (!pendingFile || !file.value) {
      error.value = 'Pick an audio file first.';
      return;
    }
    error.value = '';
    revokeResult();
    try {
      status.value = 'loading-engine';
      const ffmpeg = await getFFmpeg();
      status.value = 'writing';

      if (!inputBytes) inputBytes = await blobToBytes(pendingFile);
      const inName = safeFsName(file.value.name, 'input.audio');
      const ext = fileExtension(file.value.name) || 'mp3';
      const outName = `output.${ext}`;
      await ffmpeg.writeFile(inName, inputBytes);
      const coverName = 'new-cover.img';
      try {
        let args: string[];
        if (newCover) {
          await ffmpeg.writeFile(coverName, await blobToBytes(newCover));
          args = buildTagCoverArgs(inName, coverName, outName, tags.value);
        } else {
          args = buildTagWriteArgs(inName, outName, tags.value, {
            stripCover: coverRemoved,
          });
        }
        const run = await runFfmpeg(ffmpeg, args);
        if (run.exitCode !== 0) {
          const tail = run.logs.slice(-6).map((l) => l.message).join('\n');
          throw new Error(
            `ffmpeg failed (exit ${run.exitCode}).${tail ? `\n${tail}` : ''}`,
          );
        }
        const out = await readOutput(ffmpeg, outName);
        if (!out || out.byteLength === 0) {
          throw new Error('ffmpeg produced no output.');
        }
        const mime = mimeForExtension(ext);
        result.value = {
          bytes: out,
          url: URL.createObjectURL(new Blob([out], { type: mime })),
          name: outputName(file.value.name, ext, '-tagged'),
          size: out.byteLength,
          mime,
        };
        status.value = 'done';
      } finally {
        await deleteQuiet(ffmpeg, inName);
        await deleteQuiet(ffmpeg, coverName);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to write tags.';
      status.value = 'error';
    }
  }

  function download(): void {
    const r = result.value;
    if (!r) return;
    downloadBytes(r.bytes, r.name, r.mime);
  }

  function clear(): void {
    revokeResult();
    revokeCover();
    inputBytes = null;
    pendingFile = null;
    newCover = null;
    coverRemoved = false;
    file.value = null;
    tags.value = {};
    extraTags.value = {};
    hasCover.value = false;
    status.value = 'idle';
    error.value = '';
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.tags && typeof p.tags === 'object') {
        for (const [k, v] of Object.entries(p.tags as Record<string, unknown>)) {
          if (typeof v === 'string') tags.value = { ...tags.value, [k]: v };
        }
      }
      if (typeof p.url === 'string' && p.url.length > 0) {
        void (async () => {
          try {
            const res = await fetch(p.url as string);
            if (!res.ok) {
              error.value = `Failed to fetch URL (${res.status}).`;
              return;
            }
            const blob = await res.blob();
            const name =
              typeof p.fileName === 'string' && p.fileName
                ? p.fileName
                : (p.url as string).split('/').pop() || 'audio';
            await onFile(new File([blob], name, { type: blob.type }));
            if (p.action === 'save' || p.autoRun === true) await save();
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
          }
        })();
      }
      if (p.action === 'save') void save();
      if (p.action === 'clear') clear();
    },
  });

  watch(
    [status, file, tags, hasCover, result, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        status: status.value,
        fileName: file.value?.name ?? '',
        tags: { ...tags.value, ...extraTags.value },
        hasCover: hasCover.value,
        outputName: result.value?.name ?? '',
        outputSize: result.value?.size ?? 0,
        error: error.value || undefined,
      });
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    revokeResult();
    revokeCover();
  });

  return {
    file,
    tags,
    extraTags,
    hasCover,
    coverUrl,
    status,
    error,
    result,
    isEmbed,
    embedInput,
    onFile,
    setCover,
    removeCover,
    save,
    download,
    clear,
  };
}
