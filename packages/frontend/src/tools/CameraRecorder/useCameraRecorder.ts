/**
 * useCameraRecorder - composable + pure logic for the camera recorder tool.
 *
 * Records video from the user's webcam using the native `getUserMedia` +
 * `MediaRecorder` APIs. No external dependencies.
 *
 * Pure helpers (`parseResolution`, `formatDuration`, `listSupportedMimeTypes`,
 * `pickPreferredMimeType`, `isSecureContextAvailable`, `mimeExtension`) have
 * no Vue dependency and can be imported standalone for unit testing or reuse.
 * The `useCameraRecorder()` composable wraps them in reactive state, manages
 * the camera stream + MediaRecorder lifecycle, and wires up the embed
 * PostMessage protocol.
 *
 * The composable does NOT touch the DOM directly - it exposes the live
 * `stream` and the `recordedBlobUrl` so the component can bind them to
 * `<video>` elements via watchers. This keeps the composable testable and
 * lets the component own template-ref lifecycle.
 *
 * Browser-only: the composable guards every Web-API call so it degrades
 * gracefully (surfacing a descriptive error) when APIs are missing - e.g.
 * during SSR or when the page is served over HTTP (getUserMedia requires a
 * secure context).
 */
import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** Resolution preset identifier (also the `<option>` value). */
export type ResolutionPreset =
  | '640x480'
  | '1280x720'
  | '1920x1080'
  | '3840x2160';

export interface Resolution {
  width: number;
  height: number;
}

export const RESOLUTION_PRESETS: Record<ResolutionPreset, Resolution> = {
  '640x480': { width: 640, height: 480 },
  '1280x720': { width: 1280, height: 720 },
  '1920x1080': { width: 1920, height: 1080 },
  '3840x2160': { width: 3840, height: 2160 },
};

export const DEFAULT_RESOLUTION: ResolutionPreset = '1280x720';

/**
 * MIME types we offer in the UI, in preference order. The user can pick any
 * one the browser reports as supported via `MediaRecorder.isTypeSupported`.
 */
export const MIME_CANDIDATES: readonly string[] = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/webm;codecs=h264',
  'video/mp4',
] as const;

export const DEFAULT_MIME = 'video/webm';

