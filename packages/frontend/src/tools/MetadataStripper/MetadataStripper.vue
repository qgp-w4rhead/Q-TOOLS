<script setup lang="ts">
/**
 * MetadataStripper - wipe EXIF/GPS/IPTC/XMP metadata from an image by
 * re-encoding it through the Canvas 2D encoder (canvas output contains only
 * pixel data). Reports which metadata was detected before stripping.
 * Everything runs locally - nothing leaves the browser.
 *
 * Embed mode: accepts `format`/`action` inputs and sends status outputs.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, Trash2, AlertTriangle, Eraser, ShieldCheck, MapPin } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import { useMetadataStripper, DEFAULT_BACKGROUND } from './useMetadataStripper';
import { formatSupportsAlpha, formatSupportsQuality, type RasterFormat } from '@/utils/image';
import { formatBytes } from '@/utils/media';

const {
  fileName,
  fileSizeBytes,
  sourceUrl,
  hasFile,
  imageWidth,
  imageHeight,
  detectedTagCount,
  hasGps,
  format,
  quality,
  background,
  encodableFormats,
  result,
  isStripping,
  error,
  setFile,
  strip,
  download,
  reset,
} = useMetadataStripper();

const qualityPct = computed({
  get: () => Math.round(quality.value * 100),
  set: (v: number) => {
    quality.value = Math.min(100, Math.max(1, v)) / 100;
  },
});

const showQuality = computed(() => formatSupportsQuality(format.value));
const showBackground = computed(() => !formatSupportsAlpha(format.value));
const { t } = useI18n();
const U = 'tools.metadata-stripper.ui.';

const formatOptions: RasterFormat[] = ['png', 'jpeg', 'webp', 'avif'];

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}

function onFormat(e: Event): void {
  format.value = (e.target as HTMLSelectElement).value as RasterFormat;
}

function resetOptions(): void {
  format.value = 'png';
  quality.value = 0.92;
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

      <div v-if="hasFile" class="qt-grid" style="--qt-grid-min:160px;--qt-grid-gap:12px">
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

        <label v-if="showQuality" class="qt-field">
          <span class="qt-label">{{ t('common.quality') }} · {{ qualityPct }}%</span>
          <input v-model.number="qualityPct" class="qt-range" style="width:100%" type="range" min="1" max="100" step="1" />
        </label>

        <label v-if="showBackground" class="qt-field">
          <span class="qt-label">{{ t('common.background') }}</span>
          <input v-model="background" class="stripper__color" type="color" />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasFile ? t(U + 'descSource', { name: fileName, w: imageWidth, h: imageHeight, size: formatBytes(fileSizeBytes) }) : t('common.noImageLoaded')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm stripper__btn--primary"
          :disabled="!hasFile || isStripping"
          @click="strip"
        >
          <Eraser :size="14" /> {{ isStripping ? t(U + 'stripping') : t(U + 'strip') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!result"
          :title="t(U + 'downloadTitle')"
          @click="download"
        >
          <Download :size="14" /> {{ t('common.download') }}
        </button>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :disabled="!hasFile" :title="t('common.clear')" @click="reset">
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-if="hasFile" class="qt-row" style="--qt-row-gap:8px">
        <span v-if="detectedTagCount > 0" class="stripper__badge stripper__badge--warn">
          <AlertTriangle :size="12" /> {{ t(U + 'fieldsDetected', detectedTagCount) }}
        </span>
        <span v-else class="stripper__badge stripper__badge--ok">
          <ShieldCheck :size="12" /> {{ t(U + 'noMetadata') }}
        </span>
        <span v-if="hasGps" class="stripper__badge stripper__badge--warn">
          <MapPin :size="12" /> {{ t(U + 'gpsPresent') }}
        </span>
      </div>

      <div v-if="result" class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:12px">
        <div class="qt-stack" style="--qt-stack-gap:6px;min-width:0">
          <span class="qt-label" style="font-size:11px">{{ t('common.before') }} · {{ formatBytes(fileSizeBytes) }}</span>
          <img :src="sourceUrl!" class="stripper__preview" :alt="t(U + 'altOriginal')" />
        </div>
        <div class="qt-stack" style="--qt-stack-gap:6px;min-width:0">
          <span class="qt-label" style="font-size:11px">
            {{ t('common.after') }} · {{ formatBytes(result.sizeBytes) }} · {{ t(U + 'wiped') }}
          </span>
          <img :src="result.objectUrl" class="stripper__preview" :alt="t(U + 'altCleaned')" />
        </div>
      </div>
      <div v-else-if="!hasFile" class="stripper__placeholder">
        <Eraser :size="36" class="stripper__placeholder-icon" />
        <span>{{ t('common.loadImageStart') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Background colour swatch — small 48×32 picker. */
.stripper__color {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  cursor: pointer;
}
/* Strip action (base via .qt-btn--ghost) — accent outline. */
.stripper__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Detection badges — warn/ok tinted pills. */
.stripper__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  border: 1px solid var(--qt-border);
}
.stripper__badge--warn {
  color: var(--qt-warning, #f59e0b);
  background: oklch(from var(--qt-warning, #f59e0b) 25% c h / 10%);
}
.stripper__badge--ok {
  color: var(--qt-success, #3fb950);
  background: oklch(from var(--qt-success, #3fb950) 30% c h / 10%);
}
/* Before/after image — checkerboard backdrop for transparency. */
.stripper__preview {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  background: repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
}
/* Centered empty state — big icon + prompt. */
.stripper__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.stripper__placeholder-icon {
  opacity: 0.4;
}
</style>
