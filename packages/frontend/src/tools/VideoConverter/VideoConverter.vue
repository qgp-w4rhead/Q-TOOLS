<script setup lang="ts">
/**
 * VideoConverter - convert video files between MP4 / WebM / MOV / AVI / MKV
 * entirely in the browser via ffmpeg.wasm.
 *
 * Codec/CRF/preset controls are exposed; the ffmpeg core (~32 MB) is
 * lazy-loaded on the first conversion and cached by the service worker.
 *
 * Works in embed mode: receives `input` PostMessages (url, format, crf,
 * preset, action) and sends `output` PostMessages with status/progress and
 * result metadata.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertCircle,
  ArrowRight,
  Download,
  Film,
  Loader2,
  Trash2,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useVideoConverter,
  VIDEO_FORMATS,
  ENCODE_PRESETS,
  CRF_MIN,
  CRF_MAX,
  MAX_FILE_SIZE,
} from './useVideoConverter';
import { formatBytes } from '@/utils/media';

const {
  file,
  format,
  crf,
  preset,
  status,
  progress,
  error,
  result,
  onFile,
  convert,
  download,
  clear,
} = useVideoConverter();

const { t } = useI18n();
const U = 'tools.video-converter.ui.';

const busy = computed(() => status.value === 'loading-engine' || status.value === 'processing');

const statusLabel = computed(() => {
  switch (status.value) {
    case 'loading-engine':
      return t(U + 'statusLoading');
    case 'processing':
      return t(U + 'statusConverting', { pct: Math.round(progress.value * 100) });
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

const crfLabel = computed(() => {
  if (crf.value <= 20) return t(U + 'crfHigh');
  if (crf.value <= 28) return t(U + 'crfBalanced');
  return t(U + 'crfSmall');
});

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) onFile(f);
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
        accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.flv,.ts,.mts,.m2ts,.3gp,.mpg,.mpeg,.vob,.ogv"
        :busy="busy"
        :hint="t(U + 'dropHint', { size: formatBytes(MAX_FILE_SIZE) })"
        @files="onFiles"
      />

      <div v-if="file" class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px;font-size:13px">
        <Film :size="15" style="color:var(--qt-accent);flex-shrink:0" />
        <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ file.name }}</span>
        <span class="qt-hint" style="margin-left:auto;font-size:12.5px;flex-shrink:0">{{ formatBytes(file.size) }}</span>
      </div>

      <div v-if="file" class="qt-stack" style="--qt-stack-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'fmtLabel') }}</span>
          <div class="qt-row" style="--qt-row-gap:6px">
            <button
              v-for="f in VIDEO_FORMATS"
              :key="f.id"
              type="button"
              class="qt-chip qt-chip--filled"
              :class="{ 'qt-chip--solid': format === f.id }"
              :aria-pressed="format === f.id"
              style="font-size:12.5px;padding:5px 12px"
              @click="format = f.id"
            >
              {{ f.label }}
            </button>
          </div>
        </label>

        <div class="qt-row qt-row--bottom" style="--qt-row-gap:16px">
          <label class="qt-field" style="flex:1 1 220px">
            <span class="qt-label">{{ t(U + 'qualityLabel', { crf, label: crfLabel }) }}</span>
            <input
              v-model.number="crf"
              type="range"
              class="qt-range"
              :min="CRF_MIN"
              :max="CRF_MAX"
              step="1"
            />
          </label>

          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'presetLabel') }}</span>
            <select v-model="preset" class="qt-input" style="font-size:13.5px;padding:7px 10px">
              <option v-for="p in ENCODE_PRESETS" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
        </div>

        <button
          class="qt-btn qt-btn--primary"
          style="align-self:flex-start"
          type="button"
          :disabled="busy"
          @click="convert"
        >
          <Loader2 v-if="busy" :size="14" class="qt-spin" />
          <ArrowRight v-else :size="14" />
          <span>{{ busy ? t(U + 'btnWorking') : t(U + 'btnConvert') }}</span>
        </button>
      </div>

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
          <video :src="result.url" controls style="width:100%;max-height:320px;background:#000;border-radius:var(--qt-radius-sm)" />
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblFile') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ result.name }}</span>
          </div>
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblSize') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">
              {{ formatBytes(result.size) }}
              <template v-if="file">
                ({{ formatBytes(file.size) }} → {{ formatBytes(result.size) }})
              </template>
            </span>
          </div>
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblMime') }}</span>
            <span style="color:var(--qt-text);word-break:break-all"><code class="qt-mono" style="font-size:12.5px">{{ result.mime }}</code></span>
          </div>
        </div>
        <p v-else class="qt-alert qt-alert--empty">
          {{ file ? t(U + 'alertReady') : t(U + 'alertEmpty') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>
