<script setup lang="ts">
/**
 * ImageCropper - drag-select a crop region on an uploaded image (with
 * aspect-ratio presets), crop via Canvas, preview, and download.
 * Everything runs locally in the browser.
 *
 * The component renders the image inside a positioned container and tracks
 * pointer events on an overlay. Screen coordinates are converted to image
 * coordinates via the rendered scale before being stored in the composable.
 *
 * Embed mode: accepts `preset`/`format`/`action` inputs and sends status
 * outputs (crop rect, output size, errors).
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Crop, Download, Maximize, Trash2, AlertTriangle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useImageCropper,
  presetRatio,
  rectFromPoints,
  ASPECT_PRESETS,
  DEFAULT_PRESET,
  type AspectPreset,
} from './useImageCropper';
import { formatSupportsAlpha, formatSupportsQuality, type RasterFormat } from '@/utils/image';
import { formatBytes } from '@/utils/media';

const {
  hasImage,
  imageUrl,
  imageName,
  imageWidth,
  imageHeight,
  preset,
  cropRect,
  format,
  quality,
  background,
  encodableFormats,
  outputUrl,
  outputSizeBytes,
  isCropping,
  error,
  setFile,
  setCropRect,
  selectAll,
  applyCrop,
  download,
  reset,
} = useImageCropper();

const imgEl = ref<HTMLImageElement | null>(null);
const dragging = ref(false);
let dragStart = { x: 0, y: 0 };

const qualityPct = computed({
  get: () => Math.round(quality.value * 100),
  set: (v: number) => {
    quality.value = Math.min(100, Math.max(1, v)) / 100;
  },
});

const showQuality = computed(() => formatSupportsQuality(format.value));
const showBackground = computed(() => !formatSupportsAlpha(format.value));
const formatOptions: RasterFormat[] = ['png', 'jpeg', 'webp', 'avif'];

const { t } = useI18n();
const U = 'tools.image-cropper.ui.';

const cropLabel = computed(() => {
  const r = cropRect.value;
  if (!r) return t(U + 'noSelection');
  return t(U + 'cropLabel', { w: Math.round(r.width), h: Math.round(r.height) });
});

/** Convert a pointer event to image pixel coordinates. */
function toImageCoords(e: PointerEvent): { x: number; y: number } {
  const img = imgEl.value;
  if (!img) return { x: 0, y: 0 };
  const bounds = img.getBoundingClientRect();
  const scaleX = imageWidth.value / Math.max(1, bounds.width);
  const scaleY = imageHeight.value / Math.max(1, bounds.height);
  return {
    x: (e.clientX - bounds.left) * scaleX,
    y: (e.clientY - bounds.top) * scaleY,
  };
}

function onPointerDown(e: PointerEvent): void {
  if (!hasImage.value) return;
  dragging.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  dragStart = toImageCoords(e);
  setCropRect({ x: dragStart.x, y: dragStart.y, width: 0, height: 0 });
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return;
  const cur = toImageCoords(e);
  const rect = rectFromPoints(
    dragStart.x,
    dragStart.y,
    cur.x,
    cur.y,
    presetRatio(preset.value),
    imageWidth.value,
    imageHeight.value,
  );
  setCropRect(rect);
}

function onPointerUp(): void {
  dragging.value = false;
}

/** Crop rect expressed in display (CSS pixel) coordinates for the overlay. */
const overlayRect = computed(() => {
  const r = cropRect.value;
  const img = imgEl.value;
  if (!r || !img) return null;
  const bounds = img.getBoundingClientRect();
  const scaleX = bounds.width / Math.max(1, imageWidth.value);
  const scaleY = bounds.height / Math.max(1, imageHeight.value);
  return {
    left: `${r.x * scaleX}px`,
    top: `${r.y * scaleY}px`,
    width: `${r.width * scaleX}px`,
    height: `${r.height * scaleY}px`,
  };
});

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}

