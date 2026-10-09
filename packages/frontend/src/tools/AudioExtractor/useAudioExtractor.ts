/**
 * useAudioExtractor - composable + pure logic for the audio extractor tool.
 *
 * Extracts the audio track from a video file entirely in the browser via
 * ffmpeg.wasm (lazy-loaded). When the source audio codec already matches
 * the requested container the stream is copied without re-encoding
 * (`-c:a copy` - instant, lossless); otherwise it is transcoded.
 *
 * Pure helpers (`EXTRACT_FORMATS`, `codecCanCopy`, `buildExtractArgs`)
 * have no Vue dependency. The composable wires up the embed PostMessage
 * protocol:
 *  - input  → `{ url, format, bitrate }`
 *  - output → `{ status, progress, fileName, outputName, outputSize, outputMime, error }`
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
  formatBytes,
  mimeForExtension,
  outputName,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

export type ExtractFormat = 'mp3' | 'm4a' | 'aac' | 'ogg' | 'wav' | 'flac';

export interface ExtractFormatDef {
  id: ExtractFormat;
  label: string;
  /** Source codec names (ffprobe `codec_name`) that can be stream-copied. */
  copyCodecs: readonly string[];
  lossless: boolean;
}

export const EXTRACT_FORMATS: readonly ExtractFormatDef[] = [
  { id: 'mp3', label: 'MP3', copyCodecs: ['mp3'], lossless: false },
  { id: 'm4a', label: 'M4A (AAC)', copyCodecs: ['aac'], lossless: false },
  { id: 'aac', label: 'AAC', copyCodecs: ['aac'], lossless: false },
  { id: 'ogg', label: 'OGG Vorbis', copyCodecs: ['vorbis', 'opus'], lossless: false },
  { id: 'flac', label: 'FLAC', copyCodecs: ['flac'], lossless: true },
  { id: 'wav', label: 'WAV', copyCodecs: ['pcm_s16le', 'pcm_s24le', 'pcm_u8'], lossless: true },
] as const;

export const AUDIO_BITRATES = [96, 128, 160, 192, 256, 320] as const;
export const DEFAULT_BITRATE = 192;
export const DEFAULT_FORMAT: ExtractFormat = 'mp3';

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 512 * 1024 * 1024;

/** `true` when the source codec can be stream-copied into `format`. */
export function codecCanCopy(sourceCodec: string, format: ExtractFormat): boolean {
  const def = EXTRACT_FORMATS.find((f) => f.id === format);
  return def ? def.copyCodecs.includes(sourceCodec) : false;
}

/** ffprobe JSON shape (subset) used to find the audio codec. */
export interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
}
export interface FfprobeResult {
  streams?: FfprobeStream[];
}

/** Extract the first audio stream's codec name from ffprobe JSON. */
export function firstAudioCodec(probe: FfprobeResult | null): string | null {
  const s = probe?.streams?.find((st) => st.codec_type === 'audio');
  return s?.codec_name ?? null;
}

