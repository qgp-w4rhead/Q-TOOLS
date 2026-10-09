/**
 * useAudioMerger - composable + pure logic for the audio merger tool.
 *
 * Concatenates multiple audio files into a single track entirely in the
 * browser via ffmpeg.wasm (lazy-loaded). Uses the concat demuxer with a
 * generated `list.txt`; inputs are re-encoded to the chosen output format
 * so mixed codecs/containers merge cleanly.
 *
 * Pure helpers (`MERGE_FORMATS`, `buildMergeArgs`, `buildConcatList`) have
 * no Vue dependency. The composable wires up the embed PostMessage
 * protocol:
 *  - input  → `{ urls: string[], format, bitrate, action }`
 *  - output → `{ status, progress, count, outputName, outputSize, outputMime, error }`
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  blobToBytes,
  deleteQuiet,
  getFFmpeg,
  readOutput,
  runFfmpeg,
} from '@/utils/ffmpeg';
import {
  detectMediaKind,
  downloadBytes,
  escapeConcatPath,
  formatBytes,
  mimeForExtension,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

export type MergeFormat = 'mp3' | 'wav' | 'ogg' | 'm4a' | 'flac';

export const MERGE_FORMATS: readonly { id: MergeFormat; label: string; lossless: boolean }[] = [
  { id: 'mp3', label: 'MP3', lossless: false },
  { id: 'm4a', label: 'M4A (AAC)', lossless: false },
  { id: 'ogg', label: 'OGG Vorbis', lossless: false },
  { id: 'flac', label: 'FLAC', lossless: true },
  { id: 'wav', label: 'WAV', lossless: true },
] as const;

export const AUDIO_BITRATES = [96, 128, 160, 192, 256, 320] as const;
export const DEFAULT_BITRATE = 192;
export const DEFAULT_FORMAT: MergeFormat = 'mp3';

/** Max files + per-file size (ffmpeg.wasm keeps everything in memory). */
export const MAX_FILES = 20;
export const MAX_FILE_SIZE = 256 * 1024 * 1024;

/** Build the concat-demuxer list file contents. */
export function buildConcatList(fsNames: string[]): string {
  return fsNames.map((n) => `file '${escapeConcatPath(n)}'`).join('\n') + '\n';
}

/** Build the ffmpeg argument list for a merge. */
export function buildMergeArgs(
  listName: string,
  outputFile: string,
  format: MergeFormat,
  bitrateKbps: number,
): string[] {
  const args = [
    '-f', 'concat',
    '-safe', '0',
    '-i', listName,
    '-vn', '-sn', '-dn',
  ];
  const br = `${Math.round(bitrateKbps)}k`;
  switch (format) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame', '-b:a', br);
      break;
    case 'm4a':
      args.push('-c:a', 'aac', '-b:a', br, '-movflags', '+faststart');
      break;
    case 'ogg':
      args.push('-c:a', 'libvorbis', '-b:a', br);
      break;
    case 'flac':
      args.push('-c:a', 'flac');
      break;
    case 'wav':
      args.push('-c:a', 'pcm_s16le');
      break;
  }
  args.push(outputFile);
  return args;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export type ConvertStatus =
  | 'idle'
  | 'loading-engine'
  | 'processing'
  | 'done'
  | 'error';

export interface MergeItem {
  id: number;
  name: string;
  size: number;
  file: File;
}

export interface ConvertResult {
  bytes: Uint8Array;
  url: string;
  name: string;
  size: number;
  mime: string;
}

export interface UseAudioMergerReturn {
  items: Ref<MergeItem[]>;
  format: Ref<MergeFormat>;
  bitrate: Ref<number>;
  status: Ref<ConvertStatus>;
  progress: Ref<number>;
  error: Ref<string>;
  result: Ref<ConvertResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  addFiles: (files: File[]) => void;
  removeItem: (id: number) => void;
  moveItem: (id: number, dir: -1 | 1) => void;
  merge: () => Promise<void>;
  download: () => void;
  clear: () => void;
}

let nextId = 1;

