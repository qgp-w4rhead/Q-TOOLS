<script setup lang="ts">
/**
 * CameraRecorder — record video from the webcam via `getUserMedia` +
 * `MediaRecorder`, preview the recording, and download it as WebM (or MP4
 * where the browser supports it).
 *
 * Controls:
 *   - Resolution preset (640x480 / 1280x720 / 1920x1080 / 3840x2160)
 *   - MIME type (filtered to those the browser reports as supported)
 *   - Start / stop camera
 *   - Start / stop recording
 *   - Preview the recorded clip
 *   - Download + clear
 *
 * No external dependencies — uses native browser APIs only. Requires a
 * secure context (HTTPS or localhost); in an iframe the parent must set
 * `allow="camera; microphone"`.
 *
 * Embed mode: receives `resolution`/`mimeType`/`action` PostMessages and
 * sends status outputs (`isRecording`, `isCameraOn`, `hasRecording`,
 * `durationSeconds`, `recordedSizeBytes`, `recordedMime`, `error`).
 */
import { computed, ref, watch } from 'vue';
import {
  Video,
  VideoOff,
  Circle,
  Square,
  Download,
  Trash2,
  Play,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useCameraRecorder,
  formatDuration,
  mimeExtension,
  RESOLUTION_PRESETS,
  DEFAULT_RESOLUTION,
  DEFAULT_MIME,
} from './useCameraRecorder';

const {
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
  startCamera,
  stopCamera,
  startRecording,
  stopRecording,
  downloadRecording,
  clearRecording,
} = useCameraRecorder();

// Template refs — owned by the component so vue-tsc sees them used in script.
const videoElement = ref<HTMLVideoElement | null>(null);
const previewElement = ref<HTMLVideoElement | null>(null);

// Bind the live camera stream to the live <video> element.
watch(stream, (s) => {
  const v = videoElement.value;
  if (!v) return;
  // TypeScript's lib.dom types `srcObject` as `MediaProvider | null`.
  v.srcObject = s;
  if (s) {
    void v.play().catch(() => {
      // Autoplay can be blocked; the user can press play. Not fatal.
    });
  } else {
    try {
      v.removeAttribute('src');
      v.load();
    } catch {
      /* ignore */
    }
  }
});

// Bind the recorded blob URL to the preview <video> element.
watch(recordedBlobUrl, (url) => {
  const p = previewElement.value;
  if (!p) return;
  if (url) {
    p.src = url;
    void p.play().catch(() => {
      // Autoplay can be blocked; the user can press play. Not fatal.
    });
  } else {
    try {
      p.removeAttribute('src');
      p.load();
    } catch {
      /* ignore */
    }
  }
});

const resolutionOptions = Object.keys(RESOLUTION_PRESETS) as (keyof typeof RESOLUTION_PRESETS)[];

const mimeOptions = computed<string[]>(() => {
  // Always include the default MIME so the select is never empty; the
  // browser will fall back to its own default if the chosen one is not
  // actually supported at record time.
  const list = supportedMimeTypes.value.slice();
  if (list.length === 0) return [DEFAULT_MIME];
  if (!list.includes(DEFAULT_MIME)) list.push(DEFAULT_MIME);
  return list;
});

const durationLabel = computed(() => formatDuration(durationSeconds.value));
const sizeLabel = computed(() => {
  const bytes = recordedSizeBytes.value;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
});
const fileExt = computed(() => mimeExtension(recordedMime.value || mimeType.value));

function onResolution(e: Event): void {
  resolution.value = (e.target as HTMLSelectElement).value as keyof typeof RESOLUTION_PRESETS;
}
function onMime(e: Event): void {
  mimeType.value = (e.target as HTMLSelectElement).value;
}

function toggleCamera(): void {
  if (isCameraOn.value) stopCamera();
  else void startCamera();
}

function toggleRecord(): void {
  if (isRecording.value) stopRecording();
  else void startRecording();
}

function resetOptions(): void {
  resolution.value = DEFAULT_RESOLUTION;
  mimeType.value = supportedMimeTypes.value[0] ?? DEFAULT_MIME;
}
</script>

