/**
 * useAudioTrimmer - composable + pure logic for the audio trimmer tool.
 *
 * Cuts audio by start/end time with a waveform preview, optional fade
 * in/out, and re-export to MP3 / WAV / OGG / M4A / FLAC - entirely in the
 * browser via ffmpeg.wasm (lazy-loaded).
 *
 * The waveform is rendered from peaks computed by the Web Audio API
 * (`OfflineAudioContext`/`AudioContext.decodeAudioData`). When the codec
 * can't be decoded by the browser the preview is skipped but trimming
 * still works (ffmpeg decodes far more formats).
 *
 * Pure helpers (`computePeaks`, `buildTrimArgs`, `TRIM_FORMATS`) have no
 * Vue dependency. The composable wires up the embed PostMessage protocol:
 *  - input  → `{ url, start, end, fadeIn, fadeOut, format }`
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
  mimeForExtension,
  outputName,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

export type TrimFormat = 'keep' | 'mp3' | 'wav' | 'ogg' | 'm4a' | 'flac';

export const TRIM_FORMATS: readonly { id: TrimFormat; label: string }[] = [
  { id: 'keep', label: 'Keep format' },
  { id: 'mp3', label: 'MP3' },
  { id: 'wav', label: 'WAV' },
  { id: 'ogg', label: 'OGG' },
  { id: 'm4a', label: 'M4A' },
  { id: 'flac', label: 'FLAC' },
] as const;

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 256 * 1024 * 1024;

/** Number of peak buckets computed for the waveform preview. */
export const PEAK_BUCKETS = 400;

/**
 * Compute min/max peak pairs per bucket from an AudioBuffer for waveform
 * rendering. Returns a flat array of `[min, max]` pairs normalised to
 * [-1, 1]. Pure - no DOM dependency.
 */
export function computePeaks(buffer: AudioBuffer, buckets = PEAK_BUCKETS): number[] {
  const channels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length;
  const peaks = new Array<number>(buckets * 2);
  const per = Math.max(1, Math.floor(length / buckets));
  for (let b = 0; b < buckets; b++) {
    const start = b * per;
    const end = Math.min(length, start + per);
    let min = 1;
    let max = -1;
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = start; i < end; i++) {
        const v = data[i]!;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min > max) {
      min = 0;
      max = 0;
    }
    peaks[b * 2] = min;
    peaks[b * 2 + 1] = max;
  }
  return peaks;
}

/**
 * Build the ffmpeg argument list for a trim.
 *
 * `startSec`/`endSec` bound the cut; `fadeInSec`/`fadeOutSec` add `afade`
 * filters; `format` selects the codec (`keep` = copy the source codec when
 * the container allows, else re-encode to the same extension).
 */
export function buildTrimArgs(
  inputName: string,
  outputFile: string,
  opts: {
    startSec: number;
    endSec: number | null;
    fadeInSec: number;
    fadeOutSec: number;
    format: TrimFormat;
    bitrateKbps?: number;
  },
): string[] {
  const args: string[] = [];
  const start = Math.max(0, opts.startSec);
  if (start > 0) args.push('-ss', formatTimestamp(start));
  if (opts.endSec != null && opts.endSec > start) {
    args.push('-t', formatTimestamp(opts.endSec - start));
  }
  args.push('-i', inputName, '-vn', '-sn', '-dn');

  // Fades require re-encoding (they're filters).
  const dur = opts.endSec != null ? opts.endSec - start : null;
  const filters: string[] = [];
  if (opts.fadeInSec > 0) {
    filters.push(`afade=t=in:st=0:d=${opts.fadeInSec.toFixed(3)}`);
  }
  if (opts.fadeOutSec > 0 && dur != null) {
    const st = Math.max(0, dur - opts.fadeOutSec);
    filters.push(`afade=t=out:st=${st.toFixed(3)}:d=${opts.fadeOutSec.toFixed(3)}`);
  }
  if (filters.length > 0) args.push('-af', filters.join(','));

  const needsEncode = filters.length > 0 || opts.format !== 'keep';
  if (!needsEncode) {
    args.push('-c:a', 'copy');
  } else {
    const br = `${Math.round(opts.bitrateKbps ?? 192)}k`;
    switch (opts.format) {
      case 'mp3':
        args.push('-c:a', 'libmp3lame', '-b:a', br);
        break;
      case 'm4a':
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
      case 'keep':
        // Fades on but keeping the container - encode to a sane default
        // based on the output extension chosen by the caller.
        break;
    }
  }
  args.push(outputFile);
  return args;
}

