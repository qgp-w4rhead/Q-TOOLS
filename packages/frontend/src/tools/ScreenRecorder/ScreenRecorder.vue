<script setup lang="ts">
/**
 * ScreenRecorder - record the screen / window / browser tab via
 * `getDisplayMedia` + `MediaRecorder`, preview the recording, and download
 * it as WebM (or MP4 where the browser supports it).
 *
 * Controls:
 *   - MIME type (filtered to those the browser reports as supported)
 *   - Include audio toggle (system/tab audio where offered)
 *   - Start / stop capture
 *   - Start / stop recording
 *   - Preview the recorded clip + download + clear
 *
 * Requires a secure context (HTTPS or localhost); in an iframe the parent
 * must set `allow="display-capture"`.
 *
 * Embed mode: accepts `mimeType`/`includeAudio`/`action` inputs and sends
 * status outputs (`isRecording`, `isCapturing`, `hasRecording`, …).
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Monitor,
  MonitorOff,
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
  useScreenRecorder,
  formatDuration,
  mimeExtension,
  DEFAULT_MIME,
} from './useScreenRecorder';

const {
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
  startCapture,
  stopCapture,
  startRecording,
  stopRecording,
  downloadRecording,
  clearRecording,
} = useScreenRecorder();

const videoElement = ref<HTMLVideoElement | null>(null);
const previewElement = ref<HTMLVideoElement | null>(null);

// Bind the live capture stream to the live <video> element.
watch(stream, (s) => {
  const v = videoElement.value;
  if (!v) return;
  v.srcObject = s;
  if (s) {
    void v.play().catch(() => {
      /* autoplay can be blocked - not fatal */
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
      /* autoplay can be blocked - not fatal */
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
const U = 'tools.screen-recorder.ui.';

const mimeOptions = computed<string[]>(() => {
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

function onMime(e: Event): void {
  mimeType.value = (e.target as HTMLSelectElement).value;
}

function toggleCapture(): void {
  if (isCapturing.value) stopCapture();
  else void startCapture();
}

function toggleRecord(): void {
  if (isRecording.value) stopRecording();
  else void startRecording();
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:12px;align-items:end">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'mimeType') }}</span>
          <select class="qt-input qt-input--mono" style="font-size:12px" :value="mimeType" @change="onMime">
            <option v-for="m in mimeOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </label>

        <label class="qt-check" style="padding-bottom:8px">
          <input v-model="includeAudio" type="checkbox" />
          <span class="qt-label">{{ t(U + 'includeAudio') }}</span>
        </label>
      </div>

      <div class="qt-banner qt-banner--warn screenrec__notice" style="font-size:12px;align-items:center">
        <ShieldAlert :size="14" />
        <span>
          {{ t(U + 'httpsNotice') }}
          <code>allow="display-capture"</code>.
        </span>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputCapture')"
      :description="isRecording ? t(U + 'descRecording', { duration: durationLabel }) : (isCapturing ? t(U + 'descLive') : t(U + 'descOff'))"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm screenrec__btn--toggle"
          :class="{ 'screenrec__btn--on': isCapturing }"
          :disabled="isRecording"
          :title="isCapturing ? t(U + 'stopCapture') : t(U + 'startCapture')"
          @click="toggleCapture"
        >
          <component :is="isCapturing ? MonitorOff : Monitor" :size="14" />
          {{ isCapturing ? t(U + 'stopCapture') : t(U + 'startCapture') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :class="isRecording ? 'screenrec__btn--recording' : 'screenrec__btn--record'"
          :disabled="!isCapturing"
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
        <div class="screenrec__live">
          <video
            ref="videoElement"
            class="screenrec__video"
            autoplay
            muted
            playsinline
          />
          <div v-if="!isCapturing" class="screenrec__overlay">
            <Monitor :size="40" class="screenrec__overlay-icon" />
            <span>{{ t(U + 'captureOffOverlay') }}</span>
          </div>
          <div v-if="isRecording" class="screenrec__rec-badge">
            <span class="screenrec__rec-dot" /> {{ t(U + 'recBadge', { duration: durationLabel }) }}
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
          class="screenrec__video screenrec__video--preview"
          controls
          playsinline
        />
        <div class="qt-row" style="--qt-row-gap:6px">
          <span class="qt-badge"><Play :size="11" /> {{ durationLabel }}</span>
          <span class="qt-badge">{{ sizeLabel }}</span>
          <span class="qt-badge">{{ recordedMime }}</span>
        </div>
      </div>
      <div v-else class="screenrec__placeholder">
        <Monitor :size="40" class="screenrec__placeholder-icon" />
        <span>{{ t(U + 'emptyRecording') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Inline code chip inside the warn banner. */
.screenrec__notice code {
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  background: oklch(from var(--qt-warning, #f59e0b) 30% c h / 18%);
  padding: 1px 5px;
  border-radius: 4px;
}
/* Capture toggle (base via .qt-btn--ghost) — danger outline while live. */
.screenrec__btn--toggle.screenrec__btn--on {
  border-color: var(--qt-danger, #ef4444);
  color: var(--qt-danger, #ef4444);
}
/* Record button (base via .qt-btn--ghost) — danger outline / fill. */
.screenrec__btn--record {
  border-color: var(--qt-danger, #ef4444);
  color: var(--qt-danger, #ef4444);
}
.screenrec__btn--record:hover:not(:disabled) {
  background: oklch(from var(--qt-danger, #ef4444) 55% c h / 12%);
}
.screenrec__btn--recording {
  background: var(--qt-danger, #ef4444);
  border-color: var(--qt-danger, #ef4444);
  color: #fff;
}
.screenrec__btn--recording:hover:not(:disabled) {
  color: #fff;
  opacity: 0.9;
}
/* Live stage — black 16:9 frame holding the capture video + overlays. */
.screenrec__live {
  position: relative;
  width: 100%;
  background: #000;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  overflow: hidden;
  aspect-ratio: 16 / 9;
}
.screenrec__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.screenrec__video--preview {
  border-radius: var(--qt-radius);
}
/* Capture-off overlay — centered prompt over the black stage. */
.screenrec__overlay {
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
.screenrec__overlay-icon {
  opacity: 0.5;
}
/* REC badge — floating pill + pulsing dot. */
.screenrec__rec-badge {
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
.screenrec__rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--qt-danger, #ef4444);
  animation: screenrec-pulse 1s ease-in-out infinite;
}
@keyframes screenrec-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
/* Centered empty state — big icon + prompt. */
.screenrec__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 16px;
  color: var(--qt-muted);
  text-align: center;
  font-size: 13px;
}
.screenrec__placeholder-icon {
  opacity: 0.4;
}
</style>