/** File extension to use for downloads, derived from the chosen MIME type. */
export function mimeExtension(mime: string): string {
  if (mime.startsWith('video/mp4')) return 'mp4';
  return 'webm';
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Parse a resolution preset string (`"1280x720"`) into `{ width, height }`.
 * Returns `null` when the string is not a recognised `WxH` form.
 */
export function parseResolution(value: string): Resolution | null {
  const m = /^(\d+)x(\d+)$/.exec((value ?? '').trim().toLowerCase());
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

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

/**
 * Return the subset of `MIME_CANDIDATES` that the current browser reports as
 * supported by `MediaRecorder.isTypeSupported`. Returns an empty array when
 * `MediaRecorder` is unavailable (e.g. SSR, insecure context, very old
 * browser). Pure with respect to the browser API surface - no Vue refs.
 */
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

/**
 * Pick the first supported MIME from `MIME_CANDIDATES`, falling back to
 * `DEFAULT_MIME` when none are explicitly supported (browsers always pick a
 * default when `MediaRecorder` is constructed without a `mimeType`).
 */
export function pickPreferredMimeType(): string {
  const supported = listSupportedMimeTypes();
  return supported[0] ?? DEFAULT_MIME;
}

/** `true` when the current context is "secure" (HTTPS or localhost). */
export function isSecureContextAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  return window.isSecureContext === true && !!navigator.mediaDevices;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + camera/MediaRecorder lifecycle               */
/* -------------------------------------------------------------------------- */

export interface UseCameraRecorderReturn {
  resolution: Ref<ResolutionPreset>;
  mimeType: Ref<string>;
  supportedMimeTypes: Ref<string[]>;
  /** Live camera stream - bind to a `<video>` element's `srcObject`. */
  stream: Ref<MediaStream | null>;
  /** Object URL of the latest recording - bind to a `<video>` element's `src`. */
  recordedBlobUrl: Ref<string | null>;
  isRecording: Ref<boolean>;
  isCameraOn: Ref<boolean>;
  hasRecording: Ref<boolean>;
  recordedSizeBytes: Ref<number>;
  recordedMime: Ref<string>;
  durationSeconds: Ref<number>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  downloadRecording: () => void;
  clearRecording: () => void;
}

export function useCameraRecorder(): UseCameraRecorderReturn {
  const resolution = ref<ResolutionPreset>(DEFAULT_RESOLUTION);
  const supported = listSupportedMimeTypes();
  const mimeType = ref<string>(pickPreferredMimeType());
  const supportedMimeTypes = ref<string[]>(supported);

  const isRecording = ref<boolean>(false);
  const isCameraOn = ref<boolean>(false);
  const hasRecording = ref<boolean>(false);
  const recordedBlobUrl = ref<string | null>(null);
  const recordedSizeBytes = ref<number>(0);
  const recordedMime = ref<string>(DEFAULT_MIME);
  const durationSeconds = ref<number>(0);
  const error = ref<string | null>(null);

  // `shallowRef` for non-reactive heavy objects (streams, recorders).
  const stream = shallowRef<MediaStream | null>(null);
  const recorder = shallowRef<MediaRecorder | null>(null);
  const chunks = shallowRef<BlobPart[]>([]);

  let durationTimer: ReturnType<typeof setInterval> | null = null;

  /* ----------------------------- helpers -------------------------------- */

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
    isCameraOn.value = false;
  }

  function fail(message: string): void {
    error.value = message;
    isRecording.value = false;
  }

  /* --------------------------- camera control --------------------------- */

  async function startCamera(): Promise<void> {
    error.value = null;
    if (!isSecureContextAvailable()) {
      fail(
        'Camera access requires a secure context (HTTPS or localhost). ' +
          'In an iframe the parent must also set allow="camera; microphone".',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      fail('getUserMedia is not available in this browser.');
      return;
    }
    const dims = RESOLUTION_PRESETS[resolution.value] ?? parseResolution(resolution.value);
    if (!dims) {
      fail(`Unknown resolution preset: ${resolution.value}`);
      return;
    }
    // Stop any existing stream before requesting a new one.
    stopStream();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: dims.width },
          height: { ideal: dims.height },
        },
        audio: true,
      });
      stream.value = s;
      isCameraOn.value = true;
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        fail('Permission denied: camera/microphone access was blocked.');
      } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
        fail('No suitable camera/microphone device found for the requested resolution.');
      } else if (e?.name === 'NotReadableError') {
        fail('The camera is already in use by another application.');
      } else {
        fail(e?.message || 'Failed to access the camera.');
      }
    }
  }

  function stopCamera(): void {
    if (isRecording.value) {
      stopRecording();
    }
    stopStream();
  }

  /* -------------------------- recording control ------------------------- */

  async function startRecording(): Promise<void> {
    error.value = null;
    const s = stream.value;
    if (!s || !s.active) {
      // Auto-start the camera if it isn't already on.
      await startCamera();
      if (!stream.value) return; // startCamera already set the error.
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
        videoBitsPerSecond: 5_000_000,
      });
    } catch {
      // Fallback: construct without an explicit mimeType (browser default).
      try {
        rec = new MediaRecorder(activeStream);
        // Reflect the actually-used MIME back into the state.
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
      // Revoke any previous URL to avoid leaking blob URLs.
      if (recordedBlobUrl.value) {
        URL.revokeObjectURL(recordedBlobUrl.value);
      }
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
      rec.start(1000); // gather data in 1s chunks for resilience
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
    // isRecording flips to false in the `onstop` handler; flip immediately
    // too so the UI is responsive even if onstop is delayed.
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
    a.download = `q-tools-recording-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function clearRecording(): void {
    if (recordedBlobUrl.value) {
      URL.revokeObjectURL(recordedBlobUrl.value);
    }
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
      if (typeof p.resolution === 'string' && parseResolution(p.resolution)) {
        resolution.value = p.resolution as ResolutionPreset;
      }
      if (typeof p.mimeType === 'string') {
        // Only accept MIME types the browser actually supports.
        if (supportedMimeTypes.value.includes(p.mimeType)) {
          mimeType.value = p.mimeType;
        }
      }
      if (typeof p.action === 'string') {
        if (p.action === 'start-camera') void startCamera();
        else if (p.action === 'stop-camera') stopCamera();
        else if (p.action === 'start-recording') void startRecording();
        else if (p.action === 'stop-recording') stopRecording();
        else if (p.action === 'clear') clearRecording();
      }
    },
  });

  // Push status updates to the parent in embed mode. Blob URLs are not
  // meaningful across frames, so we send status + metadata only.
  watch(
    [
      isRecording,
      isCameraOn,
      hasRecording,
      durationSeconds,
      recordedSizeBytes,
      recordedMime,
      resolution,
      mimeType,
      error,
    ],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        isRecording: isRecording.value,
        isCameraOn: isCameraOn.value,
        hasRecording: hasRecording.value,
        durationSeconds: durationSeconds.value,
        recordedSizeBytes: recordedSizeBytes.value,
        recordedMime: recordedMime.value,
        resolution: resolution.value,
        mimeType: mimeType.value,
        error: error.value ?? undefined,
      });
    },
  );

  /* --------------------------- lifecycle cleanup ------------------------ */

  onBeforeUnmount(() => {
    stopRecording();
    stopCamera();
    if (recordedBlobUrl.value) {
      URL.revokeObjectURL(recordedBlobUrl.value);
      recordedBlobUrl.value = null;
    }
    clearDurationTimer();
  });

  return {
    resolution,
    mimeType,
    supportedMimeTypes,
    stream,
    recordedBlobUrl,
    isRecording,
    isCameraOn,
    hasRecording,
    recordedSizeBytes,
    recordedMime,
    durationSeconds,
    error,
    isEmbed,
    embedInput,
    startCamera,
    stopCamera,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
  };
}
