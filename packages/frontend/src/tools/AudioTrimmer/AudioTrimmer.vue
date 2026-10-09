<script setup lang="ts">
/**
 * AudioTrimmer - cut audio by start/end time with a waveform preview,
 * optional fade in/out, and re-export to MP3 / WAV / OGG / M4A / FLAC.
 * Entirely in the browser via ffmpeg.wasm.
 *
 * The waveform is drawn on a canvas from peaks computed by the Web Audio
 * API; the shaded region outside the selection is dimmed. When the codec
 * can't be decoded by the browser, the preview is skipped but trimming by
 * timestamps still works.
 *
 * Works in embed mode: receives `input` PostMessages (url, start, end,
 * fadeIn, fadeOut, format, action) and sends `output` PostMessages with
 * status/progress and result metadata.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertCircle,
  Download,
  Loader2,
  Music,
  Scissors,
  Trash2,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useAudioTrimmer,
  TRIM_FORMATS,
  MAX_FILE_SIZE,
} from './useAudioTrimmer';
import { formatBytes, formatDuration } from '@/utils/media';

const {
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
  onFile,
  trim,
  download,
  clear,
} = useAudioTrimmer();

const { t } = useI18n();
const U = 'tools.audio-trimmer.ui.';

const canvas = ref<HTMLCanvasElement | null>(null);
const busy = computed(() => status.value === 'loading-engine' || status.value === 'processing');

const statusLabel = computed(() => {
  switch (status.value) {
    case 'loading-engine':
      return t(U + 'statusLoading');
    case 'processing':
      return t(U + 'statusTrimming', { pct: Math.round(progress.value * 100) });
    case 'done':
      return t(U + 'statusDone');
    case 'error':
      return t(U + 'statusFailed');
    default:
      return '';
  }
});

const outputDescription = computed(() => {
  if (result.value) {
    return `${result.value.name} · ${formatBytes(result.value.size)}`;
  }
  if (file.value) return t(U + 'descReady');
  return t(U + 'descEmpty');
});

const selectionLabel = computed(() => {
  if (!duration.value) return '';
  const sel = Math.max(0, endSec.value - startSec.value);
  return t(U + 'selLabel', {
    start: formatDuration(startSec.value, true),
    end: formatDuration(endSec.value, true),
    dur: formatDuration(sel, true),
  });
});

/* ------------------------------ waveform ------------------------------- */

function draw(): void {
  const cv = canvas.value;
  const pk = peaks.value;
  if (!cv || !pk || !duration.value) return;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (w === 0 || h === 0) return;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const styles = getComputedStyle(cv);
  const accent = styles.getPropertyValue('--qt-accent').trim() || '#4f8ef7';
  const muted = styles.getPropertyValue('--qt-border').trim() || '#444';

  const mid = h / 2;
  const n = pk.length / 2;
  const selStart = Math.min(1, Math.max(0, startSec.value / duration.value));
  const selEnd = Math.min(1, Math.max(0, endSec.value / duration.value));

  for (let i = 0; i < n; i++) {
    const x = (i / n) * w;
    const min = pk[i * 2]!;
    const max = pk[i * 2 + 1]!;
    const y1 = mid - max * (mid - 1);
    const y2 = mid - min * (mid - 1);
    const inSel = i / n >= selStart && i / n <= selEnd;
    ctx.fillStyle = inSel ? accent : muted;
    ctx.fillRect(x, y1, Math.max(1, w / n - 0.5), Math.max(1, y2 - y1));
  }

  // Selection boundary lines.
  ctx.fillStyle = accent;
  ctx.fillRect(selStart * w - 1, 0, 2, h);
  ctx.fillRect(selEnd * w - 1, 0, 2, h);
}

let resizeObs: ResizeObserver | null = null;

watch([peaks, startSec, endSec, duration, canvas], () => {
  draw();
  if (canvas.value && !resizeObs && typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => draw());
    resizeObs.observe(canvas.value);
  }
});

onBeforeUnmount(() => {
  resizeObs?.disconnect();
  resizeObs = null;
});

/** Click/drag on the waveform to set start (nearest bound moves). */
function onWaveClick(e: MouseEvent): void {
  const cv = canvas.value;
  if (!cv || !duration.value) return;
  const rect = cv.getBoundingClientRect();
  const t = ((e.clientX - rect.left) / rect.width) * duration.value;
  // Move whichever bound is closer.
  if (Math.abs(t - startSec.value) <= Math.abs(t - endSec.value)) {
    startSec.value = Math.min(t, endSec.value - 0.01);
  } else {
    endSec.value = Math.max(t, startSec.value + 0.01);
  }
}

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void onFile(f);
}

