/**
 * useVolumeNormalizer - composable + pure logic for the volume normalizer.
 *
 * Normalizes or boosts audio loudness entirely in the browser via
 * ffmpeg.wasm (lazy-loaded). Two modes:
 *  - **Peak normalize** - two-pass: `volumedetect` measures `max_volume`,
 *    then `volume=<gain>dB` brings the peak to the target level.
 *  - **EBU R128 loudnorm** - single-pass `loudnorm` filter targeting an
 *    integrated loudness (LUFS), true peak, and loudness range.
 *
 * Pure helpers (`parseVolumeDetect`, `buildNormalizeArgs`,
 * `buildLoudnormArgs`) have no Vue dependency. The composable wires up the
 * embed PostMessage protocol:
 *  - input  → `{ url, mode, targetPeak, targetLufs, format }`
 *  - output → `{ status, progress, fileName, outputName, outputSize, outputMime, measured, error }`
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
  fileExtension,
  formatBytes,
  mimeForExtension,
  outputName,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

export type NormalizeMode = 'peak' | 'loudnorm';

export const NORMALIZE_MODES: readonly { id: NormalizeMode; label: string; hint: string }[] = [
  { id: 'peak', label: 'Peak normalize', hint: 'Two-pass - brings the loudest peak to the target dB' },
  { id: 'loudnorm', label: 'EBU R128 loudness', hint: 'Single-pass loudnorm to a LUFS target' },
] as const;

export type NormalizeFormat = 'keep' | 'mp3' | 'wav' | 'ogg' | 'm4a' | 'flac';

export const NORMALIZE_FORMATS: readonly { id: NormalizeFormat; label: string }[] = [
  { id: 'keep', label: 'Keep format' },
  { id: 'mp3', label: 'MP3' },
  { id: 'wav', label: 'WAV' },
  { id: 'ogg', label: 'OGG' },
  { id: 'm4a', label: 'M4A' },
  { id: 'flac', label: 'FLAC' },
] as const;

export const DEFAULT_TARGET_PEAK = -1.0; // dBFS
export const DEFAULT_TARGET_LUFS = -16; // streaming standard
export const DEFAULT_TRUE_PEAK = -1.5; // dBTP
export const DEFAULT_LRA = 11;

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 256 * 1024 * 1024;

/** Measurements parsed from a `volumedetect` run. */
export interface VolumeMeasurement {
  /** `max_volume` in dB (e.g. -3.2). `null` when not found. */
  maxVolumeDb: number | null;
  /** `mean_volume` in dB. `null` when not found. */
  meanVolumeDb: number | null;
}

/** Parse `max_volume` / `mean_volume` from volumedetect log output. */
export function parseVolumeDetect(logText: string): VolumeMeasurement {
  const max = /max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i.exec(logText);
  const mean = /mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i.exec(logText);
  return {
    maxVolumeDb: max ? Number(max[1]) : null,
    meanVolumeDb: mean ? Number(mean[1]) : null,
  };
}

