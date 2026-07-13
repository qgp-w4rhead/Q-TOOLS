<script setup lang="ts">
/**
 * QrCodeGenerator — render arbitrary text/URLs as QR codes.
 *
 * Inputs: text/URL, size (px), error correction level (L/M/Q/H), margin
 * (quiet-zone modules), foreground + background colors. Output: a live QR
 * preview (PNG via `<img>`), with PNG and SVG downloads.
 *
 * Uses the `qrcode` package (initial bundle, statically imported). No other
 * external dependencies.
 *
 * Works in embed mode: receives `input`/`text`/`url`/`value`/`content`
 * PostMessages to pre-fill the text field, plus optional `size`, `margin`,
 * `errorCorrectionLevel`, `foreground`, `background`; sends `output`
 * PostMessages with `{ pngDataUrl, svgString, text, size, … }` whenever the
 * rendered QR changes.
 */
import { computed } from 'vue';
import {
  QrCode,
  Image as ImageIcon,
  FileCode,
  RotateCcw,
  Palette,
  AlertTriangle,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useQrCodeGenerator,
  ERROR_CORRECTION_LEVELS,
  DEFAULT_QR_OPTIONS,
  DEFAULT_SIZE,
  MIN_SIZE,
  MAX_SIZE,
  DEFAULT_MARGIN,
  MIN_MARGIN,
  MAX_MARGIN,
  DEFAULT_FOREGROUND,
  DEFAULT_BACKGROUND,
  type ErrorCorrectionLevel,
} from './useQrCodeGenerator';

const {
  text,
  size,
  errorCorrectionLevel,
  margin,
  foreground,
  background,
  pngDataUrl,
  svgString,
  error,
  computing,
} = useQrCodeGenerator();

const hasText = computed(() => text.value.trim().length > 0);
const hasOutput = computed(() => pngDataUrl.value.length > 0);

function onText(e: Event): void {
  text.value = (e.target as HTMLTextAreaElement).value;
}
function onSize(e: Event): void {
  size.value = Number((e.target as HTMLInputElement).value);
}
function onMargin(e: Event): void {
  margin.value = Number((e.target as HTMLInputElement).value);
}
function onEcl(e: Event): void {
  errorCorrectionLevel.value = (e.target as HTMLSelectElement).value as ErrorCorrectionLevel;
}
function onForeground(e: Event): void {
  foreground.value = (e.target as HTMLInputElement).value;
}
function onBackground(e: Event): void {
  background.value = (e.target as HTMLInputElement).value;
}

/** Trigger a browser download for a data URL or string blob. */
function download(content: string, filename: string, mime: string): void {
  const blob =
    mime === 'image/png' && content.startsWith('data:')
      ? dataUrlToBlob(content)
      : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Convert a `data:image/png;base64,…` string to a Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const isBase64 = /;base64/i.test(meta);
  const mimeMatch = /^data:([^;]+)/.exec(meta);
  const mime = mimeMatch ? mimeMatch[1]! : 'image/png';
  if (isBase64 && typeof atob === 'function') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  // Fallback: decode as URL-encoded text.
  return new Blob([decodeURIComponent(base64)], { type: mime });
}

function downloadPng(): void {
  if (!pngDataUrl.value) return;
  download(pngDataUrl.value, 'qr-code.png', 'image/png');
}
function downloadSvg(): void {
  if (!svgString.value) return;
  download(svgString.value, 'qr-code.svg', 'image/svg+xml');
}

function resetOptions(): void {
  size.value = DEFAULT_SIZE;
  margin.value = DEFAULT_MARGIN;
  errorCorrectionLevel.value = DEFAULT_QR_OPTIONS.errorCorrectionLevel;
  foreground.value = DEFAULT_FOREGROUND;
  background.value = DEFAULT_BACKGROUND;
}
</script>