function clampRange(): void {
  if (duration.value > 0) {
    startSec.value = Math.min(Math.max(0, startSec.value), duration.value);
    endSec.value = Math.min(Math.max(0, endSec.value), duration.value);
  }
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          v-if="file || result"
          class="qt-btn qt-btn--ghost"
          type="button"
          @click="clear"
        >
          <Trash2 :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </template>

      <FileDropZone
        accept="audio/*,.mp3,.wav,.ogg,.oga,.flac,.aac,.m4a,.opus,.wma,.aiff,.aif,.mka"
        :busy="busy"
        :hint="t(U + 'dropHint', { size: formatBytes(MAX_FILE_SIZE) })"
        @files="onFiles"
      />

      <template v-if="file">
        <div class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px;font-size:13px">
          <Music :size="15" style="color:var(--qt-accent);flex-shrink:0" />
          <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ file.name }}</span>
          <span class="qt-hint" style="margin-left:auto;font-size:12.5px;flex-shrink:0">{{ formatBytes(file.size) }}</span>
        </div>

        <audio :src="file.previewUrl" controls style="width:100%;height:40px" />

        <div v-if="peaks" class="qt-stack" style="--qt-stack-gap:4px">
          <canvas
            ref="canvas"
            style="width:100%;height:96px;display:block;background:var(--qt-bg);border:1px solid var(--qt-border);border-radius:var(--qt-radius-sm);cursor:crosshair"
            :title="t(U + 'waveTitle')"
            @click="onWaveClick"
          />
          <p class="qt-hint" style="margin:0;font-size:12px;font-variant-numeric:tabular-nums">{{ selectionLabel }}</p>
        </div>
        <p v-else-if="!duration" class="qt-hint" style="margin:0;font-size:12.5px">
          {{ t(U + 'waveUnavailable') }}
        </p>

        <div class="qt-stack" style="--qt-stack-gap:12px">
          <div class="qt-row qt-row--bottom" style="--qt-row-gap:16px">
            <label class="qt-field" style="flex:1 1 180px">
              <span class="qt-label">{{ t(U + 'startLabel', { t: formatDuration(startSec, true) }) }}</span>
              <input
                v-model.number="startSec"
                type="range"
                class="qt-range"
                :min="0"
                :max="duration || 0"
                :step="duration > 60 ? 0.1 : 0.01"
                @input="clampRange"
              />
            </label>
            <label class="qt-field" style="flex:1 1 180px">
              <span class="qt-label">{{ t(U + 'endLabel', { t: formatDuration(endSec, true) }) }}</span>
              <input
                v-model.number="endSec"
                type="range"
                class="qt-range"
                :min="0"
                :max="duration || 0"
                :step="duration > 60 ? 0.1 : 0.01"
                @input="clampRange"
              />
            </label>
          </div>

          <div class="qt-row qt-row--bottom" style="--qt-row-gap:16px">
            <label class="qt-field" style="flex:1 1 180px">
              <span class="qt-label">{{ t(U + 'fadeInLabel', { s: fadeInSec.toFixed(1) }) }}</span>
              <input
                v-model.number="fadeInSec"
                type="range"
                class="qt-range"
                :min="0"
                :max="10"
                step="0.1"
              />
            </label>
            <label class="qt-field" style="flex:1 1 180px">
              <span class="qt-label">{{ t(U + 'fadeOutLabel', { s: fadeOutSec.toFixed(1) }) }}</span>
              <input
                v-model.number="fadeOutSec"
                type="range"
                class="qt-range"
                :min="0"
                :max="10"
                step="0.1"
              />
            </label>
            <label class="qt-field">
              <span class="qt-label">{{ t(U + 'fmtLabel') }}</span>
              <select v-model="format" class="qt-input" style="font-size:13.5px;padding:7px 10px">
                <option v-for="f in TRIM_FORMATS" :key="f.id" :value="f.id">
                  {{ f.label }}
                </option>
              </select>
            </label>
          </div>

          <button
            class="qt-btn qt-btn--primary"
            style="align-self:flex-start"
            type="button"
            :disabled="busy || endSec <= startSec"
            @click="trim"
          >
            <Loader2 v-if="busy" :size="14" class="qt-spin" />
            <Scissors v-else :size="14" />
            <span>{{ busy ? t(U + 'btnWorking') : t(U + 'btnTrim') }}</span>
          </button>
        </div>
      </template>

      <div v-if="busy" class="qt-progress-track" style="height:6px">
        <div class="qt-progress-fill" :style="{ width: `${Math.round(progress * 100)}%` }" />
      </div>
      <p v-if="statusLabel" class="qt-hint" style="margin:0;font-size:12.5px">{{ statusLabel }}</p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="outputDescription"
      :hide-copy="true"
    >
      <template #actions>
        <button
          v-if="result"
          class="qt-btn qt-btn--primary"
          type="button"
          @click="download"
        >
          <Download :size="14" />
          <span>{{ t('common.download') }}</span>
        </button>
      </template>

      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span style="white-space:pre-wrap;word-break:break-word">{{ error }}</span>
      </p>

      <template v-else>
        <div v-if="result" class="qt-panel qt-stack" style="--qt-stack-gap:10px;padding:10px 12px">
          <audio :src="result.url" controls style="width:100%;height:40px" />
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblFile') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ result.name }}</span>
          </div>
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblSize') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ formatBytes(result.size) }}</span>
          </div>
        </div>
        <p v-else class="qt-alert qt-alert--empty">
          {{ file ? t(U + 'alertReady') : t(U + 'alertEmpty') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>
