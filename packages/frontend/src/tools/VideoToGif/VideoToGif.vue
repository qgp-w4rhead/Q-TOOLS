<script setup lang="ts">
/**
 * VideoToGif - convert a video clip to an animated GIF entirely in the
 * browser via ffmpeg.wasm (palettegen/paletteuse pipeline).
 *
 * Controls: fps, output width, palette size, and optional start/end trim.
 * The ffmpeg core (~32 MB) is lazy-loaded on the first conversion.
 *
 * Works in embed mode: receives `input` PostMessages (url, fps, width,
 * colors, start, end, action) and sends `output` PostMessages with
 * status/progress and result metadata.
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
  useVideoToGif,
  FPS_MIN,
  FPS_MAX,
  WIDTH_MIN,
  WIDTH_MAX,
  COLORS_MIN,
  COLORS_MAX,
  MAX_FILE_SIZE,
} from './useVideoToGif';
import { formatBytes } from '@/utils/media';

const {
  file,
  fps,
  width,
  colors,
  startText,
  endText,
  status,
  progress,
  error,
  result,
  onFile,
  convert,
  download,
  clear,
} = useVideoToGif();

const { t } = useI18n();
const U = 'tools.video-to-gif.ui.';

const busy = computed(() => status.value === 'loading-engine' || status.value === 'processing');

const statusLabel = computed(() => {
  switch (status.value) {
    case 'loading-engine':
      return t(U + 'statusLoading');
    case 'processing':
      return t(U + 'statusRendering', { pct: Math.round(progress.value * 100) });
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
        accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v,.wmv,.flv,.ts,.3gp,.mpg,.mpeg,.ogv"
        :busy="busy"
        :hint="t(U + 'dropHint', { size: formatBytes(MAX_FILE_SIZE) })"
        @files="onFiles"
      />

      <template v-if="file">
        <div class="qt-panel qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap;padding:8px 12px;font-size:13px">
          <Film :size="15" style="color:var(--qt-accent);flex-shrink:0" />
          <span style="color:var(--qt-text);font-weight:600;word-break:break-all;min-width:0">{{ file.name }}</span>
          <span class="qt-hint" style="margin-left:auto;font-size:12.5px;flex-shrink:0">{{ formatBytes(file.size) }}</span>
        </div>

        <video :src="file.previewUrl" controls style="width:100%;max-height:260px;background:#000;border-radius:var(--qt-radius-sm)" />

        <div class="qt-stack" style="--qt-stack-gap:12px">
          <div class="qt-row" style="--qt-row-gap:16px">
            <label class="qt-field" style="flex:1 1 160px">
              <span class="qt-label">{{ t(U + 'fpsLabel', { fps }) }}</span>
              <input
                v-model.number="fps"
                type="range"
                class="qt-range"
                :min="FPS_MIN"
                :max="FPS_MAX"
                step="1"
              />
            </label>
            <label class="qt-field" style="flex:1 1 160px">
              <span class="qt-label">{{ t(U + 'widthLabel', { w: width }) }}</span>
              <input
                v-model.number="width"
                type="range"
                class="qt-range"
                :min="WIDTH_MIN"
                :max="WIDTH_MAX"
                step="20"
              />
            </label>
            <label class="qt-field" style="flex:1 1 160px">
              <span class="qt-label">{{ t(U + 'colorsLabel', { n: colors }) }}</span>
              <input
                v-model.number="colors"
                type="range"
                class="qt-range"
                :min="COLORS_MIN"
                :max="COLORS_MAX"
                step="8"
              />
            </label>
          </div>

          <div class="qt-row" style="--qt-row-gap:16px">
            <label class="qt-field" style="flex:1 1 160px">
              <span class="qt-label">{{ t(U + 'startLabel') }}</span>
              <input
                v-model="startText"
                type="text"
                class="qt-input"
                style="font-size:13.5px;padding:7px 10px"
                placeholder="0:00"
                spellcheck="false"
              />
            </label>
            <label class="qt-field" style="flex:1 1 160px">
              <span class="qt-label">{{ t(U + 'endLabel') }}</span>
              <input
                v-model="endText"
                type="text"
                class="qt-input"
                style="font-size:13.5px;padding:7px 10px"
                :placeholder="t(U + 'phEnd')"
                spellcheck="false"
              />
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
            <span>{{ busy ? t(U + 'btnWorking') : t(U + 'btnCreate') }}</span>
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
          <img :src="result.url" :alt="t(U + 'imgAlt')" class="v2g__gif" />
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
        </div>
        <p v-else class="qt-alert qt-alert--empty">
          {{ file ? t(U + 'alertReady') : t(U + 'alertEmpty') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: checkerboard transparency backdrop for the GIF preview. */
.v2g__gif {
  max-width: 100%;
  border-radius: var(--qt-radius-sm);
  background:
    repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
}
</style>
