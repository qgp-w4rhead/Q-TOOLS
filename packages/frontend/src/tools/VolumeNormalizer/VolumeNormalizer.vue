<script setup lang="ts">
/**
 * VolumeNormalizer - normalize or boost audio loudness entirely in the
 * browser via ffmpeg.wasm.
 *
 * Peak mode runs a two-pass volumedetect → volume gain; loudnorm mode runs
 * the EBU R128 loudnorm filter to a LUFS target. Measured levels and the
 * applied gain are shown after a run.
 *
 * Works in embed mode: receives `input` PostMessages (url, mode,
 * targetPeak, targetLufs, format, action) and sends `output` PostMessages
 * with status/progress, measurements, and result metadata.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertCircle,
  Download,
  Loader2,
  Music,
  Trash2,
  Volume2,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useVolumeNormalizer,
  NORMALIZE_MODES,
  NORMALIZE_FORMATS,
  MAX_FILE_SIZE,
} from './useVolumeNormalizer';
import { formatBytes } from '@/utils/media';

const {
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
  onFile,
  normalize,
  download,
  clear,
} = useVolumeNormalizer();

const { t } = useI18n();
const U = 'tools.volume-normalizer.ui.';

const busy = computed(
  () =>
    status.value === 'loading-engine' ||
    status.value === 'measuring' ||
    status.value === 'processing',
);

const statusLabel = computed(() => {
  switch (status.value) {
    case 'loading-engine':
      return t(U + 'statusLoading');
    case 'measuring':
      return t(U + 'statusMeasuring');
    case 'processing':
      return t(U + 'statusNormalizing', { pct: Math.round(progress.value * 100) });
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
        accept="audio/*,.mp3,.wav,.ogg,.oga,.flac,.aac,.m4a,.opus,.wma,.aiff,.aif,.mka"
        :busy="busy"
        :hint="t(U + 'dropHint', { size: formatBytes(MAX_FILE_SIZE) })"
        @files="onFiles"
      />

      <div v-if="file" class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px;font-size:13px">
        <Music :size="15" style="color:var(--qt-accent);flex-shrink:0" />
        <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ file.name }}</span>
        <span class="qt-hint" style="margin-left:auto;font-size:12.5px;flex-shrink:0">{{ formatBytes(file.size) }}</span>
      </div>

      <div v-if="file" class="qt-stack" style="--qt-stack-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'modeLabel') }}</span>
          <div class="qt-row" style="--qt-row-gap:6px">
            <button
              v-for="m in NORMALIZE_MODES"
              :key="m.id"
              type="button"
              class="qt-chip qt-chip--filled"
              :class="{ 'qt-chip--solid': mode === m.id }"
              :aria-pressed="mode === m.id"
              :title="m.hint"
              style="font-size:12.5px;padding:5px 12px"
              @click="mode = m.id"
            >
              {{ m.label }}
            </button>
          </div>
          <span class="qt-hint" style="font-size:12px">
            {{ NORMALIZE_MODES.find((m) => m.id === mode)?.hint }}
          </span>
        </label>

        <div class="qt-row qt-row--bottom" style="--qt-row-gap:16px">
          <label v-if="mode === 'peak'" class="qt-field">
            <span class="qt-label">{{ t(U + 'peakLabel') }}</span>
            <input
              v-model.number="targetPeak"
              type="number"
              class="qt-input"
              style="font-size:13.5px;padding:7px 10px;width:130px"
              min="-20"
              max="0"
              step="0.5"
            />
          </label>
          <label v-else class="qt-field">
            <span class="qt-label">{{ t(U + 'lufsLabel') }}</span>
            <input
              v-model.number="targetLufs"
              type="number"
              class="qt-input"
              style="font-size:13.5px;padding:7px 10px;width:130px"
              min="-40"
              max="-5"
              step="1"
            />
          </label>
          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'fmtLabel') }}</span>
            <select v-model="format" class="qt-input" style="font-size:13.5px;padding:7px 10px">
              <option v-for="f in NORMALIZE_FORMATS" :key="f.id" :value="f.id">
                {{ f.label }}
              </option>
            </select>
          </label>
        </div>

        <button
          class="qt-btn qt-btn--primary"
          style="align-self:flex-start"
          type="button"
          :disabled="busy"
          @click="normalize"
        >
          <Loader2 v-if="busy" :size="14" class="qt-spin" />
          <Volume2 v-else :size="14" />
          <span>{{ busy ? t(U + 'btnWorking') : t(U + 'btnNormalize') }}</span>
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
        <div v-if="measured" class="qt-panel qt-stack" style="--qt-stack-gap:8px;padding:10px 12px">
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px" v-if="measured.maxVolumeDb !== null">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblPeak') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ measured.maxVolumeDb.toFixed(1) }} dB</span>
          </div>
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px" v-if="measured.meanVolumeDb !== null">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblMean') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">{{ measured.meanVolumeDb.toFixed(1) }} dB</span>
          </div>
          <div class="qt-row" style="--qt-row-gap:10px;align-items:baseline;font-size:13px" v-if="appliedGainDb !== null">
            <span class="qt-label" style="flex:0 0 60px;font-size:12.5px">{{ t(U + 'lblGain') }}</span>
            <span style="color:var(--qt-text);word-break:break-all">
              {{ t(U + 'gainApplied', { gain: (appliedGainDb >= 0 ? '+' : '') + appliedGainDb.toFixed(1) }) }}
            </span>
          </div>
        </div>

        <div v-if="result" class="qt-panel qt-stack" style="--qt-stack-gap:8px;padding:10px 12px">
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
        <p v-else-if="!measured" class="qt-alert qt-alert--empty">
          {{ file ? t(U + 'alertReady') : t(U + 'alertEmpty') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>
