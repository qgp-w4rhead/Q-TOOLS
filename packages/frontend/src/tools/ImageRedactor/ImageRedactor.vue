<script setup lang="ts">
/**
 * ImageRedactor - draw rectangles over an image to blur, pixelate, or
 * black-out regions (faces, license plates, text). Regions are stored in
 * image pixel coordinates; the component renders the image inside a
 * positioned container and tracks pointer events on an overlay, converting
 * screen → image coords via the rendered scale. Everything runs locally.
 *
 * Embed mode: accepts `mode`/`strength`/`format`/`action` inputs and sends
 * status outputs (region count, output size, errors).
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { EyeOff, Download, Trash2, AlertTriangle, Undo2, Ban } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import {
  useImageRedactor,
  normalizeRect,
  clampRect,
  REDACT_MODES,
  DEFAULT_MODE,
  DEFAULT_STRENGTH,
  MIN_STRENGTH,
  MAX_STRENGTH,
  type RedactMode,
  type RedactRect,
} from './useImageRedactor';
import { formatSupportsAlpha, formatSupportsQuality, type RasterFormat } from '@/utils/image';
import { formatBytes } from '@/utils/media';

const {
  hasImage,
  imageUrl,
  imageName,
  imageWidth,
  imageHeight,
  mode,
  strength,
  regions,
  draftRect,
  format,
  quality,
  background,
  encodableFormats,
  outputUrl,
  outputSizeBytes,
  isApplying,
  error,
  setFile,
  setDraft,
  commitDraft,
  undoLast,
  clearRegions,
  apply,
  download,
  reset,
} = useImageRedactor();

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
const { t } = useI18n();
const U = 'tools.image-redactor.ui.';

const formatOptions: RasterFormat[] = ['png', 'jpeg', 'webp', 'avif'];
const MODE_KEYS: Record<RedactMode, string> = {
  blur: 'modeBlur',
  pixelate: 'modePixelate',
  solid: 'modeSolid',
};
function modeLabel(m: RedactMode): string {
  return t(U + MODE_KEYS[m]);
}

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
  setDraft({ x: dragStart.x, y: dragStart.y, width: 0, height: 0 });
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return;
  const cur = toImageCoords(e);
  setDraft(
    clampRect(
      { x: dragStart.x, y: dragStart.y, width: cur.x - dragStart.x, height: cur.y - dragStart.y },
      imageWidth.value,
      imageHeight.value,
    ),
  );
}

function onPointerUp(): void {
  if (!dragging.value) return;
  dragging.value = false;
  commitDraft();
}

/** Convert an image-space rect to CSS-pixel overlay style. */
function overlayStyle(r: RedactRect): Record<string, string> {
  const img = imgEl.value;
  if (!img) return {};
  const bounds = img.getBoundingClientRect();
  const scaleX = bounds.width / Math.max(1, imageWidth.value);
  const scaleY = bounds.height / Math.max(1, imageHeight.value);
  const n = normalizeRect(r);
  return {
    left: `${n.x * scaleX}px`,
    top: `${n.y * scaleY}px`,
    width: `${n.width * scaleX}px`,
    height: `${n.height * scaleY}px`,
  };
}

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}

function onMode(e: Event): void {
  mode.value = (e.target as HTMLSelectElement).value as RedactMode;
}
function onFormat(e: Event): void {
  format.value = (e.target as HTMLSelectElement).value as RasterFormat;
}

function resetOptions(): void {
  mode.value = DEFAULT_MODE;
  strength.value = DEFAULT_STRENGTH;
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
          <span class="qt-label">{{ t('common.mode') }}</span>
          <select class="qt-input" :value="mode" @change="onMode">
            <option v-for="m in REDACT_MODES" :key="m" :value="m">{{ modeLabel(m) }}</option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'strength') }} · {{ strength }}</span>
          <input
            v-model.number="strength"
            class="qt-range"
            style="width:100%"
            type="range"
            :min="MIN_STRENGTH"
            :max="MAX_STRENGTH"
            step="1"
          />
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
          <input v-model="background" class="redact__color" type="color" />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasImage ? t(U + 'descSource', { name: imageName, w: imageWidth, h: imageHeight, regions: t(U + 'regionCount', regions.length) }) : t('common.noImageLoaded')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="regions.length === 0"
          :title="t(U + 'undoTitle')"
          @click="undoLast"
        >
          <Undo2 :size="14" /> {{ t(U + 'undo') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="regions.length === 0"
          :title="t(U + 'clearRegionsTitle')"
          @click="clearRegions"
        >
          <Ban :size="14" /> {{ t(U + 'clearRegions') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm redact__btn--primary"
          :disabled="!hasImage || regions.length === 0 || isApplying"
          @click="apply"
        >
          <EyeOff :size="14" /> {{ isApplying ? t(U + 'applying') : t(U + 'apply') }}
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
          class="redact__stage"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <img ref="imgEl" :src="imageUrl!" class="redact__img" :alt="imageName" draggable="false" />
          <div
            v-for="(r, i) in regions"
            :key="i"
            class="redact__region"
            :style="overlayStyle(r)"
          />
          <div v-if="draftRect" class="redact__region redact__region--draft" :style="overlayStyle(draftRect)" />
        </div>
      </div>

      <div v-if="outputUrl" class="qt-stack" style="--qt-stack-gap:6px">
        <span class="qt-label" style="font-size:11px">{{ t('common.result') }} · {{ formatBytes(outputSizeBytes) }}</span>
        <img :src="outputUrl" class="redact__preview" :alt="t(U + 'altRedacted')" />
      </div>

      <div v-if="!hasImage" class="redact__placeholder">
        <EyeOff :size="36" class="redact__placeholder-icon" />
        <span>{{ t('common.loadImageStart') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Background colour swatch — small 48×32 picker. */
.redact__color {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  cursor: pointer;
}
/* Apply action (base via .qt-btn--ghost) — accent outline. */
.redact__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Drag-select stage — crosshair, no touch-scroll/text-select. */
.redact__stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
}
.redact__img {
  display: block;
  max-width: 100%;
  max-height: 420px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  pointer-events: none;
}
/* Redact region overlay — danger frame + tint; draft is dashed. */
.redact__region {
  position: absolute;
  border: 1.5px solid var(--qt-danger, #ef4444);
  background: oklch(from var(--qt-danger, #ef4444) 55% c h / 18%);
  pointer-events: none;
}
.redact__region--draft {
  border-style: dashed;
}
/* Redacted result — checkerboard backdrop for transparency. */
.redact__preview {
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
.redact__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.redact__placeholder-icon {
  opacity: 0.4;
}
</style>
