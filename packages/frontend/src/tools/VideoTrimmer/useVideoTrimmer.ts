/**
 * useVideoTrimmer - composable + pure logic for the video trimmer tool.
 *
 * Cuts a video clip by start/end timestamp entirely in the browser via
 * ffmpeg.wasm (lazy-loaded). Two modes:
 *  - **Stream copy** (`-c copy`) - instant and lossless, but the cut lands
 *    on the nearest keyframes (may include a little extra footage).
 *  - **Re-encode** (libx264 + AAC) - frame-accurate, slower.
 *
 * `-ss` is placed before `-i` (fast seek); with re-encode ffmpeg still
 * decodes accurately to the requested point.
 *
 * An optional second audio file can be merged onto the cut: one or more
 * copies of it are placed at `audioOffsets` seconds on the *video*
 * timeline (draggable in the UI), optionally looping to the end of the
 * cut, then either replace the video's audio or are mixed with it via
 * `amix`. Merged audio is always re-encoded to AAC; the video stream
 * still stream-copies in `copy` mode.
 *
 * Pure helpers (`buildVideoTrimArgs`) have no Vue dependency. The
 * composable wires up the embed PostMessage protocol:
 *  - input  → `{ url, start, end, mode, crf, audioUrl, audioOffsets, audioOffset, audioLoop, audioMode }`
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
  fileExtension,
  formatBytes,
  formatTimestamp,
  mimeForExtension,
  outputName,
  parseTimestamp,
  safeFsName,
} from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

export type TrimMode = 'copy' | 'reencode';

export const TRIM_MODES: readonly { id: TrimMode; label: string; hint: string }[] = [
  {
    id: 'copy',
    label: 'Stream copy',
    hint: 'Instant + lossless, cuts on keyframes',
  },
  {
    id: 'reencode',
    label: 'Re-encode',
    hint: 'Frame-accurate, slower',
  },
] as const;

export const DEFAULT_CRF = 23;
export const CRF_MIN = 18;
export const CRF_MAX = 40;

/** Max input size - ffmpeg.wasm keeps input + output in memory. */
export const MAX_FILE_SIZE = 512 * 1024 * 1024;

/** Max size for the optional merged audio track. */
export const MAX_AUDIO_FILE_SIZE = 256 * 1024 * 1024;

export type AudioMergeMode = 'replace' | 'mix';

export const AUDIO_MERGE_MODES: readonly {
  id: AudioMergeMode;
  label: string;
  hint: string;
}[] = [
  {
    id: 'replace',
    label: 'Replace audio',
    hint: 'Swap the video\'s soundtrack for the new audio',
  },
  {
    id: 'mix',
    label: 'Mix with original',
    hint: 'Blend the new audio over the video\'s own sound',
  },
] as const;

/** Containers we can stream-copy into (extension → copy-safe). */
const COPY_SAFE_EXTS = new Set([
  'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'ts', 'm2ts', 'mts',
]);

/** `true` when `-c copy` can write to this container extension. */
export function canStreamCopy(ext: string): boolean {
  return COPY_SAFE_EXTS.has(ext.toLowerCase());
}

/** Options for merging a second audio file onto the cut. */
export interface AudioMergeOpts {
  /** Filename of the audio input inside the ffmpeg FS. */
  inputName: string;
  /**
   * Positions of each copy of the audio clip on the video timeline
   * (seconds, may be negative). One `-i` is added per entry.
   */
  offsetsSec: number[];
  /** Loop each copy until the end of the cut. */
  loop: boolean;
  /** Replace the video's audio or mix over it. */
  mode: AudioMergeMode;
  /** Whether the video input actually has an audio stream (for `mix`). */
  hasAudio: boolean;
}

/**
 * Build the ffmpeg argument list for a video trim.
 *
 * When `opts.audio` is set, one `-i` per clip offset is added and each
 * copy is shifted onto the output timeline: a negative offset (audio
 * starts before the trim start) becomes an input `-ss` skip; a positive
 * offset becomes an `adelay`. `loop` adds `-stream_loop -1` so the copy
 * repeats to the end of the cut. Each clip is `atrim`/`apad`-ed to the
 * output duration; a single clip maps directly, multiple clips (or `mix`
 * mode with a video soundtrack) go through `amix`.
 */
