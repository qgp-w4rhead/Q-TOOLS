<script setup lang="ts">
/**
 * SvgPlaceholderGenerator — build SVG placeholder images from dimensions,
 * colors, text and font size.
 *
 * Inputs: width, height, background color, text (label), text color, font
 * size. Output: a live SVG preview rendered inline, with SVG and PNG
 * downloads.
 *
 * The SVG is generated entirely by hand-rolled string assembly — no external
 * dependencies. PNG download rasterises the SVG via the browser's `Image` +
 * `<canvas>` APIs.
 *
 * Works in embed mode: receives `input`/`width`/`height`/`background`/`text`/
 * `textColor`/`fontSize` PostMessages to pre-fill the fields; sends `output`
 * PostMessages with `{ svgString, width, height, … }` whenever the generated
 * SVG changes.
 */
import { computed, ref } from 'vue';
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
    pngError.value = (err as Error).message || 'Failed to rasterise PNG.';
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
  <div class="svgph">
    <ToolInput
      title="Input"
      description="Configure the placeholder dimensions, colors and label."
    >
      <template #actions>
        <button
          type="button"
          class="svgph__reset-btn"
          title="Reset options to defaults"
          @click="resetOptions"
        >
          <RotateCcw :size="14" /> Reset
        </button>
      </template>

      <div class="svgph__dims">
        <label class="svgph__field">
          <span class="svgph__label">Width</span>
          <span class="svgph__num-row">
            <input
              type="number"
              :min="MIN_DIM"
              :max="MAX_DIM"
              step="1"
              :value="width"
              class="svgph__num"
              @input="onWidth"
            />
            <span class="svgph__unit">px</span>
          </span>
        </label>

        <label class="svgph__field">
          <span class="svgph__label">Height</span>
          <span class="svgph__num-row">
            <input
              type="number"
              :min="MIN_DIM"
              :max="MAX_DIM"
              step="1"
              :value="height"
              class="svgph__num"
              @input="onHeight"
            />
            <span class="svgph__unit">px</span>
          </span>
        </label>
      </div>

      <label class="svgph__field">
        <span class="svgph__label">Text (optional)</span>
        <input
          type="text"
          class="svgph__text"
          placeholder="Leave empty to show the dimensions"
          :value="text"
          spellcheck="false"
          autocomplete="off"
          @input="onText"
        />
      </label>

      <label class="svgph__field">
        <span class="svgph__label">Font size</span>
        <span class="svgph__range-row">
          <input
            type="range"
            :min="MIN_FONT"
            :max="MAX_FONT"
            step="1"
            :value="fontSize"
            class="svgph__range"
            @input="onFontSize"
          />
          <span class="svgph__range-value">{{ fontSize }}px</span>
        </span>
      </label>

      <div class="svgph__colors">
        <label class="svgph__field svgph__color-field">
          <span class="svgph__label"><Palette :size="12" /> Background</span>
          <span class="svgph__color-row">
            <input
              type="color"
              :value="background"
              class="svgph__color-picker"
              @input="onBackground"
            />
            <input
              type="text"
              :value="background"
              class="svgph__color-text"
              spellcheck="false"
              @input="onBackground"
            />
          </span>
        </label>

        <label class="svgph__field svgph__color-field">
          <span class="svgph__label">Text color</span>
          <span class="svgph__color-row">
            <input
              type="color"
              :value="textColor"
              class="svgph__color-picker"
              @input="onTextColor"
            />
            <input
              type="text"
              :value="textColor"
              class="svgph__color-text"
              spellcheck="false"
              @input="onTextColor"
            />
          </span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="SVG placeholder"
      :description="hasOutput ? `${dimensionsLabel} · SVG` : 'Configure the inputs to generate a placeholder.'"
    >
      <template #actions>
        <CopyButton
          v-if="hasOutput"
          :text="svgString"
          label="SVG"
        />
        <button
          type="button"
          class="svgph__download-btn"
          :disabled="!hasOutput || pngBusy"
          :title="pngBusy ? 'Rasterising…' : 'Download PNG'"
          @click="downloadPng"
        >
          <ImageIcon :size="14" /> {{ pngBusy ? '…' : 'PNG' }}
        </button>
        <button
          type="button"
          class="svgph__download-btn"
          :disabled="!hasOutput"
          title="Download SVG"
          @click="downloadSvg"
        >
          <FileCode :size="14" /> SVG
        </button>
      </template>

      <div v-if="error || pngError" class="svgph__error">
        <AlertTriangle :size="16" />
        <span>{{ error || pngError }}</span>
      </div>

      <div v-else-if="hasOutput" class="svgph__preview">
        <div class="svgph__preview-frame" v-html="svgString" />
        <div class="svgph__meta">
          <span class="svgph__meta-pill">{{ dimensionsLabel }}</span>
          <span class="svgph__meta-pill">{{ fontSize }}px font</span>
          <span class="svgph__meta-pill">{{ svgString.length }} bytes</span>
        </div>
      </div>

      <div v-else class="svgph__placeholder">
        <ImageIcon :size="48" class="svgph__placeholder-icon" />
        <span>Configure the inputs to generate a placeholder.</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.svgph {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
}
.svgph__dims {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.svgph__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.svgph__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.svgph__num-row,
.svgph__range-row,
.svgph__color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.svgph__num {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 13px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  outline: none;
  font-variant-numeric: tabular-nums;
}
.svgph__num:focus {
  border-color: var(--qt-accent);
}
.svgph__unit {
  font-size: 12px;
  color: var(--qt-muted);
  min-width: 18px;
}
.svgph__text {
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  outline: none;
}
.svgph__text:focus {
  border-color: var(--qt-accent);
}
.svgph__range {
  flex: 1;
  accent-color: var(--qt-accent);
}
.svgph__range-value {
  font-size: 12px;
  color: var(--qt-text);
  min-width: 56px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.svgph__colors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
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
.svgph__color-text {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  outline: none;
  text-transform: lowercase;
}
.svgph__color-text:focus {
  border-color: var(--qt-accent);
}
.svgph__reset-btn,
.svgph__download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.svgph__reset-btn:hover,
.svgph__download-btn:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.svgph__download-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
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
.svgph__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
}
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
.svgph__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}
.svgph__meta-pill {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.svgph__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--qt-radius);
  background: oklch(from var(--qt-warning, #f59e0b) 25% c h / 12%);
  color: var(--qt-warning, #f59e0b);
  font-size: 13px;
}
</style>