export function useAudioMerger(): UseAudioMergerReturn {
  const items = ref<MergeItem[]>([]);
  const format = ref<MergeFormat>(DEFAULT_FORMAT);
  const bitrate = ref<number>(DEFAULT_BITRATE);
  const status = ref<ConvertStatus>('idle');
  const progress = ref<number>(0);
  const error = ref<string>('');
  const result = ref<ConvertResult | null>(null);

  function revokeResult(): void {
    if (result.value) {
      URL.revokeObjectURL(result.value.url);
      result.value = null;
    }
  }

  function addFiles(files: File[]): void {
    error.value = '';
    for (const f of files) {
      if (items.value.length >= MAX_FILES) {
        error.value = `Maximum ${MAX_FILES} files.`;
        break;
      }
      const kind = detectMediaKind(f.name, f.type);
      if (kind === 'video' || kind === 'image') {
        error.value = `"${f.name}" looks like a video/image file - skipped.`;
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        error.value = `"${f.name}" is too large (max ${formatBytes(MAX_FILE_SIZE)}) - skipped.`;
        continue;
      }
      items.value.push({
        id: nextId++,
        name: f.name || `track-${items.value.length + 1}`,
        size: f.size,
        file: f,
      });
    }
    if (items.value.length > 0) {
      revokeResult();
      status.value = 'idle';
      progress.value = 0;
    }
  }

  function removeItem(id: number): void {
    items.value = items.value.filter((i) => i.id !== id);
  }

  function moveItem(id: number, dir: -1 | 1): void {
    const idx = items.value.findIndex((i) => i.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= items.value.length) return;
    const copy = [...items.value];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item!);
    items.value = copy;
  }

  async function merge(): Promise<void> {
    if (items.value.length < 2) {
      error.value = 'Add at least two audio files to merge.';
      return;
    }
    error.value = '';
    revokeResult();
    progress.value = 0;
    const fsNames: string[] = [];
    try {
      status.value = 'loading-engine';
      const ffmpeg = await getFFmpeg();
      status.value = 'processing';

      // Write every input into the ffmpeg FS with index-prefixed names.
      for (let i = 0; i < items.value.length; i++) {
        const item = items.value[i]!;
        const fsName = `in${i}-${safeFsName(item.name, 'audio')}`;
        await ffmpeg.writeFile(fsName, await blobToBytes(item.file));
        fsNames.push(fsName);
      }
      const listName = 'concat-list.txt';
      const outName = `output.${format.value}`;
      await ffmpeg.writeFile(listName, buildConcatList(fsNames));
      try {
        const args = buildMergeArgs(listName, outName, format.value, bitrate.value);
        const run = await runFfmpeg(ffmpeg, args, {
          onProgress: (r) => {
            progress.value = r;
          },
        });
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
        const mime = mimeForExtension(format.value);
        result.value = {
          bytes: out,
          url: URL.createObjectURL(new Blob([out], { type: mime })),
          name: `merged-${items.value.length}-tracks.${format.value}`,
          size: out.byteLength,
          mime,
        };
        status.value = 'done';
        progress.value = 1;
      } finally {
        await deleteQuiet(ffmpeg, listName);
        for (const n of fsNames) await deleteQuiet(ffmpeg, n);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Merge failed.';
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
    items.value = [];
    status.value = 'idle';
    progress.value = 0;
    error.value = '';
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (
        typeof p.format === 'string' &&
        MERGE_FORMATS.some((f) => f.id === p.format)
      ) {
        format.value = p.format as MergeFormat;
      }
      if (typeof p.bitrate === 'number' && p.bitrate > 0) {
        bitrate.value = Math.round(p.bitrate);
      }
      const urls = Array.isArray(p.urls)
        ? p.urls.filter((u): u is string => typeof u === 'string')
        : typeof p.url === 'string'
          ? [p.url]
          : [];
      if (urls.length > 0) {
        void (async () => {
          for (const url of urls) {
            try {
              const res = await fetch(url);
              if (!res.ok) {
                error.value = `Failed to fetch ${url} (${res.status}).`;
                continue;
              }
              const blob = await res.blob();
              const name = url.split('/').pop() || 'audio';
              addFiles([new File([blob], name, { type: blob.type })]);
            } catch (e) {
              error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
            }
          }
          if (p.action === 'merge' || p.autoRun === true) await merge();
        })();
      }
      if (p.action === 'merge') void merge();
      if (p.action === 'clear') clear();
    },
  });

  watch(
    [status, progress, items, result, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        status: status.value,
        progress: progress.value,
        count: items.value.length,
        outputName: result.value?.name ?? '',
        outputSize: result.value?.size ?? 0,
        outputMime: result.value?.mime ?? '',
        error: error.value || undefined,
      });
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    revokeResult();
  });

  return {
    items,
    format,
    bitrate,
    status,
    progress,
    error,
    result,
    isEmbed,
    embedInput,
    addFiles,
    removeItem,
    moveItem,
    merge,
    download,
    clear,
  };
}
