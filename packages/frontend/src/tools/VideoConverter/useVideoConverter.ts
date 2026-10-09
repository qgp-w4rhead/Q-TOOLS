/**
 * useVideoConverter - composable + pure logic for the video converter tool.
 *
 * Converts video files between MP4 / WebM / MOV / AVI / MKV entirely in the
 * browser via ffmpeg.wasm (lazy-loaded). Codec choices per container:
 *  - mp4/mov/mkv → libx264 + AAC
 *  - webm        → libvpx-vp9 + libopus
 *  - avi         → mpeg4 + libmp3lame (widest player compatibility)
 *
 * Pure helpers (`VIDEO_FORMATS`, `buildVideoConvertArgs`, `crfToQscale`)
 * have no Vue dependency. The composable wraps conversion in reactive state
 * and wires up the embed PostMessage protocol:
 *  - input  → `{ url, format, crf, preset }`
 *  - output → `{ status, progress, fileName, outputName, outputSize, outputMime, error }`
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
  formatBytes,
  mimeForExtension,
  outputName,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

export type VideoOutputFormat = 'mp4' | 'webm' | 'mov' | 'avi' | 'mkv';

export interface VideoFormatDef {
  id: VideoOutputFormat;
  label: string;
  videoCodec: string;
  audioCodec: string;
}

export const VIDEO_FORMATS: readonly VideoFormatDef[] = [
  { id: 'mp4', label: 'MP4 (H.264 + AAC)', videoCodec: 'libx264', audioCodec: 'aac' },
  { id: 'webm', label: 'WebM (VP9 + Opus)', videoCodec: 'libvpx-vp9', audioCodec: 'libopus' },
  { id: 'mov', label: 'MOV (H.264 + AAC)', videoCodec: 'libx264', audioCodec: 'aac' },
  { id: 'mkv', label: 'MKV (H.264 + AAC)', videoCodec: 'libx264', audioCodec: 'aac' },
  { id: 'avi', label: 'AVI (MPEG-4 + MP3)', videoCodec: 'mpeg4', audioCodec: 'libmp3lame' },
] as const;

/** x264-style speed/quality presets. */
export const ENCODE_PRESETS = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
] as const;
export type EncodePreset = (typeof ENCODE_PRESETS)[number];
export const DEFAULT_PRESET: EncodePreset = 'veryfast';

export const DEFAULT_FORMAT: VideoOutputFormat = 'mp4';
export const DEFAULT_CRF = 23;
export const CRF_MIN = 18;
export const CRF_MAX = 40;

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 512 * 1024 * 1024;

/**
 * Map a CRF value (18-40) onto the mpeg4 `q:v` scale (2-10) used for AVI.
 * Lower q = better quality.
 */
export function crfToQscale(crf: number): number {
  return Math.min(10, Math.max(2, Math.round((crf - 14) / 3)));
}

/** Build the ffmpeg argument list for a video conversion. */
export function buildVideoConvertArgs(
  inputName: string,
  outputFile: string,
  format: VideoOutputFormat,
  crf: number,
  preset: EncodePreset,
): string[] {
  const args: string[] = ['-i', inputName];
  switch (format) {
    case 'webm':
      args.push(
        '-c:v', 'libvpx-vp9',
        '-crf', String(crf),
        '-b:v', '0',
        '-row-mt', '1',
        '-c:a', 'libopus',
        '-b:a', '128k',
      );
      break;
    case 'avi':
      args.push(
        '-c:v', 'mpeg4',
        '-q:v', String(crfToQscale(crf)),
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
      );
      break;
    case 'mp4':
    case 'mov':
      args.push(
        '-c:v', 'libx264',
        '-crf', String(crf),
        '-preset', preset,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
      );
      break;
    case 'mkv':
      args.push(
        '-c:v', 'libx264',
        '-crf', String(crf),
        '-preset', preset,
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
      );
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
}

export interface UseVideoConverterReturn {
  file: Ref<PickedFile | null>;
  format: Ref<VideoOutputFormat>;
  crf: Ref<number>;
  preset: Ref<EncodePreset>;
  status: Ref<ConvertStatus>;
  progress: Ref<number>;
  error: Ref<string>;
  result: Ref<ConvertResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => void;
  convert: () => Promise<void>;
  download: () => void;
  clear: () => void;
}

export function useVideoConverter(): UseVideoConverterReturn {
  const file = ref<PickedFile | null>(null);
  const format = ref<VideoOutputFormat>(DEFAULT_FORMAT);
  const crf = ref<number>(DEFAULT_CRF);
  const preset = ref<EncodePreset>(DEFAULT_PRESET);
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
    if (kind === 'audio' || kind === 'image') {
      error.value = 'That looks like an audio/image file - pick a video file.';
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

  async function convert(): Promise<void> {
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
        const args = buildVideoConvertArgs(
          inName,
          outName,
          format.value,
          crf.value,
          preset.value,
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
          name: outputName(file.value.name, format.value, '-converted'),
          size: out.byteLength,
          mime,
        };
        status.value = 'done';
        progress.value = 1;
      } finally {
        await deleteQuiet(ffmpeg, inName);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Conversion failed.';
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
        VIDEO_FORMATS.some((f) => f.id === p.format)
      ) {
        format.value = p.format as VideoOutputFormat;
      }
      if (typeof p.crf === 'number' && Number.isFinite(p.crf)) {
        crf.value = Math.min(CRF_MAX, Math.max(CRF_MIN, Math.round(p.crf)));
      }
      if (
        typeof p.preset === 'string' &&
        (ENCODE_PRESETS as readonly string[]).includes(p.preset)
      ) {
        preset.value = p.preset as EncodePreset;
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
            if (p.action === 'convert' || p.autoRun === true) await convert();
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
          }
        })();
      }
      if (p.action === 'convert') void convert();
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
    crf,
    preset,
    status,
    progress,
    error,
    result,
    isEmbed,
    embedInput,
    onFile,
    convert,
    download,
    clear,
  };
}