<template>
  <div class="camrec">
    <ToolInput
      title="Input"
      description="Pick a resolution and codec, then start the camera and record."
    >
      <template #actions>
        <button
          type="button"
          class="camrec__reset-btn"
          title="Reset options to defaults"
          @click="resetOptions"
        >
          Reset
        </button>
      </template>

      <div class="camrec__opts">
        <label class="camrec__field">
          <span class="camrec__label">Resolution</span>
          <select
            class="camrec__select"
            :value="resolution"
            @change="onResolution"
          >
            <option v-for="r in resolutionOptions" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>

        <label class="camrec__field">
          <span class="camrec__label">MIME type</span>
          <select
            class="camrec__select"
            :value="mimeType"
            @change="onMime"
          >
            <option v-for="m in mimeOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
      </div>

      <div class="camrec__notice">
        <ShieldAlert :size="14" />
        <span>
          Requires HTTPS (or localhost). In an iframe the parent must set
          <code>allow="camera; microphone"</code>.
        </span>
      </div>
    </ToolInput>

    <ToolOutput
      title="Camera"
      :description="isRecording ? `Recording · ${durationLabel}` : (isCameraOn ? 'Camera live' : 'Camera off')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="camrec__btn camrec__btn--toggle"
          :class="{ 'camrec__btn--on': isCameraOn }"
          :disabled="isRecording"
          :title="isCameraOn ? 'Stop camera' : 'Start camera'"
          @click="toggleCamera"
        >
          <component :is="isCameraOn ? VideoOff : Video" :size="14" />
          {{ isCameraOn ? 'Stop camera' : 'Start camera' }}
        </button>
        <button
          type="button"
          class="camrec__btn"
          :class="isRecording ? 'camrec__btn--recording' : 'camrec__btn--record'"
          :disabled="!isCameraOn"
          :title="isRecording ? 'Stop recording' : 'Start recording'"
          @click="toggleRecord"
        >
          <component :is="isRecording ? Square : Circle" :size="14" />
          {{ isRecording ? 'Stop' : 'Record' }}
        </button>
      </template>

      <div v-if="error" class="camrec__error">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div class="camrec__stage">
        <div class="camrec__live">
          <video
            ref="videoElement"
            class="camrec__video"
            autoplay
            muted
            playsinline
          />
          <div v-if="!isCameraOn" class="camrec__overlay">
            <Video :size="40" class="camrec__overlay-icon" />
            <span>Camera is off. Press “Start camera” to begin.</span>
          </div>
          <div v-if="isRecording" class="camrec__rec-badge">
            <span class="camrec__rec-dot" /> REC · {{ durationLabel }}
          </div>
        </div>
      </div>
    </ToolOutput>

    <ToolOutput
      title="Recording"
      :description="hasRecording ? `${sizeLabel} · ${fileExt.toUpperCase()} · ${durationLabel}` : 'No recording yet.'"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="camrec__btn"
          :disabled="!hasRecording"
          title="Download recording"
          @click="downloadRecording"
        >
          <Download :size="14" /> Download
        </button>
        <button
          type="button"
          class="camrec__btn"
          :disabled="!hasRecording"
          title="Clear recording"
          @click="clearRecording"
        >
          <Trash2 :size="14" /> Clear
        </button>
      </template>

      <div v-if="hasRecording" class="camrec__preview">
        <video
          ref="previewElement"
          class="camrec__video camrec__video--preview"
          controls
          playsinline
        />
        <div class="camrec__preview-meta">
          <span class="camrec__pill"><Play :size="11" /> {{ durationLabel }}</span>
          <span class="camrec__pill">{{ sizeLabel }}</span>
          <span class="camrec__pill">{{ recordedMime }}</span>
        </div>
      </div>
      <div v-else class="camrec__placeholder">
        <Video :size="40" class="camrec__placeholder-icon" />
        <span>Start the camera, then press Record to capture a clip.</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.camrec {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
}
.camrec__opts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.camrec__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.camrec__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
}
.camrec__select {
  width: 100%;
  padding: 8px 10px;
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  outline: none;
  cursor: pointer;
}
.camrec__select:focus {
  border-color: var(--qt-accent);
}
.camrec__notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--qt-radius);
  background: oklch(from var(--qt-warning, #f59e0b) 25% c h / 10%);
  color: var(--qt-warning, #f59e0b);
  font-size: 12px;
}
.camrec__notice code {
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  background: oklch(from var(--qt-warning, #f59e0b) 30% c h / 18%);
  padding: 1px 5px;
  border-radius: 4px;
}
.camrec__reset-btn,
.camrec__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.camrec__reset-btn:hover,
.camrec__btn:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.camrec__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.camrec__btn--toggle.camrec__btn--on {
  border-color: var(--qt-danger, #ef4444);
  color: var(--qt-danger, #ef4444);
}
.camrec__btn--record {
  border-color: var(--qt-danger, #ef4444);
  color: var(--qt-danger, #ef4444);
}
.camrec__btn--record:hover:not(:disabled) {
  background: oklch(from var(--qt-danger, #ef4444) 55% c h / 12%);
}
.camrec__btn--recording {
  background: var(--qt-danger, #ef4444);
  border-color: var(--qt-danger, #ef4444);
  color: #fff;
}
.camrec__btn--recording:hover:not(:disabled) {
  color: #fff;
  opacity: 0.9;
}
.camrec__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--qt-radius);
  background: oklch(from var(--qt-warning, #f59e0b) 25% c h / 12%);
  color: var(--qt-warning, #f59e0b);
  font-size: 13px;
}
.camrec__stage {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.camrec__live {
  position: relative;
  width: 100%;
  background: #000;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  overflow: hidden;
  aspect-ratio: 16 / 9;
}
.camrec__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.camrec__video--preview {
  border-radius: var(--qt-radius);
}
.camrec__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
  padding: 16px;
  pointer-events: none;
}
.camrec__overlay-icon {
  opacity: 0.5;
}
.camrec__rec-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}
.camrec__rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--qt-danger, #ef4444);
  animation: camrec-pulse 1s ease-in-out infinite;
}
@keyframes camrec-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.camrec__preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.camrec__preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.camrec__pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.camrec__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 16px;
  color: var(--qt-muted);
  text-align: center;
  font-size: 13px;
}
.camrec__placeholder-icon {
  opacity: 0.4;
}
</style>
