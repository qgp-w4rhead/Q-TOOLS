<script setup lang="ts">
/**
 * SvgPlaceholderGenerator - build SVG placeholder images from dimensions,
 * colors, text and font size.
 *
 * Inputs: width, height, background color, text (label), text color, font
 * size. Output: a live SVG preview rendered inline, with SVG and PNG
 * downloads.
 *
 * The SVG is generated entirely by hand-rolled string assembly - no external
 * dependencies. PNG download rasterises the SVG via the browser's `Image` +
 * `<canvas>` APIs.
 *
 * Works in embed mode: receives `input`/`width`/`height`/`background`/`text`/
 * `textColor`/`fontSize` PostMessages to pre-fill the fields; sends `output`
 * PostMessages with `{ svgString, width, height, … }` whenever the generated
 * SVG changes.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Image as ImageIcon,
  FileCode,
  RotateCcw,
  Palette,
  AlertTriangle,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useSvgPlaceholderGenerator,
  svgToPngDataUrl,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_BACKGROUND,
  DEFAULT_TEXT_COLOR,
  DEFAULT_FONT_SIZE,
  MIN_DIM,
  MAX_DIM,
  MIN_FONT,
  MAX_FONT,
} from './useSvgPlaceholderGenerator';

const {
  width,
  height,
  background,
  text,
  textColor,
  fontSize,
  svgString,
  error,
} = useSvgPlaceholderGenerator();

const { t } = useI18n();
const U = 'tools.svg-placeholder-generator.ui.';

const hasOutput = computed(() => svgString.value.length > 0);
const dimensionsLabel = computed(() => `${width.value}\u00D7${height.value}`);

const pngBusy = ref(false);
const pngError = ref<string | null>(null);

function onWidth(e: Event): void {
  width.value = Number((e.target as HTMLInputElement).value);
}
function onHeight(e: Event): void {
  height.value = Number((e.target as HTMLInputElement).value);
}
function onBackground(e: Event): void {
  background.value = (e.target as HTMLInputElement).value;
}
function onText(e: Event): void {
  text.value = (e.target as HTMLInputElement).value;
}
function onTextColor(e: Event): void {
  textColor.value = (e.target as HTMLInputElement).value;
}
function onFontSize(e: Event): void {
  fontSize.value = Number((e.target as HTMLInputElement).value);
}

/** Trigger a browser download for a string blob. */
function downloadString(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadSvg(): void {
  if (!svgString.value) return;
  downloadString(svgString.value, `placeholder-${dimensionsLabel.value}.svg`, 'image/svg+xml');
}

async function downloadPng(): Promise<void> {
  if (!svgString.value) return;
  pngBusy.value = true;
  pngError.value = null;
  try {
    const dataUrl = await svgToPngDataUrl(svgString.value, width.value, height.value);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `placeholder-${dimensionsLabel.value}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    pngError.value = (err as Error).message || t(U + 'errRasterise');
  } finally {
    pngBusy.value = false;
  }
}

function resetOptions(): void {
  width.value = DEFAULT_WIDTH;
  height.value = DEFAULT_HEIGHT;
  background.value = DEFAULT_BACKGROUND;
  text.value = '';
  textColor.value = DEFAULT_TEXT_COLOR;
  fontSize.value = DEFAULT_FONT_SIZE;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :title="t(U + 'resetTitle')"
          @click="resetOptions"
        >
          <RotateCcw :size="14" /> {{ t('common.reset') }}
        </button>
      </template>

      <div class="qt-grid" style="--qt-grid-min:160px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t('common.width') }}</span>
          <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
            <input
              type="number"
              :min="MIN_DIM"
              :max="MAX_DIM"
              step="1"
              :value="width"
              class="qt-input qt-input--mono svgph__num"
              @input="onWidth"
            />
            <span class="qt-input-suffix">px</span>
          </span>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t('common.height') }}</span>
          <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
            <input
              type="number"
              :min="MIN_DIM"
              :max="MAX_DIM"
              step="1"
              :value="height"
              class="qt-input qt-input--mono svgph__num"
              @input="onHeight"
            />
            <span class="qt-input-suffix">px</span>
          </span>
        </label>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'textOptional') }}</span>
        <input
          type="text"
          class="qt-input"
          :placeholder="t(U + 'textPlaceholder')"
          :value="text"
          spellcheck="false"
          autocomplete="off"
          @input="onText"
        />
      </label>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'fontSize') }}</span>
        <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
          <input
            type="range"
            :min="MIN_FONT"
            :max="MAX_FONT"
            step="1"
            :value="fontSize"
            class="qt-range"
            @input="onFontSize"
          />
          <span class="svgph__range-value">{{ fontSize }}px</span>
        </span>
      </label>

      <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label"><Palette :size="12" /> {{ t('common.background') }}</span>
          <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
            <input
              type="color"
              :value="background"
              class="svgph__color-picker"
              @input="onBackground"
            />
            <input
              type="text"
              :value="background"
              class="qt-input qt-input--mono svgph__color-text"
              spellcheck="false"
              @input="onBackground"
            />
          </span>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'textColor') }}</span>
          <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
            <input
              type="color"
              :value="textColor"
              class="svgph__color-picker"
              @input="onTextColor"
            />
            <input
              type="text"
              :value="textColor"
              class="qt-input qt-input--mono svgph__color-text"
              spellcheck="false"
              @input="onTextColor"
            />
          </span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasOutput ? t(U + 'descResult', { dims: dimensionsLabel }) : t(U + 'descEmpty')"
    >
      <template #actions>
        <CopyButton
          v-if="hasOutput"
          :text="svgString"
          :label="t(U + 'copySvg')"
        />
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!hasOutput || pngBusy"
          :title="pngBusy ? t(U + 'rasterising') : t(U + 'downloadPng')"
          @click="downloadPng"
        >
          <ImageIcon :size="14" /> {{ pngBusy ? '…' : 'PNG' }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!hasOutput"
          :title="t(U + 'downloadSvg')"
          @click="downloadSvg"
        >
          <FileCode :size="14" /> SVG
        </button>
      </template>

      <div v-if="error || pngError" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error || pngError }}</span>
      </div>

      <div v-else-if="hasOutput" class="qt-stack" style="--qt-stack-gap:16px;align-items:center;padding:16px">
        <div class="svgph__preview-frame" v-html="svgString" />
        <div class="qt-row" style="--qt-row-gap:6px;justify-content:center">
          <span class="qt-badge">{{ dimensionsLabel }}</span>
          <span class="qt-badge">{{ t(U + 'badgeFont', { size: fontSize }) }}</span>
          <span class="qt-badge">{{ t(U + 'badgeBytes', svgString.length) }}</span>
        </div>
      </div>

      <div v-else class="svgph__placeholder">
        <ImageIcon :size="48" class="svgph__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Dimension number input (control + mono via .qt-input--mono) — grows, tabular. */
.svgph__num {
  flex: 1;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
/* Range readout — fixed-width tabular value. */
.svgph__range-value {
  font-size: 12px;
  color: var(--qt-text);
  min-width: 56px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* Native colour-picker swatch — fixed 36px square. */
.svgph__color-picker {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}
/* Hex text input (control + mono via .qt-input--mono) — grows, lowercase. */
.svgph__color-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  text-transform: lowercase;
}
/* Centered empty state — big icon + prompt. */
.svgph__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--qt-muted);
  text-align: center;
  font-size: 13px;
}
.svgph__placeholder-icon {
  opacity: 0.4;
}
/* SVG preview frame — checkerboard backdrop for transparency. */
.svgph__preview-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  overflow: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background:
    linear-gradient(45deg, var(--qt-border) 25%, transparent 25%) -10px 0,
    linear-gradient(-45deg, var(--qt-border) 25%, transparent 25%) -10px 0,
    linear-gradient(45deg, transparent 75%, var(--qt-border) 75%) -10px 0,
    linear-gradient(-45deg, transparent 75%, var(--qt-border) 75%) -10px 0;
  background-size: 20px 20px;
  padding: 12px;
}
.svgph__preview-frame :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
