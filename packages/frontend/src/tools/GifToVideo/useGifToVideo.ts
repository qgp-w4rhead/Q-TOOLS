/**
 * useGifToVideo - composable + pure logic for the GIF → video tool.
 *
 * Converts an animated GIF to MP4 (H.264) or WebM (VP9) entirely in the
 * browser via ffmpeg.wasm (lazy-loaded). Video output is typically far
 * smaller than the source GIF.
 *
 * Notes:
 *  - GIF dimensions can be odd → frames are scaled to even numbers for
 *    yuv420p compatibility.
 *  - `-ignore_loop 0` honours the GIF's own loop count (default off → the
 *    animation plays once); a toggle exposes it.
 *
 * Pure helpers (`buildGifToVideoArgs`) have no Vue dependency. The
 * composable wires up the embed PostMessage protocol:
 *  - input  → `{ url, format, crf, preserveLoop }`
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

export type GifVideoFormat = 'mp4' | 'webm';

export const GIF_VIDEO_FORMATS: readonly { id: GifVideoFormat; label: string }[] = [
  { id: 'mp4', label: 'MP4 (H.264)' },
  { id: 'webm', label: 'WebM (VP9)' },
] as const;

export const DEFAULT_FORMAT: GifVideoFormat = 'mp4';
export const DEFAULT_CRF = 28;
export const CRF_MIN = 18;
export const CRF_MAX = 40;

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 256 * 1024 * 1024;

/** Build the ffmpeg argument list for GIF → video. */
export function buildGifToVideoArgs(
  inputName: string,
  outputFile: string,
  format: GifVideoFormat,
  crf: number,
  preserveLoop: boolean,
): string[] {
  const args: string[] = [];
  if (preserveLoop) args.push('-ignore_loop', '0');
  args.push('-i', inputName);
  // Even dimensions required by yuv420p encoders.
  args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos');
  if (format === 'webm') {
    args.push(
      '-c:v', 'libvpx-vp9',
      '-crf', String(crf),
      '-b:v', '0',
      '-row-mt', '1',
      '-pix_fmt', 'yuv420p',
      '-an',
    );
  } else {
    args.push(
      '-c:v', 'libx264',
      '-crf', String(crf),
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
    );
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
  previewUrl: string;
}

export interface ConvertResult {
  bytes: Uint8Array;
  url: string;
  name: string;
  size: number;
  mime: string;
}

export interface UseGifToVideoReturn {
  file: Ref<PickedFile | null>;
  format: Ref<GifVideoFormat>;
  crf: Ref<number>;
  preserveLoop: Ref<boolean>;
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

export function useGifToVideo(): UseGifToVideoReturn {
  const file = ref<PickedFile | null>(null);
  const format = ref<GifVideoFormat>(DEFAULT_FORMAT);
  const crf = ref<number>(DEFAULT_CRF);
  const preserveLoop = ref<boolean>(false);
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
    const isGif =
      f.type === 'image/gif' || fileExtension(f.name) === 'gif';
    if (!isGif) {
      error.value = 'Pick an animated GIF file.';
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
      name: f.name || 'image.gif',
      size: f.size,
      mimeType: f.type || 'image/gif',
      previewUrl: URL.createObjectURL(f),
    };
    status.value = 'idle';
    progress.value = 0;
  }

  async function convert(): Promise<void> {
    if (!pendingFile || !file.value) {
      error.value = 'Pick a GIF file first.';
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
      const inName = safeFsName(file.value.name, 'input.gif');
      const outName = `output.${format.value}`;
      await ffmpeg.writeFile(inName, inputBytes);
      try {
        const args = buildGifToVideoArgs(
          inName,
          outName,
          format.value,
          crf.value,
          preserveLoop.value,
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
          name: outputName(file.value.name, format.value, ''),
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
    revokeFile();
    inputBytes = null;
    pendingFile = null;
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
      if (typeof p.crf === 'number' && Number.isFinite(p.crf)) {
        crf.value = Math.min(CRF_MAX, Math.max(CRF_MIN, Math.round(p.crf)));
      }
      if (typeof p.preserveLoop === 'boolean') preserveLoop.value = p.preserveLoop;
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
                : (p.url as string).split('/').pop() || 'image.gif';
            onFile(new File([blob], name, { type: blob.type || 'image/gif' }));
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
    format,
    crf,
    preserveLoop,
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
