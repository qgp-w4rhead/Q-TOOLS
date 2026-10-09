<script setup lang="ts">
/**
 * ImageCompressor - compress an uploaded image via the Canvas 2D `toBlob()`
 * encoder. Two modes: an explicit quality slider, or a target file size
 * (binary-searched quality). Shows a before/after preview with byte sizes
 * and percentage saved. Everything runs locally in the browser.
 *
 * Embed mode: accepts `mode`/`format`/`quality`/`targetSize`/`action`
 * inputs and sends status outputs.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, Trash2, AlertTriangle, Shrink, Zap } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useImageCompressor,
  savingsPercent,
  DEFAULT_MODE,
  DEFAULT_QUALITY,
  DEFAULT_TARGET_KB,
  type CompressMode,
} from './useImageCompressor';
import { formatSupportsAlpha, type RasterFormat } from '@/utils/image';
import { formatBytes } from '@/utils/media';

const {
  sourceName,
  sourceSizeBytes,
  sourceWidth,
  sourceHeight,
  sourceUrl,
  hasSource,
  mode,
  format,
  quality,
  targetSizeText,
  background,
  encodableFormats,
  compressed,
  isCompressing,
  error,
  setFile,
  compress,
  download,
  reset,
} = useImageCompressor();

const qualityPct = computed({
  get: () => Math.round(quality.value * 100),
  set: (v: number) => {
    quality.value = Math.min(100, Math.max(1, v)) / 100;
  },
});

const showBackground = computed(() => !formatSupportsAlpha(format.value));
const saved = computed(() =>
  compressed.value ? savingsPercent(sourceSizeBytes.value, compressed.value.sizeBytes) : 0,
);

const { t } = useI18n();
const U = 'tools.image-compressor.ui.';

const formatOptions: RasterFormat[] = ['webp', 'jpeg', 'png', 'avif'];

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}

function onMode(e: Event): void {
  mode.value = (e.target as HTMLSelectElement).value as CompressMode;
}
function onFormat(e: Event): void {
  format.value = (e.target as HTMLSelectElement).value as RasterFormat;
}

function resetOptions(): void {
  mode.value = DEFAULT_MODE;
  quality.value = DEFAULT_QUALITY;
  targetSizeText.value = `${DEFAULT_TARGET_KB} KB`;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :title="t(U + 'resetTitle')" @click="resetOptions">
          {{ t('common.reset') }}
        </button>
      </template>

      <FileDropZone
        accept="image/*"
        :title="t(U + 'dropTitle')"
        :hint="t(U + 'dropHint')"
        @files="onFiles"
      />

      <div v-if="hasSource" class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t('common.mode') }}</span>
          <select class="qt-input" :value="mode" @change="onMode">
            <option value="quality">{{ t(U + 'modeQuality') }}</option>
            <option value="target-size">{{ t(U + 'modeTargetSize') }}</option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t('common.outputFormat') }}</span>
          <select class="qt-input" :value="format" @change="onFormat">
            <option
              v-for="f in formatOptions"
              :key="f"
              :value="f"
              :disabled="!encodableFormats.includes(f)"
            >
              {{ f === 'jpeg' ? 'JPEG' : f.toUpperCase() }}{{ encodableFormats.includes(f) ? '' : ` (${t('common.unsupported')})` }}
            </option>
          </select>
        </label>

        <label v-if="mode === 'quality'" class="qt-field">
          <span class="qt-label">{{ t('common.quality') }} · {{ qualityPct }}%</span>
          <input
            v-model.number="qualityPct"
            class="qt-range"
            style="width:100%"
            type="range"
            min="1"
            max="100"
            step="1"
          />
        </label>

        <label v-else class="qt-field">
          <span class="qt-label">{{ t(U + 'targetSize') }}</span>
          <input
            v-model="targetSizeText"
            class="qt-input"
            type="text"
            :placeholder="t(U + 'targetSizePlaceholder')"
          />
        </label>

        <label v-if="showBackground" class="qt-field">
          <span class="qt-label">{{ t(U + 'backgroundFlattened') }}</span>
          <input v-model="background" class="imgcomp__color" type="color" />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasSource ? t(U + 'descSource', { name: sourceName, w: sourceWidth, h: sourceHeight, size: formatBytes(sourceSizeBytes) }) : t('common.noImageLoaded')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm imgcomp__btn--primary"
          :disabled="!hasSource || isCompressing"
          @click="compress"
        >
          <Zap :size="14" /> {{ isCompressing ? t(U + 'compressing') : t(U + 'compress') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!compressed"
          :title="t(U + 'downloadTitle')"
          @click="download"
        >
          <Download :size="14" /> {{ t('common.download') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!hasSource"
          :title="t('common.clear')"
          @click="reset"
        >
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-if="compressed && hasSource" class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:12px">
        <div class="qt-stack" style="--qt-stack-gap:6px;min-width:0">
          <span class="qt-label" style="font-size:11px">{{ t('common.before') }} · {{ formatBytes(sourceSizeBytes) }}</span>
          <img :src="sourceUrl!" class="imgcomp__preview" :alt="t(U + 'altOriginal')" />
        </div>
        <div class="qt-stack" style="--qt-stack-gap:6px;min-width:0">
          <span class="qt-label" style="font-size:11px">
            {{ t('common.after') }} · {{ formatBytes(compressed.sizeBytes) }} ·
            {{ t(U + 'smallerPct', { pct: saved.toFixed(1) }) }} · q={{ Math.round(compressed.qualityUsed * 100) }}%
          </span>
          <img :src="compressed.objectUrl" class="imgcomp__preview" :alt="t(U + 'altCompressed')" />
        </div>
      </div>
      <div v-else-if="hasSource" class="imgcomp__placeholder">
        <Shrink :size="36" class="imgcomp__placeholder-icon" />
        <span>{{ t(U + 'pressCompress') }}</span>
      </div>
      <div v-else class="imgcomp__placeholder">
        <Shrink :size="36" class="imgcomp__placeholder-icon" />
        <span>{{ t('common.loadImageStart') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Background colour swatch — small 48×32 picker. */
.imgcomp__color {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  cursor: pointer;
}
/* Compress action (base via .qt-btn--ghost) — accent outline. */
.imgcomp__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Before/after image — checkerboard backdrop for transparency. */
.imgcomp__preview {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  background: repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
}
/* Centered empty state — big icon + prompt. */
.imgcomp__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.imgcomp__placeholder-icon {
  opacity: 0.4;
}
</style>