/** Encoder args for an output format. */
export function encoderArgs(format: NormalizeFormat, ext: string): string[] {
  const f = format === 'keep' ? ext : format;
  switch (f) {
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

/** Build args for the volumedetect measurement pass (no output file). */
export function buildMeasureArgs(inputName: string): string[] {
  return ['-i', inputName, '-af', 'volumedetect', '-f', 'null', 'NUL'];
}

/** Build args for the peak-normalize pass. */
export function buildNormalizeArgs(
  inputName: string,
  outputFile: string,
  gainDb: number,
  encoder: string[],
): string[] {
  const sign = gainDb >= 0 ? `+${gainDb.toFixed(2)}` : gainDb.toFixed(2);
  return [
    '-i', inputName,
    '-vn', '-sn', '-dn',
    '-af', `volume=${sign}dB`,
    ...encoder,
    outputFile,
  ];
}

/** Build args for the single-pass loudnorm filter. */
export function buildLoudnormArgs(
  inputName: string,
  outputFile: string,
  opts: { lufs: number; truePeak: number; lra: number },
  encoder: string[],
): string[] {
  return [
    '-i', inputName,
    '-vn', '-sn', '-dn',
    '-af',
    `loudnorm=I=${opts.lufs.toFixed(1)}:TP=${opts.truePeak.toFixed(1)}:LRA=${opts.lra.toFixed(1)}`,
    ...encoder,
    outputFile,
  ];
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export type ConvertStatus =
  | 'idle'
  | 'loading-engine'
  | 'measuring'
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

export interface UseVolumeNormalizerReturn {
  file: Ref<PickedFile | null>;
  mode: Ref<NormalizeMode>;
  targetPeak: Ref<number>;
  targetLufs: Ref<number>;
  format: Ref<NormalizeFormat>;
  status: Ref<ConvertStatus>;
  progress: Ref<number>;
  error: Ref<string>;
  measured: Ref<VolumeMeasurement | null>;
  appliedGainDb: Ref<number | null>;
  result: Ref<ConvertResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => void;
  normalize: () => Promise<void>;
  download: () => void;
  clear: () => void;
}

export function useVolumeNormalizer(): UseVolumeNormalizerReturn {
  const file = ref<PickedFile | null>(null);
  const mode = ref<NormalizeMode>('peak');
  const targetPeak = ref<number>(DEFAULT_TARGET_PEAK);
  const targetLufs = ref<number>(DEFAULT_TARGET_LUFS);
  const format = ref<NormalizeFormat>('keep');
  const status = ref<ConvertStatus>('idle');
  const progress = ref<number>(0);
  const error = ref<string>('');
  const measured = ref<VolumeMeasurement | null>(null);
  const appliedGainDb = ref<number | null>(null);
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
      error.value = 'That looks like an image - pick an audio (or video) file.';
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      error.value = `File is too large (max ${formatBytes(MAX_FILE_SIZE)}).`;
      return;
    }
    revokeResult();
    inputBytes = null;
    pendingFile = f;
    measured.value = null;
    appliedGainDb.value = null;
    file.value = { name: f.name || 'audio', size: f.size, mimeType: f.type || '' };
    status.value = 'idle';
    progress.value = 0;
  }

  async function normalize(): Promise<void> {
    if (!pendingFile || !file.value) {
      error.value = 'Pick an audio file first.';
      return;
    }
    error.value = '';
    revokeResult();
    measured.value = null;
    appliedGainDb.value = null;
    progress.value = 0;
    try {
      status.value = 'loading-engine';
      const ffmpeg = await getFFmpeg();

      if (!inputBytes) inputBytes = await blobToBytes(pendingFile);
      const inName = safeFsName(file.value.name, 'input.audio');
      const srcExt = fileExtension(file.value.name) || 'wav';
      const outExt = format.value === 'keep' ? srcExt : format.value;
      const outName = `output.${outExt}`;
      await ffmpeg.writeFile(inName, inputBytes);
      try {
        const encoder = encoderArgs(format.value, srcExt);
        let args: string[];

        if (mode.value === 'peak') {
          // Pass 1: measure.
          status.value = 'measuring';
          const measure = await runFfmpeg(ffmpeg, buildMeasureArgs(inName));
          const m = parseVolumeDetect(measure.output);
          measured.value = m;
          if (m.maxVolumeDb === null) {
            throw new Error('Could not measure the audio level (volumedetect).');
          }
          const gain = targetPeak.value - m.maxVolumeDb;
          appliedGainDb.value = gain;
          status.value = 'processing';
          args = buildNormalizeArgs(inName, outName, gain, encoder);
        } else {
          status.value = 'processing';
          args = buildLoudnormArgs(
            inName,
            outName,
            { lufs: targetLufs.value, truePeak: DEFAULT_TRUE_PEAK, lra: DEFAULT_LRA },
            encoder,
          );
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
          name: outputName(file.value.name, outExt, '-normalized'),
          size: out.byteLength,
          mime,
        };
        status.value = 'done';
        progress.value = 1;
      } finally {
        await deleteQuiet(ffmpeg, inName);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Normalization failed.';
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
    measured.value = null;
    appliedGainDb.value = null;
    status.value = 'idle';
    progress.value = 0;
    error.value = '';
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.mode === 'peak' || p.mode === 'loudnorm') mode.value = p.mode;
      if (typeof p.targetPeak === 'number') targetPeak.value = p.targetPeak;
      if (typeof p.targetLufs === 'number') targetLufs.value = p.targetLufs;
      if (
        typeof p.format === 'string' &&
        NORMALIZE_FORMATS.some((f) => f.id === p.format)
      ) {
        format.value = p.format as NormalizeFormat;
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
            onFile(new File([blob], name, { type: blob.type }));
            if (p.action === 'normalize' || p.autoRun === true) await normalize();
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
          }
        })();
      }
      if (p.action === 'normalize') void normalize();
      if (p.action === 'clear') clear();
    },
  });

  watch(
    [status, progress, file, result, measured, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        status: status.value,
        progress: progress.value,
        fileName: file.value?.name ?? '',
        outputName: result.value?.name ?? '',
        outputSize: result.value?.size ?? 0,
        outputMime: result.value?.mime ?? '',
        measured: measured.value
          ? {
              maxVolumeDb: measured.value.maxVolumeDb,
              meanVolumeDb: measured.value.meanVolumeDb,
            }
          : undefined,
        appliedGainDb: appliedGainDb.value ?? undefined,
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
    mode,
    targetPeak,
    targetLufs,
    format,
    status,
    progress,
    error,
    measured,
    appliedGainDb,
    result,
    isEmbed,
    embedInput,
    onFile,
    normalize,
    download,
    clear,
  };
}
