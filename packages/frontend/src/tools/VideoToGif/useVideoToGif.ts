/**
 * useVideoToGif - composable + pure logic for the video → GIF tool.
 *
 * Converts a video clip to an animated GIF entirely in the browser via
 * ffmpeg.wasm (lazy-loaded). Uses the palettegen/paletteuse two-filter
 * pipeline in a single command for good colour quality:
 *
 *   ffmpeg -ss S -t D -i in -vf "fps=N,scale=W:-1:flags=lanczos,
 *     split[s0][s1];[s0]palettegen=max_colors=C[p];[s1][p]paletteuse" out.gif
 *
 * Pure helpers (`buildGifArgs`, `clampFps`, `clampWidth`, `clampColors`)
 * have no Vue dependency. The composable wraps conversion in reactive state
 * and wires up the embed PostMessage protocol:
 *  - input  → `{ url, fps, width, colors, start, end }`
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
  formatTimestamp,
  outputName,
  parseTimestamp,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

export const DEFAULT_FPS = 12;
export const FPS_MIN = 5;
export const FPS_MAX = 30;
export const DEFAULT_WIDTH = 480;
export const WIDTH_MIN = 120;
export const WIDTH_MAX = 1280;
export const DEFAULT_COLORS = 256;
export const COLORS_MIN = 16;
export const COLORS_MAX = 256;

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 512 * 1024 * 1024;

export function clampFps(fps: number): number {
  return Math.min(FPS_MAX, Math.max(FPS_MIN, Math.round(fps)));
}

export function clampWidth(width: number): number {
  // Even widths only - keeps the scaler happy.
  const w = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(width)));
  return w % 2 === 0 ? w : w + 1;
}

export function clampColors(colors: number): number {
  return Math.min(COLORS_MAX, Math.max(COLORS_MIN, Math.round(colors)));
}

/**
 * Build the ffmpeg argument list for video → GIF.
 *
 * `startSec`/`endSec` are optional trim bounds (seconds). `endSec` is
 * converted to a `-t` duration internally.
 */
export function buildGifArgs(
  inputName: string,
  outputFile: string,
  opts: {
    fps: number;
    width: number;
    colors: number;
    startSec?: number | null;
    endSec?: number | null;
  },
): string[] {
  const args: string[] = [];
  const start = opts.startSec ?? 0;
  if (start > 0) args.push('-ss', formatTimestamp(start));
  if (opts.endSec != null && opts.endSec > start) {
    args.push('-t', formatTimestamp(opts.endSec - start));
  }
  args.push('-i', inputName);
  const vf =
    `fps=${clampFps(opts.fps)},` +
    `scale=${clampWidth(opts.width)}:-1:flags=lanczos,` +
    `split[s0][s1];` +
    `[s0]palettegen=max_colors=${clampColors(opts.colors)}[p];` +
    `[s1][p]paletteuse=dither=bayer:bayer_scale=5`;
  args.push('-vf', vf, '-loop', '0', outputFile);
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
  /** Object URL for the `<video>` preview. */
  previewUrl: string;
}

export interface ConvertResult {
  bytes: Uint8Array;
  url: string;
  name: string;
  size: number;
  mime: string;
}

export interface UseVideoToGifReturn {
  file: Ref<PickedFile | null>;
  fps: Ref<number>;
  width: Ref<number>;
  colors: Ref<number>;
  startText: Ref<string>;
  endText: Ref<string>;
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

export function useVideoToGif(): UseVideoToGifReturn {
  const file = ref<PickedFile | null>(null);
  const fps = ref<number>(DEFAULT_FPS);
  const width = ref<number>(DEFAULT_WIDTH);
  const colors = ref<number>(DEFAULT_COLORS);
  const startText = ref<string>('');
  const endText = ref<string>('');
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

  function revokeFile(): void {
    if (file.value) {
      URL.revokeObjectURL(file.value.previewUrl);
      file.value = null;
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
    revokeFile();
    inputBytes = null;
    pendingFile = f;
    file.value = {
      name: f.name || 'video',
      size: f.size,
      mimeType: f.type || '',
      previewUrl: URL.createObjectURL(f),
    };
    status.value = 'idle';
    progress.value = 0;
  }

  async function convert(): Promise<void> {
    if (!pendingFile || !file.value) {
      error.value = 'Pick a video file first.';
      return;
    }
    // Validate trim bounds before touching ffmpeg.
    const startSec = startText.value.trim() ? parseTimestamp(startText.value) : 0;
    const endSec = endText.value.trim() ? parseTimestamp(endText.value) : null;
    if (startText.value.trim() && startSec === null) {
      error.value = `Invalid start time "${startText.value}".`;
      return;
    }
    if (endText.value.trim() && endSec === null) {
      error.value = `Invalid end time "${endText.value}".`;
      return;
    }
    if (startSec != null && endSec != null && endSec <= startSec) {
      error.value = 'End time must be after the start time.';
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
      const outName = 'output.gif';
      await ffmpeg.writeFile(inName, inputBytes);
      try {
        const args = buildGifArgs(inName, outName, {
          fps: fps.value,
          width: width.value,
          colors: colors.value,
          startSec,
          endSec,
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
        result.value = {
          bytes: out,
          url: URL.createObjectURL(new Blob([out], { type: 'image/gif' })),
          name: outputName(file.value.name, 'gif', ''),
          size: out.byteLength,
          mime: 'image/gif',
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
    revokeFile();
    inputBytes = null;
    pendingFile = null;
    status.value = 'idle';
    progress.value = 0;
    error.value = '';
    startText.value = '';
    endText.value = '';
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.fps === 'number') fps.value = clampFps(p.fps);
      if (typeof p.width === 'number') width.value = clampWidth(p.width);
      if (typeof p.colors === 'number') colors.value = clampColors(p.colors);
      if (typeof p.start === 'string' || typeof p.start === 'number') {
        startText.value = String(p.start);
      }
      if (typeof p.end === 'string' || typeof p.end === 'number') {
        endText.value = String(p.end);
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
    revokeFile();
  });

  return {
    file,
    fps,
    width,
    colors,
    startText,
    endText,
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
