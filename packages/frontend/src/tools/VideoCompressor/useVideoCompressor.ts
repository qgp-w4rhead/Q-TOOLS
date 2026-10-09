/**
 * useVideoCompressor - composable + pure logic for the video compressor.
 *
 * Reduces video file size entirely in the browser via ffmpeg.wasm
 * (lazy-loaded) using resolution scaling, CRF quality, encode presets,
 * and optional audio bitrate reduction / removal.
 *
 * Pure helpers (`RESOLUTION_PRESETS`, `buildCompressArgs`) have no Vue
 * dependency. The composable wires up the embed PostMessage protocol:
 *  - input  → `{ url, resolution, crf, preset, audioBitrate, removeAudio, format }`
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

export type CompressFormat = 'mp4' | 'webm';

export const COMPRESS_FORMATS: readonly { id: CompressFormat; label: string }[] = [
  { id: 'mp4', label: 'MP4 (H.264)' },
  { id: 'webm', label: 'WebM (VP9)' },
] as const;

/** Resolution scale presets - value is the target height (0 = original). */
export const RESOLUTION_PRESETS: readonly { id: string; label: string; height: number }[] = [
  { id: 'original', label: 'Original', height: 0 },
  { id: '1080', label: '1080p', height: 1080 },
  { id: '720', label: '720p', height: 720 },
  { id: '480', label: '480p', height: 480 },
  { id: '360', label: '360p', height: 360 },
] as const;

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

export const AUDIO_BITRATE_OPTIONS = [0, 64, 96, 128, 160] as const; // 0 = remove audio

export const DEFAULT_CRF = 28;
export const CRF_MIN = 20;
export const CRF_MAX = 45;
export const DEFAULT_PRESET: EncodePreset = 'veryfast';

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 512 * 1024 * 1024;

/** Build the ffmpeg argument list for compression. */
export function buildCompressArgs(
  inputName: string,
  outputFile: string,
  opts: {
    format: CompressFormat;
    targetHeight: number;
    crf: number;
    preset: EncodePreset;
    audioBitrateKbps: number; // 0 = strip audio
  },
): string[] {
  const args: string[] = ['-i', inputName];

  // Scale down only - `-2` keeps aspect with even dimensions; the min()
  // guard prevents upscaling when the source is smaller than the target.
  if (opts.targetHeight > 0) {
    args.push(
      '-vf',
      `scale=-2:'min(${opts.targetHeight},ih)'`,
    );
  }

  if (opts.format === 'webm') {
    args.push(
      '-c:v', 'libvpx-vp9',
      '-crf', String(opts.crf),
      '-b:v', '0',
      '-row-mt', '1',
      '-pix_fmt', 'yuv420p',
    );
  } else {
    args.push(
      '-c:v', 'libx264',
      '-crf', String(opts.crf),
      '-preset', opts.preset,
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
    );
  }

  if (opts.audioBitrateKbps <= 0) {
    args.push('-an');
  } else if (opts.format === 'webm') {
    args.push('-c:a', 'libopus', '-b:a', `${opts.audioBitrateKbps}k`);
  } else {
    args.push('-c:a', 'aac', '-b:a', `${opts.audioBitrateKbps}k`);
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

export interface UseVideoCompressorReturn {
  file: Ref<PickedFile | null>;
  format: Ref<CompressFormat>;
  resolution: Ref<string>;
  crf: Ref<number>;
  preset: Ref<EncodePreset>;
  audioBitrate: Ref<number>;
  status: Ref<ConvertStatus>;
  progress: Ref<number>;
  error: Ref<string>;
  result: Ref<ConvertResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => void;
  compress: () => Promise<void>;
  download: () => void;
  clear: () => void;
}

export function useVideoCompressor(): UseVideoCompressorReturn {
  const file = ref<PickedFile | null>(null);
  const format = ref<CompressFormat>('mp4');
  const resolution = ref<string>('720');
  const crf = ref<number>(DEFAULT_CRF);
  const preset = ref<EncodePreset>(DEFAULT_PRESET);
  const audioBitrate = ref<number>(96);
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

  async function compress(): Promise<void> {
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
        const target = RESOLUTION_PRESETS.find((r) => r.id === resolution.value);
        const args = buildCompressArgs(inName, outName, {
          format: format.value,
          targetHeight: target?.height ?? 0,
          crf: crf.value,
          preset: preset.value,
          audioBitrateKbps: audioBitrate.value,
        });
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
          name: outputName(file.value.name, format.value, '-compressed'),
          size: out.byteLength,
          mime,
        };
        status.value = 'done';
        progress.value = 1;
      } finally {
        await deleteQuiet(ffmpeg, inName);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Compression failed.';
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
      if (p.format === 'mp4' || p.format === 'webm') format.value = p.format;
      if (
        typeof p.resolution === 'string' &&
        RESOLUTION_PRESETS.some((r) => r.id === p.resolution)
      ) {
        resolution.value = p.resolution;
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
      if (typeof p.audioBitrate === 'number') {
        audioBitrate.value = Math.max(0, Math.round(p.audioBitrate));
      }
      if (p.removeAudio === true) audioBitrate.value = 0;
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
            if (p.action === 'compress' || p.action === 'convert' || p.autoRun === true) {
              await compress();
            }
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
          }
        })();
      }
      if (p.action === 'compress' || p.action === 'convert') void compress();
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
    resolution,
    crf,
    preset,
    audioBitrate,
    status,
    progress,
    error,
    result,
    isEmbed,
    embedInput,
    onFile,
    compress,
    download,
    clear,
  };
}