<template>
  <div class="qr">
    <ToolInput
      title="Input"
      description="Text or URL to encode as a QR code."
    >
      <template #actions>
        <button
          type="button"
          class="qr__reset-btn"
          title="Reset options to defaults"
          @click="resetOptions"
        >
          <RotateCcw :size="14" /> Reset
        </button>
      </template>

      <textarea
        class="qr__textarea"
        placeholder="https://example.com — or any text to encode"
        :value="text"
        rows="3"
        spellcheck="false"
        autocomplete="off"
        @input="onText"
      />

      <div class="qr__options">
        <label class="qr__field">
          <span class="qr__label">Size</span>
          <span class="qr__range-row">
            <input
              type="range"
              :min="MIN_SIZE"
              :max="MAX_SIZE"
              step="16"
              :value="size"
              class="qr__range"
              @input="onSize"
            />
            <span class="qr__range-value">{{ size }}px</span>
          </span>
        </label>

        <label class="qr__field">
          <span class="qr__label">Margin (quiet zone)</span>
          <span class="qr__range-row">
            <input
              type="range"
              :min="MIN_MARGIN"
              :max="MAX_MARGIN"
              step="1"
              :value="margin"
              class="qr__range"
              @input="onMargin"
            />
            <span class="qr__range-value">{{ margin }} modules</span>
          </span>
        </label>

        <label class="qr__field">
          <span class="qr__label">Error correction</span>
          <select
            class="qr__select"
            :value="errorCorrectionLevel"
            @change="onEcl"
          >
            <option
              v-for="lvl in ERROR_CORRECTION_LEVELS"
              :key="lvl.value"
              :value="lvl.value"
            >
              {{ lvl.label }} ({{ lvl.value }}) — recovers {{ lvl.recovery }}
            </option>
          </select>
        </label>

        <div class="qr__colors">
          <label class="qr__field qr__color-field">
            <span class="qr__label"><Palette :size="12" /> Foreground</span>
            <span class="qr__color-row">
              <input
                type="color"
                :value="foreground"
                class="qr__color-picker"
                @input="onForeground"
              />
              <input
                type="text"
                :value="foreground"
                class="qr__color-text"
                spellcheck="false"
                @input="onForeground"
              />
            </span>
          </label>

          <label class="qr__field qr__color-field">
            <span class="qr__label">Background</span>
            <span class="qr__color-row">
              <input
                type="color"
                :value="background"
                class="qr__color-picker"
                @input="onBackground"
              />
              <input
                type="text"
                :value="background"
                class="qr__color-text"
                spellcheck="false"
                @input="onBackground"
              />
            </span>
          </label>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      title="QR code"
      :description="hasText ? `${size}×${size}px · ${errorCorrectionLevel} · margin ${margin}` : 'Enter text to generate a QR code.'"
    >
      <template #actions>
        <button
          type="button"
          class="qr__download-btn"
          :disabled="!hasOutput"
          title="Download PNG"
          @click="downloadPng"
        >
          <ImageIcon :size="14" /> PNG
        </button>
        <button
          type="button"
          class="qr__download-btn"
          :disabled="!hasOutput"
          title="Download SVG"
          @click="downloadSvg"
        >
          <FileCode :size="14" /> SVG
        </button>
      </template>

      <div v-if="error" class="qr__error">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-else-if="computing && !hasOutput" class="qr__placeholder">
        <QrCode :size="48" class="qr__placeholder-icon" />
        <span>Generating…</span>
      </div>

      <div v-else-if="!hasText" class="qr__placeholder">
        <QrCode :size="48" class="qr__placeholder-icon" />
        <span>Enter text or a URL to generate a QR code.</span>
      </div>

      <div v-else-if="hasOutput" class="qr__preview">
        <img
          :src="pngDataUrl"
          :alt="`QR code for: ${text}`"
          class="qr__img"
          :style="{ maxWidth: `${size}px`, width: '100%' }"
        />
        <div class="qr__meta">
          <span class="qr__meta-pill">{{ size }}×{{ size }}</span>
          <span class="qr__meta-pill">ECL {{ errorCorrectionLevel }}</span>
          <span class="qr__meta-pill">margin {{ margin }}</span>
          <span class="qr__meta-pill">{{ text.length }} chars</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.qr {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
}
.qr__textarea {
  width: 100%;
  resize: vertical;
  min-height: 72px;
  padding: 10px 12px;
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 13px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  outline: none;
}
.qr__textarea:focus {
  border-color: var(--qt-accent);
}
.qr__options {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.qr__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qr__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.qr__range-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.qr__range {
  flex: 1;
  accent-color: var(--qt-accent);
}
.qr__range-value {
  font-size: 12px;
  color: var(--qt-text);
  min-width: 92px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.qr__select {
  padding: 8px 10px;
  font-size: 13px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  outline: none;
}
.qr__select:focus {
  border-color: var(--qt-accent);
}
.qr__colors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.qr__color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.qr__color-picker {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}
.qr__color-text {
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
.qr__color-text:focus {
  border-color: var(--qt-accent);
}
.qr__reset-btn,
.qr__download-btn {
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
.qr__reset-btn:hover,
.qr__download-btn:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.qr__download-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.qr__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--qt-muted);
  text-align: center;
  font-size: 13px;
}
.qr__placeholder-icon {
  opacity: 0.4;
}
.qr__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
}
.qr__img {
  display: block;
  height: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: #ffffff;
  image-rendering: pixelated;
}
.qr__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}
.qr__meta-pill {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.qr__error {
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
