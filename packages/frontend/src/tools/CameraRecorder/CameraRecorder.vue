<script setup lang="ts">
/**
 * CameraRecorder - record video from the webcam via `getUserMedia` +
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
 * No external dependencies - uses native browser APIs only. Requires a
 * secure context (HTTPS or localhost); in an iframe the parent must set
 * `allow="camera; microphone"`.
 *
 * Embed mode: receives `resolution`/`mimeType`/`action` PostMessages and
 * sends status outputs (`isRecording`, `isCameraOn`, `hasRecording`,
 * `durationSeconds`, `recordedSizeBytes`, `recordedMime`, `error`).
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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

// Template refs - owned by the component so vue-tsc sees them used in script.
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

const { t } = useI18n();
const U = 'tools.camera-recorder.ui.';

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
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :title="t(U + 'resetTitle')"
          @click="resetOptions"
        >
          {{ t('common.reset') }}
        </button>
      </template>

      <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'resolution') }}</span>
          <select
            class="qt-input qt-input--mono"
            style="font-size:12px"
            :value="resolution"
            @change="onResolution"
          >
            <option v-for="r in resolutionOptions" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'mimeType') }}</span>
          <select
            class="qt-input qt-input--mono"
            style="font-size:12px"
            :value="mimeType"
            @change="onMime"
          >
            <option v-for="m in mimeOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>
      </div>

      <div class="qt-banner qt-banner--warn camrec__notice" style="font-size:12px;align-items:center">
        <ShieldAlert :size="14" />
        <span>
          {{ t(U + 'httpsNotice') }}
          <code>allow="camera; microphone"</code>.
        </span>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputCamera')"
      :description="isRecording ? t(U + 'descRecording', { duration: durationLabel }) : (isCameraOn ? t(U + 'descLive') : t(U + 'descOff'))"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm camrec__btn--toggle"
          :class="{ 'camrec__btn--on': isCameraOn }"
          :disabled="isRecording"
          :title="isCameraOn ? t(U + 'stopCamera') : t(U + 'startCamera')"
          @click="toggleCamera"
        >
          <component :is="isCameraOn ? VideoOff : Video" :size="14" />
          {{ isCameraOn ? t(U + 'stopCamera') : t(U + 'startCamera') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :class="isRecording ? 'camrec__btn--recording' : 'camrec__btn--record'"
          :disabled="!isCameraOn"
          :title="isRecording ? t(U + 'stopRecording') : t(U + 'startRecording')"
          @click="toggleRecord"
        >
          <component :is="isRecording ? Square : Circle" :size="14" />
          {{ isRecording ? t(U + 'stop') : t(U + 'record') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
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
            <span>{{ t(U + 'cameraOffOverlay') }}</span>
          </div>
          <div v-if="isRecording" class="camrec__rec-badge">
            <span class="camrec__rec-dot" /> {{ t(U + 'recBadge', { duration: durationLabel }) }}
          </div>
        </div>
      </div>
    </ToolOutput>

    <ToolOutput
      :title="t(U + 'outputRecording')"
      :description="hasRecording ? t(U + 'descRecordingMeta', { size: sizeLabel, ext: fileExt.toUpperCase(), duration: durationLabel }) : t(U + 'descNoRecording')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!hasRecording"
          :title="t(U + 'downloadRecording')"
          @click="downloadRecording"
        >
          <Download :size="14" /> {{ t('common.download') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!hasRecording"
          :title="t(U + 'clearRecording')"
          @click="clearRecording"
        >
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="hasRecording" class="qt-stack" style="--qt-stack-gap:10px">
        <video
          ref="previewElement"
          class="camrec__video camrec__video--preview"
          controls
          playsinline
        />
        <div class="qt-row" style="--qt-row-gap:6px">
          <span class="qt-badge"><Play :size="11" /> {{ durationLabel }}</span>
          <span class="qt-badge">{{ sizeLabel }}</span>
          <span class="qt-badge">{{ recordedMime }}</span>
        </div>
      </div>
      <div v-else class="camrec__placeholder">
        <Video :size="40" class="camrec__placeholder-icon" />
        <span>{{ t(U + 'emptyRecording') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Inline code chip inside the warn banner. */
.camrec__notice code {
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  background: oklch(from var(--qt-warning, #f59e0b) 30% c h / 18%);
  padding: 1px 5px;
  border-radius: 4px;
}
/* Camera toggle (base via .qt-btn--ghost) — danger outline while live. */
.camrec__btn--toggle.camrec__btn--on {
  border-color: var(--qt-danger, #ef4444);
  color: var(--qt-danger, #ef4444);
}
/* Record button (base via .qt-btn--ghost) — danger outline / fill. */
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
/* Live stage — black 16:9 frame holding the camera video + overlays. */
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
/* Camera-off overlay — centered prompt over the black stage. */
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
/* REC badge — floating pill + pulsing dot. */
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
/* Centered empty state — big icon + prompt. */
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