function onPreset(e: Event): void {
  preset.value = (e.target as HTMLSelectElement).value as AspectPreset;
}
function onFormat(e: Event): void {
  format.value = (e.target as HTMLSelectElement).value as RasterFormat;
}

function resetOptions(): void {
  preset.value = DEFAULT_PRESET;
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

      <div v-if="hasImage" class="qt-grid" style="--qt-grid-min:160px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'aspectRatio') }}</span>
          <select class="qt-input" :value="preset" @change="onPreset">
            <option v-for="p in ASPECT_PRESETS" :key="p" :value="p">
              {{ p === 'free' ? t(U + 'freeform') : p }}
            </option>
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

        <label v-if="showQuality" class="qt-field">
          <span class="qt-label">{{ t('common.quality') }} · {{ qualityPct }}%</span>
          <input v-model.number="qualityPct" class="qt-range" style="width:100%" type="range" min="1" max="100" step="1" />
        </label>

        <label v-if="showBackground" class="qt-field">
          <span class="qt-label">{{ t('common.background') }}</span>
          <input v-model="background" class="cropper__color" type="color" />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasImage ? t(U + 'descSource', { name: imageName, w: imageWidth, h: imageHeight, sel: cropLabel }) : t('common.noImageLoaded')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!hasImage"
          :title="t(U + 'selectAllTitle')"
          @click="selectAll"
        >
          <Maximize :size="14" /> {{ t(U + 'selectAll') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm cropper__btn--primary"
          :disabled="!hasImage || isCropping"
          @click="applyCrop"
        >
          <Crop :size="14" /> {{ isCropping ? t(U + 'cropping') : t(U + 'crop') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!outputUrl"
          :title="t(U + 'downloadTitle')"
          @click="download"
        >
          <Download :size="14" /> {{ t('common.download') }}
        </button>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :disabled="!hasImage" :title="t('common.clear')" @click="reset">
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-if="hasImage" class="qt-row" style="justify-content:center">
        <div
          class="cropper__stage"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <img ref="imgEl" :src="imageUrl!" class="cropper__img" :alt="imageName" draggable="false" />
          <div v-if="overlayRect" class="cropper__selection" :style="overlayRect">
            <span class="cropper__selection-label">{{ cropLabel }}</span>
          </div>
        </div>
      </div>

      <div v-if="outputUrl" class="qt-stack" style="--qt-stack-gap:6px">
        <span class="qt-label" style="font-size:11px">{{ t('common.result') }} · {{ formatBytes(outputSizeBytes) }}</span>
        <img :src="outputUrl" class="cropper__preview" :alt="t(U + 'altCropped')" />
      </div>

      <div v-if="!hasImage" class="cropper__placeholder">
        <Crop :size="36" class="cropper__placeholder-icon" />
        <span>{{ t('common.loadImageStart') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Background colour swatch — small 48×32 picker. */
.cropper__color {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  cursor: pointer;
}
/* Crop action (base via .qt-btn--ghost) — accent outline. */
.cropper__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Drag-select stage — crosshair, no touch-scroll/text-select. */
.cropper__stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}
.cropper__img {
  display: block;
  max-width: 100%;
  max-height: 420px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  pointer-events: none;
}
/* Crop overlay — accent frame + dimmed surround + size label. */
.cropper__selection {
  position: absolute;
  border: 1.5px solid var(--qt-accent);
  background: oklch(from var(--qt-accent) 60% c h / 15%);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.cropper__selection-label {
  position: absolute;
  top: -22px;
  left: 0;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: var(--qt-accent);
  border-radius: 4px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
/* Cropped result — checkerboard backdrop for transparency. */
.cropper__preview {
  display: block;
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
  align-self: flex-start;
  background: repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
}
/* Centered empty state — big icon + prompt. */
.cropper__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.cropper__placeholder-icon {
  opacity: 0.4;
}
</style>
