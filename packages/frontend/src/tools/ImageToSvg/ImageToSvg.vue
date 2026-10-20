<script setup lang="ts">
/**
 * ImageToSvg - trace an uploaded raster image into vector SVG paths via
 * imagetracerjs (color quantization + potrace-style path fitting). Everything
 * runs locally in the browser - the file never leaves the device.
 *
 * Controls:
 *   - File drop zone (any browser-decodable image)
 *   - Tracing preset, palette colors, curve detail, noise reduction, blur
 *   - Trace resolution cap + SVG output coordinate scale
 *   - Vectorize -> before/after preview on checkerboard, path/color stats
 *   - Download .svg, copy markup, or re-rasterise to PNG at up to 16x
 *     (infinite upscale: vectors never pixelate)
 *
 * Embed mode: accepts preset/colors/detail/noise/smoothing/traceSize/scale/
 * lineFilter/pngScale inputs and `vectorize`/`reset` actions; sends status
 * outputs (source info, path count, svg size, errors).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, RefreshCw, Trash2, AlertTriangle, Image as ImageIcon, FileImage } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useImageToSvg,
  TRACE_PRESETS,
  TRACE_SIZES,
  OUTPUT_SCALES,
  PNG_SCALES,
  MIN_COLORS,
  MAX_COLORS,
  MIN_DETAIL,
  MAX_DETAIL,
  MAX_NOISE,
  MAX_SMOOTHING,
  DEFAULT_PRESET,
  DEFAULT_COLORS,
  DEFAULT_DETAIL,
  DEFAULT_NOISE,
  DEFAULT_SMOOTHING,
  DEFAULT_TRACE_SIZE,
  DEFAULT_OUTPUT_SCALE,
  DEFAULT_PNG_SCALE,
} from './useImageToSvg';
import { formatBytes } from '@/utils/media';

const {
  sourceName,
  sourceSizeBytes,
  sourceWidth,
  sourceHeight,
  sourceUrl,
  hasSource,
  preset,
  colors,
  detail,
  noise,
  smoothing,
  traceSize,
  scale,
  lineFilter,
  pngScale,
  traced,
  isTracing,
  isExporting,
  error,
  setFile,
  vectorize,
  downloadSvg,
  exportPng,
  reset,
} = useImageToSvg();

const { t } = useI18n();
const U = 'tools.image-to-svg.ui.';

const stats = computed(() => {
  const r = traced.value;
  if (!r) return '';
  return t(U + 'stats', {
    paths: r.pathCount,
    colors: r.paletteColors,
    size: formatBytes(r.sizeBytes),
  });
});

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}

function resetOptions(): void {
  preset.value = DEFAULT_PRESET;
  colors.value = DEFAULT_COLORS;
  detail.value = DEFAULT_DETAIL;
  noise.value = DEFAULT_NOISE;
  smoothing.value = DEFAULT_SMOOTHING;
  traceSize.value = DEFAULT_TRACE_SIZE;
  scale.value = DEFAULT_OUTPUT_SCALE;
  lineFilter.value = false;
  pngScale.value = DEFAULT_PNG_SCALE;
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

      <div v-if="hasSource" class="qt-grid" style="--qt-grid-min:160px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'preset') }}</span>
          <select v-model="preset" class="qt-input">
            <option v-for="p in TRACE_PRESETS" :key="p" :value="p">
              {{ t(U + 'preset_' + p) }}
            </option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'colors') }} · {{ colors }}</span>
          <input v-model.number="colors" class="qt-range" style="width:100%" type="range" :min="MIN_COLORS" :max="MAX_COLORS" step="1" />
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'detail') }} · {{ detail }}/{{ MAX_DETAIL }}</span>
          <input v-model.number="detail" class="qt-range" style="width:100%" type="range" :min="MIN_DETAIL" :max="MAX_DETAIL" step="1" />
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'noise') }} · {{ noise }}</span>
          <input v-model.number="noise" class="qt-range" style="width:100%" type="range" min="0" :max="MAX_NOISE" step="1" />
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'smoothing') }} · {{ smoothing }}px</span>
          <input v-model.number="smoothing" class="qt-range" style="width:100%" type="range" min="0" :max="MAX_SMOOTHING" step="1" />
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'traceSize') }}</span>
          <select v-model.number="traceSize" class="qt-input">
            <option v-for="s in TRACE_SIZES" :key="s" :value="s">
              {{ s === 0 ? t(U + 'traceSizeFull') : `${s} px` }}
            </option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'scale') }}</span>
          <select v-model.number="scale" class="qt-input">
            <option v-for="s in OUTPUT_SCALES" :key="s" :value="s">×{{ s }}</option>
          </select>
        </label>

        <label class="qt-check" style="padding-bottom:8px">
          <input v-model="lineFilter" type="checkbox" />
          <span class="qt-label">{{ t(U + 'lineFilter') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasSource ? t(U + 'descSource', { name: sourceName, w: sourceWidth, h: sourceHeight, size: formatBytes(sourceSizeBytes) }) : t('common.noImageLoaded')"
      :copy-text="traced?.svg ?? ''"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm img2svg__btn--primary"
          :disabled="!hasSource || isTracing"
          @click="vectorize"
        >
          <RefreshCw :size="14" /> {{ isTracing ? t(U + 'vectorizing') : t(U + 'vectorize') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!traced"
          :title="t(U + 'downloadTitle')"
          @click="downloadSvg"
        >
          <Download :size="14" /> {{ t(U + 'downloadSvg') }}
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

      <div v-if="traced && hasSource" class="qt-stack" style="--qt-stack-gap:12px">
        <div class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:12px">
          <div class="qt-stack" style="--qt-stack-gap:6px;min-width:0">
            <span class="qt-label" style="font-size:11px">{{ t('common.before') }} · {{ sourceWidth }}×{{ sourceHeight }}</span>
            <img :src="sourceUrl ?? ''" class="img2svg__preview" :alt="t(U + 'altOriginal')" />
          </div>
          <div class="qt-stack" style="--qt-stack-gap:6px;min-width:0">
            <span class="qt-label" style="font-size:11px">{{ t('common.after') }} · {{ stats }}</span>
            <div class="img2svg__preview img2svg__svg" v-html="traced.svg" />
          </div>
        </div>

        <div class="img2svg__pngrow">
          <span class="qt-label">{{ t(U + 'pngScale') }}</span>
          <select v-model.number="pngScale" class="qt-input img2svg__pngscale">
            <option v-for="s in PNG_SCALES" :key="s" :value="s">×{{ s }}</option>
          </select>
          <button
            type="button"
            class="qt-btn qt-btn--ghost qt-btn--sm"
            :disabled="isExporting"
            :title="t(U + 'exportPngTitle')"
            @click="exportPng"
          >
            <FileImage :size="14" /> {{ isExporting ? t(U + 'exporting') : t(U + 'exportPng') }}
          </button>
        </div>
      </div>
      <div v-else-if="hasSource" class="img2svg__placeholder">
        <ImageIcon :size="36" class="img2svg__placeholder-icon" />
        <span>{{ t(U + 'pressVectorize') }}</span>
      </div>
      <div v-else class="img2svg__placeholder">
        <ImageIcon :size="36" class="img2svg__placeholder-icon" />
        <span>{{ t('common.loadImageStart') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Vectorize action (base via .qt-btn--ghost) — accent outline. */
.img2svg__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Before/after panes — checkerboard backdrop for transparency. */
.img2svg__preview {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  background:
    repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  overflow: hidden;
}
/* Rendered SVG fills the preview pane while staying proportional. */
.img2svg__svg :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
  max-height: 320px;
}
/* Inline "rasterise at Nx" row under the preview. */
.img2svg__pngrow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.img2svg__pngscale {
  width: auto;
}
/* Centered empty state — big icon + prompt. */
.img2svg__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.img2svg__placeholder-icon {
  opacity: 0.4;
}
</style>
