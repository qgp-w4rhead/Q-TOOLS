/**
 * useAudioConverter - composable + pure logic for the audio converter tool.
 *
 * Converts audio files between WAV / MP3 / OGG / FLAC / AAC / M4A entirely
 * in the browser via ffmpeg.wasm (lazy-loaded - the ~32 MB core is fetched
 * only when the user runs their first conversion).
 *
 * Pure helpers (`AUDIO_FORMATS`, `codecArgsForFormat`, `buildConvertArgs`,
 * `isLosslessFormat`) have no Vue dependency and can be imported standalone
 * for unit testing or reuse. The `useAudioConverter()` composable wraps the
 * conversion in reactive state and wires up the embed PostMessage protocol:
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

/** Output formats offered by the tool. */
export type AudioOutputFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'aac' | 'm4a';

export interface AudioFormatDef {
  id: AudioOutputFormat;
  label: string;
  /** `true` for lossless targets - the bitrate picker is hidden for these. */
  lossless: boolean;
}

export const AUDIO_FORMATS: readonly AudioFormatDef[] = [
  { id: 'mp3', label: 'MP3', lossless: false },
  { id: 'm4a', label: 'M4A (AAC)', lossless: false },
  { id: 'aac', label: 'AAC', lossless: false },
  { id: 'ogg', label: 'OGG Vorbis', lossless: false },
  { id: 'flac', label: 'FLAC', lossless: true },
  { id: 'wav', label: 'WAV', lossless: true },
] as const;

/** Bitrate options (kbps) for lossy targets. */
export const AUDIO_BITRATES = [96, 128, 160, 192, 256, 320] as const;
export const DEFAULT_BITRATE = 192;
export const DEFAULT_FORMAT: AudioOutputFormat = 'mp3';

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 256 * 1024 * 1024;

export function isLosslessFormat(format: AudioOutputFormat): boolean {
  return AUDIO_FORMATS.find((f) => f.id === format)?.lossless ?? false;
}

/** ffmpeg `-c:a` + quality args for a target format. */
export function codecArgsForFormat(
  format: AudioOutputFormat,
  bitrateKbps: number,
): string[] {
  const br = `${Math.round(bitrateKbps)}k`;
  switch (format) {
    case 'mp3':
      return ['-c:a', 'libmp3lame', '-b:a', br];
    case 'm4a':
    case 'aac':
      return ['-c:a', 'aac', '-b:a', br];
    case 'ogg':
      return ['-c:a', 'libvorbis', '-b:a', br];
    case 'flac':
      return ['-c:a', 'flac'];
    case 'wav':
      return ['-c:a', 'pcm_s16le'];
  }
}

/** Build the full ffmpeg argument list for a conversion. */
export function buildConvertArgs(
  inputName: string,
  outputFile: string,
  format: AudioOutputFormat,
  bitrateKbps: number,
): string[] {
  return [
    '-i', inputName,
    '-vn', // drop video/cover streams
    '-map_metadata', '0',
    ...codecArgsForFormat(format, bitrateKbps),
    outputFile,
  ];
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

export interface UseAudioConverterReturn {
  file: Ref<PickedFile | null>;
  format: Ref<AudioOutputFormat>;
  bitrate: Ref<number>;
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

export function useAudioConverter(): UseAudioConverterReturn {
  const file = ref<PickedFile | null>(null);
  const format = ref<AudioOutputFormat>(DEFAULT_FORMAT);
  const bitrate = ref<number>(DEFAULT_BITRATE);
  const status = ref<ConvertStatus>('idle');
  const progress = ref<number>(0);
  const error = ref<string>('');
  const result = ref<ConvertResult | null>(null);

  /** Raw input bytes - kept outside reactive state (large). */
  let inputBytes: Uint8Array | null = null;
  /** The File object backing `file` (kept for lazy byte reads). */
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
    if (kind === 'video' || kind === 'image') {
      error.value = 'That looks like a video/image file - pick an audio file.';
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      error.value = `File is too large (max ${formatBytes(MAX_FILE_SIZE)}).`;
      return;
    }
    revokeResult();
    inputBytes = null;
    file.value = { name: f.name || 'audio', size: f.size, mimeType: f.type || '' };
    status.value = 'idle';
    progress.value = 0;
    // Read lazily at convert time via the stored File reference.
    pendingFile = f;
  }

  async function convert(): Promise<void> {
    if (!pendingFile || !file.value) {
      error.value = 'Pick an audio file first.';
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
      const outName = `output.${format.value}`;
      await ffmpeg.writeFile(inName, inputBytes);
      try {
        const args = buildConvertArgs(inName, outName, format.value, bitrate.value);
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
        AUDIO_FORMATS.some((f) => f.id === p.format)
      ) {
        format.value = p.format as AudioOutputFormat;
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
                : (p.url as string).split('/').pop() || 'audio';
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
    bitrate,
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