/** Map an output extension to a sane encoder when format === 'keep'. */
export function encoderForExtension(ext: string): string[] {
  switch (ext) {
    case 'mp3':
      return ['-c:a', 'libmp3lame', '-b:a', '192k'];
    case 'm4a':
    case 'aac':
      return ['-c:a', 'aac', '-b:a', '192k'];
    case 'ogg':
    case 'oga':
    case 'opus':
      return ['-c:a', 'libvorbis', '-b:a', '192k'];
    case 'flac':
      return ['-c:a', 'flac'];
    case 'wav':
    default:
      return ['-c:a', 'pcm_s16le'];
  }
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

export interface UseAudioTrimmerReturn {
  file: Ref<PickedFile | null>;
  /** Source duration in seconds (from the decoded AudioBuffer or probe). */
  duration: Ref<number>;
  /** Waveform peaks ([min,max] pairs) for the canvas, or null. */
  peaks: Ref<number[] | null>;
  startSec: Ref<number>;
  endSec: Ref<number>;
  fadeInSec: Ref<number>;
  fadeOutSec: Ref<number>;
  format: Ref<TrimFormat>;
  status: Ref<ConvertStatus>;
  progress: Ref<number>;
  error: Ref<string>;
  result: Ref<ConvertResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => Promise<void>;
  trim: () => Promise<void>;
  download: () => void;
  clear: () => void;
}

export function useAudioTrimmer(): UseAudioTrimmerReturn {
  const file = ref<PickedFile | null>(null);
  const duration = ref<number>(0);
  const peaks = ref<number[] | null>(null);
  const startSec = ref<number>(0);
  const endSec = ref<number>(0);
  const fadeInSec = ref<number>(0);
  const fadeOutSec = ref<number>(0);
  const format = ref<TrimFormat>('keep');
  const status = ref<ConvertStatus>('idle');
  const progress = ref<number>(0);
  const error = ref<string>('');
  const result = ref<ConvertResult | null>(null);

  let inputBytes: Uint8Array | null = null;
  let pendingFile: File | null = null;
  let audioCtx: AudioContext | null = null;

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
    revokeFile();
    peaks.value = null;
    duration.value = 0;
    inputBytes = null;
    pendingFile = f;
    file.value = {
      name: f.name || 'audio',
      size: f.size,
      mimeType: f.type || '',
      previewUrl: URL.createObjectURL(f),
    };
    status.value = 'idle';
    progress.value = 0;

    // Decode for the waveform + duration. Failure is non-fatal - ffmpeg
    // handles far more codecs than the browser decoder.
    try {
      inputBytes = await blobToBytes(f);
      if (typeof AudioContext !== 'undefined') {
        if (!audioCtx) audioCtx = new AudioContext();
        const copy = new Uint8Array(inputBytes.byteLength);
        copy.set(inputBytes);
        const buf = await audioCtx.decodeAudioData(copy.buffer);
        duration.value = buf.duration;
        endSec.value = buf.duration;
        peaks.value = computePeaks(buf);
      }
    } catch {
      // Waveform unavailable - the user can still trim by timestamps.
      peaks.value = null;
    }
  }

  async function trim(): Promise<void> {
    if (!pendingFile || !file.value) {
      error.value = 'Pick an audio file first.';
      return;
    }
    if (endSec.value <= startSec.value) {
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
      const inName = safeFsName(file.value.name, 'input.audio');
      const srcExt = file.value.name.split('.').pop()?.toLowerCase() || 'wav';
      const outExt = format.value === 'keep' ? srcExt : format.value;
      const outName = `output.${outExt}`;
      await ffmpeg.writeFile(inName, inputBytes);
      try {
        const args = buildTrimArgs(inName, outName, {
          startSec: startSec.value,
          endSec: endSec.value,
          fadeInSec: fadeInSec.value,
          fadeOutSec: fadeOutSec.value,
          format: format.value,
        });
        // `keep` + fades → pick an encoder matching the source extension.
        if (format.value === 'keep' && (fadeInSec.value > 0 || fadeOutSec.value > 0)) {
          const idx = args.lastIndexOf(outName);
          args.splice(idx, 0, ...encoderForExtension(outExt));
        }
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
        const mime = mimeForExtension(outExt);
        result.value = {
          bytes: out,
          url: URL.createObjectURL(new Blob([out], { type: mime })),
          name: outputName(file.value.name, outExt, '-trimmed'),
          size: out.byteLength,
          mime,
        };
        status.value = 'done';
        progress.value = 1;
      } finally {
        await deleteQuiet(ffmpeg, inName);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Trim failed.';
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
    peaks.value = null;
    duration.value = 0;
    startSec.value = 0;
    endSec.value = 0;
    fadeInSec.value = 0;
    fadeOutSec.value = 0;
    status.value = 'idle';
    progress.value = 0;
    error.value = '';
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.start === 'number') startSec.value = Math.max(0, p.start);
      if (typeof p.end === 'number') endSec.value = Math.max(0, p.end);
      if (typeof p.fadeIn === 'number') fadeInSec.value = Math.max(0, p.fadeIn);
      if (typeof p.fadeOut === 'number') fadeOutSec.value = Math.max(0, p.fadeOut);
      if (
        typeof p.format === 'string' &&
        TRIM_FORMATS.some((f) => f.id === p.format)
      ) {
        format.value = p.format as TrimFormat;
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
            if (p.action === 'trim' || p.autoRun === true) await trim();
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
          }
        })();
      }
      if (p.action === 'trim') void trim();
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
    if (audioCtx) {
      void audioCtx.close().catch(() => undefined);
      audioCtx = null;
    }
  });

  return {
    file,
    duration,
    peaks,
    startSec,
    endSec,
    fadeInSec,
    fadeOutSec,
    format,
    status,
    progress,
    error,
    result,
    isEmbed,
    embedInput,
    onFile,
    trim,
    download,
    clear,
  };
}
