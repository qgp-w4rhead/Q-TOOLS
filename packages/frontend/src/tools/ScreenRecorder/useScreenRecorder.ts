/**
 * useScreenRecorder - composable + pure logic for the screen recorder tool.
 *
 * Records the screen / window / browser tab via `getDisplayMedia` +
 * `MediaRecorder`. No external dependencies. Optionally captures system or
 * tab audio when the browser offers it (Chrome/Edge tab + screen audio).
 *
 * Pure helpers (`listSupportedMimeTypes`, `pickPreferredMimeType`,
 * `mimeExtension`, `isDisplayCaptureAvailable`) have no Vue dependency and
 * can be imported standalone. The composable manages the display stream +
 * MediaRecorder lifecycle and wires up the embed PostMessage protocol.
 *
 * Requires a secure context (HTTPS or localhost); in an iframe the parent
 * must set `allow="display-capture"`.
 */
import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** MIME types offered in the UI, in preference order. */
export const MIME_CANDIDATES: readonly string[] = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/webm;codecs=h264,opus',
  'video/mp4',
] as const;

export const DEFAULT_MIME = 'video/webm';

/** File extension for downloads, derived from the chosen MIME type. */
export function mimeExtension(mime: string): string {
  if (mime.startsWith('video/mp4')) return 'mp4';
  return 'webm';
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** Format a non-negative duration in seconds as `MM:SS` (or `H:MM:SS`). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number): string => n.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Return the subset of `MIME_CANDIDATES` supported by `MediaRecorder`. */
export function listSupportedMimeTypes(): string[] {
  if (typeof MediaRecorder === 'undefined') return [];
  try {
    return MIME_CANDIDATES.filter((m) => {
      try {
        return MediaRecorder.isTypeSupported(m);
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/** Pick the first supported MIME, falling back to `DEFAULT_MIME`. */
export function pickPreferredMimeType(): string {
  return listSupportedMimeTypes()[0] ?? DEFAULT_MIME;
}

/** `true` when `getDisplayMedia` is available in a secure context. */
export function isDisplayCaptureAvailable(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return window.isSecureContext === true && !!navigator.mediaDevices?.getDisplayMedia;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseScreenRecorderReturn {
  mimeType: Ref<string>;
  supportedMimeTypes: Ref<string[]>;
  includeAudio: Ref<boolean>;
  /** Live capture stream - bind to a `<video>` element's `srcObject`. */
  stream: Ref<MediaStream | null>;
  /** Object URL of the latest recording - bind to a `<video>` element's `src`. */
  recordedBlobUrl: Ref<string | null>;
  isRecording: Ref<boolean>;
  isCapturing: Ref<boolean>;
  hasRecording: Ref<boolean>;
  recordedSizeBytes: Ref<number>;
  recordedMime: Ref<string>;
  durationSeconds: Ref<number>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  downloadRecording: () => void;
  clearRecording: () => void;
}

export function useScreenRecorder(): UseScreenRecorderReturn {
  const supported = listSupportedMimeTypes();
  const mimeType = ref<string>(pickPreferredMimeType());
  const supportedMimeTypes = ref<string[]>(supported);
  const includeAudio = ref<boolean>(true);

  const isRecording = ref<boolean>(false);
  const isCapturing = ref<boolean>(false);
  const hasRecording = ref<boolean>(false);
  const recordedBlobUrl = ref<string | null>(null);
  const recordedSizeBytes = ref<number>(0);
  const recordedMime = ref<string>(DEFAULT_MIME);
  const durationSeconds = ref<number>(0);
  const error = ref<string | null>(null);

  const stream = shallowRef<MediaStream | null>(null);
  const recorder = shallowRef<MediaRecorder | null>(null);
  const chunks = shallowRef<BlobPart[]>([]);

  let durationTimer: ReturnType<typeof setInterval> | null = null;

  function clearDurationTimer(): void {
    if (durationTimer !== null) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
  }

  function stopStream(): void {
    const s = stream.value;
    if (s) {
      for (const track of s.getTracks()) {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      }
    }
    stream.value = null;
    isCapturing.value = false;
  }

  function fail(message: string): void {
    error.value = message;
    isRecording.value = false;
  }

  /* --------------------------- capture control --------------------------- */

  async function startCapture(): Promise<void> {
    error.value = null;
    if (!isDisplayCaptureAvailable()) {
      fail(
        'Screen capture requires a secure context (HTTPS or localhost) and a ' +
          'browser with getDisplayMedia. In an iframe the parent must set ' +
          'allow="display-capture".',
      );
      return;
    }
    stopStream();
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: includeAudio.value,
      });
      stream.value = s;
      isCapturing.value = true;
      // When the user stops sharing via the browser UI, reflect it.
      const track = s.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          if (isRecording.value) stopRecording();
          stopStream();
        };
      }
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        fail('Permission denied: screen capture was blocked or cancelled.');
      } else if (e?.name === 'NotFoundError') {
        fail('No screen/window/tab source available.');
      } else if (e?.name === 'NotReadableError') {
        fail('The selected source is already in use.');
      } else {
        fail(e?.message || 'Failed to start screen capture.');
      }
    }
  }

  function stopCapture(): void {
    if (isRecording.value) stopRecording();
    stopStream();
  }

  /* -------------------------- recording control ------------------------- */

  async function startRecording(): Promise<void> {
    error.value = null;
    if (!stream.value || !stream.value.active) {
      await startCapture();
      if (!stream.value) return;
    }
    if (typeof MediaRecorder === 'undefined') {
      fail('MediaRecorder is not available in this browser.');
      return;
    }
    const activeStream = stream.value!;
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(activeStream, {
        mimeType: mimeType.value,
        videoBitsPerSecond: 8_000_000,
      });
    } catch {
      try {
        rec = new MediaRecorder(activeStream);
        mimeType.value = rec.mimeType || DEFAULT_MIME;
      } catch (err2) {
        fail((err2 as Error)?.message || 'Failed to create a MediaRecorder.');
        return;
      }
    }

    chunks.value = [];
    recordedSizeBytes.value = 0;
    durationSeconds.value = 0;
    rec.ondataavailable = (ev: BlobEvent) => {
      if (ev.data && ev.data.size > 0) {
        chunks.value.push(ev.data);
        recordedSizeBytes.value += ev.data.size;
      }
    };
    rec.onstop = () => {
      const blob = new Blob(chunks.value, { type: rec.mimeType || mimeType.value });
      if (recordedBlobUrl.value) URL.revokeObjectURL(recordedBlobUrl.value);
      recordedBlobUrl.value = URL.createObjectURL(blob);
      recordedMime.value = blob.type || rec.mimeType || mimeType.value;
      hasRecording.value = true;
      isRecording.value = false;
      clearDurationTimer();
    };
    rec.onerror = () => {
      fail('MediaRecorder reported an error during recording.');
      isRecording.value = false;
      clearDurationTimer();
    };

    try {
      rec.start(1000);
      recorder.value = rec;
      isRecording.value = true;
      hasRecording.value = false;
      clearDurationTimer();
      durationTimer = setInterval(() => {
        durationSeconds.value += 1;
      }, 1000);
    } catch (err) {
      fail((err as Error)?.message || 'Failed to start recording.');
    }
  }

  function stopRecording(): void {
    const rec = recorder.value;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    recorder.value = null;
    isRecording.value = false;
    clearDurationTimer();
  }

  /* ----------------------------- downloads ------------------------------ */

  function downloadRecording(): void {
    const url = recordedBlobUrl.value;
    if (!url) return;
    const ext = mimeExtension(recordedMime.value);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = url;
    a.download = `q-tools-screen-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function clearRecording(): void {
    if (recordedBlobUrl.value) URL.revokeObjectURL(recordedBlobUrl.value);
    recordedBlobUrl.value = null;
    recordedSizeBytes.value = 0;
    hasRecording.value = false;
    durationSeconds.value = 0;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mimeType === 'string' && supportedMimeTypes.value.includes(p.mimeType)) {
        mimeType.value = p.mimeType;
      }
      if (typeof p.includeAudio === 'boolean') includeAudio.value = p.includeAudio;
      if (typeof p.action === 'string') {
        if (p.action === 'start-capture') void startCapture();
        else if (p.action === 'stop-capture') stopCapture();
        else if (p.action === 'start-recording') void startRecording();
        else if (p.action === 'stop-recording') stopRecording();
        else if (p.action === 'clear') clearRecording();
      }
    },
  });

  watch(
    [
      isRecording,
      isCapturing,
      hasRecording,
      durationSeconds,
      recordedSizeBytes,
      recordedMime,
      mimeType,
      includeAudio,
      error,
    ],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        isRecording: isRecording.value,
        isCapturing: isCapturing.value,
        hasRecording: hasRecording.value,
        durationSeconds: durationSeconds.value,
        recordedSizeBytes: recordedSizeBytes.value,
        recordedMime: recordedMime.value,
        mimeType: mimeType.value,
        includeAudio: includeAudio.value,
        error: error.value ?? undefined,
      });
    },
  );

  onBeforeUnmount(() => {
    stopRecording();
    stopCapture();
    if (recordedBlobUrl.value) URL.revokeObjectURL(recordedBlobUrl.value);
    clearDurationTimer();
  });

  return {
    mimeType,
    supportedMimeTypes,
    includeAudio,
    stream,
    recordedBlobUrl,
    isRecording,
    isCapturing,
    hasRecording,
    recordedSizeBytes,
    recordedMime,
    durationSeconds,
    error,
    isEmbed,
    embedInput,
    startCapture,
    stopCapture,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
  };
}
