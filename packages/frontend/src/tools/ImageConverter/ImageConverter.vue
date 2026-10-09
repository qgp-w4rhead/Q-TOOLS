<script setup lang="ts">
/**
 * ImageConverter - convert an uploaded image between PNG / JPEG / WebP /
 * AVIF via the Canvas 2D `toBlob()` encoder. Everything runs locally in the
 * browser - the file never leaves the device.
 *
 * Controls:
 *   - File drop zone (any browser-decodable image)
 *   - Target format (formats the browser cannot encode are disabled)
 *   - Quality slider (lossy formats only)
 *   - Background colour used to flatten alpha for JPEG output
 *   - Convert → before/after preview with size comparison + download
 *
 * Embed mode: accepts `format`/`quality`/`background`/`action` inputs and
 * sends status outputs (source info, converted size, errors).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, RefreshCw, Trash2, AlertTriangle, Image as ImageIcon } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useImageConverter,
  formatLabel,
  sizeChangePercent,
  DEFAULT_FORMAT,
  DEFAULT_QUALITY,
  DEFAULT_BACKGROUND,
} from './useImageConverter';
import { formatSupportsAlpha, formatSupportsQuality, RASTER_FORMATS, type RasterFormat } from '@/utils/image';
import { formatBytes } from '@/utils/media';

const {
  source,
  targetFormat,
  quality,
  background,
  encodableFormats,
  converted,
  isConverting,
  error,
  setFile,
  convert,
  download,
  reset,
} = useImageConverter();

const qualityPct = computed({
  get: () => Math.round(quality.value * 100),
  set: (v: number) => {
    quality.value = Math.min(100, Math.max(1, v)) / 100;
  },
});

const showQuality = computed(() => formatSupportsQuality(targetFormat.value));
const showBackground = computed(() => !formatSupportsAlpha(targetFormat.value));

const { t } = useI18n();
const U = 'tools.image-converter.ui.';

const comparison = computed(() => {
  if (!source.value || !converted.value) return '';
  const pct = sizeChangePercent(source.value.sizeBytes, converted.value.sizeBytes);
  const abs = Math.abs(pct);
  if (abs < 0.5) return t(U + 'sizeSame');
  return pct < 0
    ? t(U + 'sizeSmaller', { pct: abs.toFixed(1) })
    : t(U + 'sizeLarger', { pct: abs.toFixed(1) });
});

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}

function onFormat(e: Event): void {
  targetFormat.value = (e.target as HTMLSelectElement).value as RasterFormat;
}

function resetOptions(): void {
  targetFormat.value = DEFAULT_FORMAT;
  quality.value = DEFAULT_QUALITY;
  background.value = DEFAULT_BACKGROUND;
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

      <div v-if="source" class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'targetFormat') }}</span>
          <select class="qt-input" :value="targetFormat" @change="onFormat">
            <option
              v-for="f in RASTER_FORMATS"
              :key="f"
              :value="f"
              :disabled="!encodableFormats.includes(f)"
            >
              {{ formatLabel(f) }}{{ encodableFormats.includes(f) ? '' : ` (${t('common.unsupported')})` }}
            </option>
          </select>
        </label>

        <label v-if="showQuality" class="qt-field">
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

        <label v-if="showBackground" class="qt-field">
          <span class="qt-label">{{ t(U + 'backgroundFlattened') }}</span>
          <input v-model="background" class="imgconv__color" type="color" />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="source ? t(U + 'descSource', { name: source.name, w: source.width, h: source.height, size: formatBytes(source.sizeBytes) }) : t('common.noImageLoaded')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm imgconv__btn--primary"
          :disabled="!source || isConverting"
          @click="convert"
        >
          <RefreshCw :size="14" /> {{ isConverting ? t(U + 'converting') : t('common.convert') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!converted"
          :title="t(U + 'downloadTitle')"
          @click="download"
        >
          <Download :size="14" /> {{ t('common.download') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!source"
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

      <div v-if="converted && source" class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:12px">
        <div class="qt-stack" style="--qt-stack-gap:6px;min-width:0">
          <span class="qt-label" style="font-size:11px">{{ t('common.before') }} · {{ formatBytes(source.sizeBytes) }}</span>
          <img :src="source.objectUrl" class="imgconv__preview" :alt="t(U + 'altOriginal')" />
        </div>
        <div class="qt-stack" style="--qt-stack-gap:6px;min-width:0">
          <span class="qt-label" style="font-size:11px">
            {{ t('common.after') }} · {{ formatBytes(converted.sizeBytes) }} · {{ comparison }}
          </span>
          <img :src="converted.objectUrl" class="imgconv__preview" :alt="t(U + 'altConverted')" />
        </div>
      </div>
      <div v-else-if="source" class="imgconv__placeholder">
        <ImageIcon :size="36" class="imgconv__placeholder-icon" />
        <span>{{ t(U + 'pressConvert') }}</span>
      </div>
      <div v-else class="imgconv__placeholder">
        <ImageIcon :size="36" class="imgconv__placeholder-icon" />
        <span>{{ t('common.loadImageStart') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Background colour swatch — small 48×32 picker. */
.imgconv__color {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  cursor: pointer;
}
/* Convert action (base via .qt-btn--ghost) — accent outline. */
.imgconv__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Before/after image — checkerboard backdrop for transparency. */
.imgconv__preview {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  background:
    repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
}
/* Centered empty state — big icon + prompt. */
.imgconv__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.imgconv__placeholder-icon {
  opacity: 0.4;
}
</style>