export function buildVideoTrimArgs(
  inputName: string,
  outputFile: string,
  opts: {
    startSec: number;
    endSec: number;
    mode: TrimMode;
    crf?: number;
    audio?: AudioMergeOpts;
  },
): string[] {
  const args: string[] = [];
  const start = Math.max(0, opts.startSec);
  if (start > 0) args.push('-ss', formatTimestamp(start));
  args.push('-i', inputName);
  const dur = opts.endSec - start;

  // Clips starting at/after the trim end contribute nothing - drop them.
  const clips =
    opts.audio?.offsetsSec.filter((o) => o < opts.endSec) ?? [];
  const audio = clips.length ? opts.audio : undefined;
  if (audio) {
    // Offsets are on the video timeline; the output starts at `start`.
    for (const o of clips) {
      const skip = Math.max(0, start - o);
      if (audio.loop) args.push('-stream_loop', '-1');
      if (skip > 0) args.push('-ss', formatTimestamp(skip));
      args.push('-i', audio.inputName);
    }

    const outDur = Math.max(0.001, dur);
    const mixIn = audio.mode === 'mix' && audio.hasAudio;
    const solo = clips.length === 1 && !mixIn;
    const parts: string[] = [];
    const labels: string[] = [];
    clips.forEach((o, i) => {
      const delay = Math.max(0, o - start);
      const chain = ['aformat=sample_fmts=fltp'];
      if (delay > 0) chain.push(`adelay=delays=${Math.round(delay * 1000)}:all=1`);
      chain.push(`atrim=duration=${outDur.toFixed(3)}`);
      chain.push(`apad=whole_dur=${outDur.toFixed(3)}`);
      const label = solo ? 'aout' : `c${i}`;
      parts.push(`[${i + 1}:a]${chain.join(',')}[${label}]`);
      labels.push(`[${label}]`);
    });
    if (mixIn) {
      parts.unshift('[0:a]aformat=sample_fmts=fltp[a0]');
      labels.unshift('[a0]');
    }
    if (!solo) {
      parts.push(
        `${labels.join('')}amix=inputs=${labels.length}:duration=first:` +
          `normalize=0,atrim=duration=${outDur.toFixed(3)}[aout]`,
      );
    }
    args.push(
      '-filter_complex',
      parts.join(';'),
      '-map',
      '0:v:0',
      '-map',
      '[aout]',
    );
  }

  // Output duration limit - must come after all `-i` inputs.
  if (dur > 0) args.push('-t', formatTimestamp(dur));

  if (opts.mode === 'copy') {
    if (audio) {
      // `-c copy` would also copy the (filtered) audio - scope it to video.
      args.push('-c:v', 'copy', '-avoid_negative_ts', 'make_zero');
    } else {
      args.push('-c', 'copy', '-avoid_negative_ts', 'make_zero');
    }
  } else {
    args.push(
      '-c:v', 'libx264',
      '-crf', String(opts.crf ?? DEFAULT_CRF),
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
    );
    if (!audio) args.push('-c:a', 'aac', '-b:a', '128k');
    if (outputFile.endsWith('.mp4') || outputFile.endsWith('.mov')) {
      args.push('-movflags', '+faststart');
    }
  }
  if (audio) args.push('-c:a', 'aac', '-b:a', '160k');
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

export interface UseVideoTrimmerReturn {
  file: Ref<PickedFile | null>;
  duration: Ref<number>;
  startText: Ref<string>;
  endText: Ref<string>;
  mode: Ref<TrimMode>;
  crf: Ref<number>;
  /** Optional audio track merged onto the cut. */
  audioFile: Ref<PickedFile | null>;
  /** Audio clip duration in seconds (0 = unknown). */
  audioDuration: Ref<number>;
  /** Position of each copy of the clip on the video timeline (seconds). */
  audioOffsets: Ref<number[]>;
  /** Loop each copy until the end of the cut. */
  audioLoop: Ref<boolean>;
  audioMode: Ref<AudioMergeMode>;
  status: Ref<ConvertStatus>;
  progress: Ref<number>;
  error: Ref<string>;
  result: Ref<ConvertResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => void;
  onAudioFile: (file: File) => void;
  removeAudio: () => void;
  addAudioClip: (offsetSec?: number) => void;
  removeAudioClip: (index: number) => void;
  setAudioDuration: (sec: number) => void;
  setDuration: (sec: number) => void;
  trim: () => Promise<void>;
  download: () => void;
  clear: () => void;
}

export function useVideoTrimmer(): UseVideoTrimmerReturn {
  const file = ref<PickedFile | null>(null);
  const duration = ref<number>(0);
  const startText = ref<string>('');
  const endText = ref<string>('');
  const mode = ref<TrimMode>('copy');
  const crf = ref<number>(DEFAULT_CRF);
  const audioFile = ref<PickedFile | null>(null);
  const audioDuration = ref<number>(0);
  const audioOffsets = ref<number[]>([]);
  const audioLoop = ref<boolean>(false);
  const audioMode = ref<AudioMergeMode>('replace');
  const status = ref<ConvertStatus>('idle');
  const progress = ref<number>(0);
  const error = ref<string>('');
  const result = ref<ConvertResult | null>(null);

  let inputBytes: Uint8Array | null = null;
  let pendingFile: File | null = null;
  let audioBytes: Uint8Array | null = null;
  let pendingAudio: File | null = null;

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

  function revokeAudio(): void {
    if (audioFile.value) {
      URL.revokeObjectURL(audioFile.value.previewUrl);
      audioFile.value = null;
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
    duration.value = 0;
    file.value = {
      name: f.name || 'video',
      size: f.size,
      mimeType: f.type || '',
      previewUrl: URL.createObjectURL(f),
    };
    status.value = 'idle';
    progress.value = 0;
    // Stream copy only works into copy-safe containers; otherwise default
    // to re-encode so the output is always valid.
    mode.value = canStreamCopy(fileExtension(f.name)) ? 'copy' : 'reencode';
  }

  /** Called by the component when the `<video>` element reports metadata. */
  function setDuration(sec: number): void {
    if (Number.isFinite(sec) && sec > 0) {
      duration.value = sec;
      if (!endText.value) endText.value = formatTimestamp(sec);
    }
  }

  /**
   * Attach a second audio file to merge onto the cut. Audio and video
   * files are both accepted (the video's soundtrack is used); images are
   * rejected.
   */
  function onAudioFile(f: File): void {
    error.value = '';
    if (detectMediaKind(f.name, f.type) === 'image') {
      error.value = 'That looks like an image file - pick an audio file.';
      return;
    }
    if (f.size > MAX_AUDIO_FILE_SIZE) {
      error.value = `Audio file is too large (max ${formatBytes(MAX_AUDIO_FILE_SIZE)}).`;
      return;
    }
    revokeResult();
    revokeAudio();
    audioBytes = null;
    pendingAudio = f;
    audioDuration.value = 0;
    audioOffsets.value = [0];
    audioLoop.value = false;
    audioFile.value = {
      name: f.name || 'audio',
      size: f.size,
      mimeType: f.type || '',
      previewUrl: URL.createObjectURL(f),
    };
  }

  /** Called by the component when the `<audio>` element reports metadata. */
  function setAudioDuration(sec: number): void {
    if (Number.isFinite(sec) && sec > 0) audioDuration.value = sec;
  }

  function removeAudio(): void {
    revokeAudio();
    audioBytes = null;
    pendingAudio = null;
    audioDuration.value = 0;
    audioOffsets.value = [];
    audioLoop.value = false;
  }

  /**
   * Paste another copy of the audio clip onto the timeline at `offsetSec`
   * (defaults to the video start). Clamped so the copy keeps at least a
   * minimal overlap with the video.
   */
  function addAudioClip(offsetSec = 0): void {
    if (!audioFile.value) return;
    const clipLen = audioDuration.value > 0 ? audioDuration.value : duration.value;
    const lo = -(clipLen - 0.05);
    const hi = Math.max(0, duration.value - 0.05);
    audioOffsets.value = [
      ...audioOffsets.value,
      Math.min(hi, Math.max(lo, offsetSec)),
    ];
  }

  /** Remove one copy; removing the last clip removes the whole track. */
  function removeAudioClip(index: number): void {
    if (audioOffsets.value.length <= 1) {
      removeAudio();
      return;
    }
    audioOffsets.value = audioOffsets.value.filter((_, i) => i !== index);
  }

  async function trim(): Promise<void> {
    if (!pendingFile || !file.value) {
      error.value = 'Pick a video file first.';
      return;
    }
    const startSec = startText.value.trim() ? parseTimestamp(startText.value) : 0;
    const endSec = endText.value.trim()
      ? parseTimestamp(endText.value)
      : duration.value || null;
    if (startText.value.trim() && startSec === null) {
      error.value = `Invalid start time "${startText.value}".`;
      return;
    }
    if (endSec === null || endSec <= (startSec ?? 0)) {
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
      const srcExt = fileExtension(file.value.name) || 'mp4';
      const outExt =
        mode.value === 'copy' && canStreamCopy(srcExt) ? srcExt : 'mp4';
      const outName = `output.${outExt}`;
      await ffmpeg.writeFile(inName, inputBytes);

      // Optional merged audio track.
      let audioOpts: AudioMergeOpts | null = null;
      let audioName = '';
      if (pendingAudio && audioFile.value) {
        if (!audioOffsets.value.length) {
          throw new Error(
            'No audio clips on the timeline - add one or remove the track.',
          );
        }
        const clipDur = audioDuration.value;
        const overlapping = audioOffsets.value.filter((o) => {
          if (o >= endSec) return false;
          // A looping clip plays to the end once started; a plain clip
          // must still be playing when the trim range begins.
          if (audioLoop.value) return true;
          return clipDur <= 0 || o + clipDur > (startSec ?? 0);
        });
        if (!overlapping.length) {
          throw new Error(
            'None of the audio clips overlap the trimmed range - drag them onto the timeline.',
          );
        }
        if (!audioBytes) audioBytes = await blobToBytes(pendingAudio);
        audioName = safeFsName(audioFile.value.name, 'input.audio');
        await ffmpeg.writeFile(audioName, audioBytes);
        // Probe the video for an audio stream so `mix` can fall back to
        // `replace` when there is nothing to mix with.
        const probe = await probeJson<{ streams?: { codec_type?: string }[] }>(
          ffmpeg,
          inName,
          ['-show_streams'],
        );
        const hasAudio =
          probe?.streams?.some((s) => s.codec_type === 'audio') ?? false;
        audioOpts = {
          inputName: audioName,
          offsetsSec: overlapping,
          loop: audioLoop.value,
          mode: audioMode.value,
          hasAudio,
        };
      }

      try {
        const args = buildVideoTrimArgs(inName, outName, {
          startSec: startSec ?? 0,
          endSec,
          mode: mode.value,
          crf: crf.value,
          audio: audioOpts ?? undefined,
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
        if (audioName) await deleteQuiet(ffmpeg, audioName);
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
    removeAudio();
    inputBytes = null;
    pendingFile = null;
    duration.value = 0;
    startText.value = '';
    endText.value = '';
    status.value = 'idle';
    progress.value = 0;
    error.value = '';
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.start === 'string' || typeof p.start === 'number') {
        startText.value = String(p.start);
      }
      if (typeof p.end === 'string' || typeof p.end === 'number') {
        endText.value = String(p.end);
      }
      if (p.mode === 'copy' || p.mode === 'reencode') mode.value = p.mode;
      if (typeof p.crf === 'number' && Number.isFinite(p.crf)) {
        crf.value = Math.min(CRF_MAX, Math.max(CRF_MIN, Math.round(p.crf)));
      }
      if (
        Array.isArray(p.audioOffsets) &&
        p.audioOffsets.every((o) => typeof o === 'number' && Number.isFinite(o))
      ) {
        audioOffsets.value = p.audioOffsets as number[];
      } else if (
        typeof p.audioOffset === 'number' &&
        Number.isFinite(p.audioOffset)
      ) {
        audioOffsets.value = [p.audioOffset];
      }
      if (typeof p.audioLoop === 'boolean') audioLoop.value = p.audioLoop;
      if (p.audioMode === 'replace' || p.audioMode === 'mix') {
        audioMode.value = p.audioMode;
      }
      if (typeof p.audioUrl === 'string' && p.audioUrl.length > 0) {
        void (async () => {
          try {
            const res = await fetch(p.audioUrl as string);
            if (!res.ok) {
              error.value = `Failed to fetch audio URL (${res.status}).`;
              return;
            }
            const blob = await res.blob();
            const name =
              typeof p.audioFileName === 'string' && p.audioFileName
                ? p.audioFileName
                : (p.audioUrl as string).split('/').pop() || 'audio';
            onAudioFile(new File([blob], name, { type: blob.type }));
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch audio URL.';
          }
        })();
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
    revokeAudio();
  });

  return {
    file,
    duration,
    startText,
    endText,
    mode,
    crf,
    audioFile,
    audioDuration,
    audioOffsets,
    audioLoop,
    audioMode,
    status,
    progress,
    error,
    result,
    isEmbed,
    embedInput,
    onFile,
    onAudioFile,
    removeAudio,
    addAudioClip,
    removeAudioClip,
    setAudioDuration,
    setDuration,
    trim,
    download,
    clear,
  };
}