/** Build the ffmpeg argument list for extraction. */
export function buildExtractArgs(
  inputName: string,
  outputFile: string,
  format: ExtractFormat,
  bitrateKbps: number,
  streamCopy: boolean,
): string[] {
  const args = ['-i', inputName, '-vn', '-sn', '-dn'];
  if (streamCopy) {
    args.push('-c:a', 'copy');
  } else {
    const br = `${Math.round(bitrateKbps)}k`;
    switch (format) {
      case 'mp3':
        args.push('-c:a', 'libmp3lame', '-b:a', br);
        break;
      case 'm4a':
      case 'aac':
        args.push('-c:a', 'aac', '-b:a', br);
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

export interface PickedFile {
  name: string;
  size: number;
  mimeType: string;
}

export interface ConvertResult {
  bytes: Uint8Array;
  url: string;
  name: string;
  size: number;
  mime: string;
  /** `true` when the audio stream was copied without re-encoding. */
  copied: boolean;
}

export interface UseAudioExtractorReturn {
  file: Ref<PickedFile | null>;
  format: Ref<ExtractFormat>;
  bitrate: Ref<number>;
  status: Ref<ConvertStatus>;
  progress: Ref<number>;
  error: Ref<string>;
  result: Ref<ConvertResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => void;
  extract: () => Promise<void>;
  download: () => void;
  clear: () => void;
}

export function useAudioExtractor(): UseAudioExtractorReturn {
  const file = ref<PickedFile | null>(null);
  const format = ref<ExtractFormat>(DEFAULT_FORMAT);
  const bitrate = ref<number>(DEFAULT_BITRATE);
  const status = ref<ConvertStatus>('idle');
  const progress = ref<number>(0);
  const error = ref<string>('');
  const result = ref<ConvertResult | null>(null);

  let inputBytes: Uint8Array | null = null;
  let pendingFile: File | null = null;

  function revokeResult(): void {
    if (result.value) {
      URL.revokeObjectURL(result.value.url);
      result.value = null;
    }
  }

  function onFile(f: File): void {
    error.value = '';
    const kind = detectMediaKind(f.name, f.type);
    if (kind === 'image') {
      error.value = 'That looks like an image - pick a video (or audio) file.';
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      error.value = `File is too large (max ${formatBytes(MAX_FILE_SIZE)}).`;
      return;
    }
    revokeResult();
    inputBytes = null;
    pendingFile = f;
    file.value = { name: f.name || 'video', size: f.size, mimeType: f.type || '' };
    status.value = 'idle';
    progress.value = 0;
  }

  async function extract(): Promise<void> {
    if (!pendingFile || !file.value) {
      error.value = 'Pick a video file first.';
      return;
    }
    error.value = '';
    revokeResult();
    progress.value = 0;
    try {
      status.value = 'loading-engine';
      const ffmpeg = await getFFmpeg();
      status.value = 'processing';

      if (!inputBytes) inputBytes = await blobToBytes(pendingFile);
      const inName = safeFsName(file.value.name, 'input.video');
      const outName = `output.${format.value}`;
      await ffmpeg.writeFile(inName, inputBytes);
      try {
        // Probe for the audio codec so we can stream-copy when possible.
        const probe = await probeJson<FfprobeResult>(ffmpeg, inName, [
          '-show_streams',
        ]);
        const codec = firstAudioCodec(probe);
        if (!codec) {
          throw new Error('No audio stream found in this file.');
        }
        const canCopy = codecCanCopy(codec, format.value);
        const args = buildExtractArgs(
          inName,
          outName,
          format.value,
          bitrate.value,
          canCopy,
        );
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
          name: outputName(file.value.name, format.value, '-audio'),
          size: out.byteLength,
          mime,
          copied: canCopy,
        };
        status.value = 'done';
        progress.value = 1;
      } finally {
        await deleteQuiet(ffmpeg, inName);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Extraction failed.';
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
    inputBytes = null;
    pendingFile = null;
    file.value = null;
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
        EXTRACT_FORMATS.some((f) => f.id === p.format)
      ) {
        format.value = p.format as ExtractFormat;
      }
      if (typeof p.bitrate === 'number' && p.bitrate > 0) {
        bitrate.value = Math.round(p.bitrate);
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
                : (p.url as string).split('/').pop() || 'video';
            onFile(new File([blob], name, { type: blob.type }));
            if (p.action === 'extract' || p.action === 'convert' || p.autoRun === true) {
              await extract();
            }
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
          }
        })();
      }
      if (p.action === 'extract' || p.action === 'convert') void extract();
      if (p.action === 'clear') clear();
    },
  });

  watch(
    [status, progress, file, result, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        status: status.value,
        progress: progress.value,
        fileName: file.value?.name ?? '',
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
    file,
    format,
    bitrate,
    status,
    progress,
    error,
    result,
    isEmbed,
    embedInput,
    onFile,
    extract,
    download,
    clear,
  };
}
