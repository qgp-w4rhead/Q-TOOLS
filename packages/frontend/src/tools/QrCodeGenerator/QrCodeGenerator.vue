<script setup lang="ts">
/**
 * QrCodeGenerator - render arbitrary text/URLs as QR codes.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.qr-code-generator.ui.';

const ECL_LABEL_KEYS: Record<ErrorCorrectionLevel, string> = {
  L: 'eclL',
  M: 'eclM',
  Q: 'eclQ',
  H: 'eclH',
};
function eclOptionLabel(lvl: (typeof ERROR_CORRECTION_LEVELS)[number]): string {
  return t(U + 'eclOption', {
    label: t(U + ECL_LABEL_KEYS[lvl.value]),
    value: lvl.value,
    recovery: lvl.recovery,
  });
}

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

      <textarea
        class="qt-input qt-input--mono qr__textarea"
        :placeholder="t(U + 'placeholder')"
        :value="text"
        rows="3"
        spellcheck="false"
        autocomplete="off"
        @input="onText"
      />

      <div class="qt-stack" style="--qt-stack-gap:14px">
        <label class="qt-field">
          <span class="qt-label">{{ t('common.size') }}</span>
          <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:10px">
            <input
              type="range"
              :min="MIN_SIZE"
              :max="MAX_SIZE"
              step="16"
              :value="size"
              class="qt-range"
              @input="onSize"
            />
            <span class="qr__range-value">{{ size }}px</span>
          </span>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'margin') }}</span>
          <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:10px">
            <input
              type="range"
              :min="MIN_MARGIN"
              :max="MAX_MARGIN"
              step="1"
              :value="margin"
              class="qt-range"
              @input="onMargin"
            />
            <span class="qr__range-value">{{ margin }} {{ t(U + 'modules') }}</span>
          </span>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'errorCorrection') }}</span>
          <select
            class="qt-input"
            :value="errorCorrectionLevel"
            @change="onEcl"
          >
            <option
              v-for="lvl in ERROR_CORRECTION_LEVELS"
              :key="lvl.value"
              :value="lvl.value"
            >
              {{ eclOptionLabel(lvl) }}
            </option>
          </select>
        </label>

        <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:12px">
          <label class="qt-field">
            <span class="qt-label"><Palette :size="12" /> {{ t('common.foreground') }}</span>
            <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
              <input
                type="color"
                :value="foreground"
                class="qr__color-picker"
                @input="onForeground"
              />
              <input
                type="text"
                :value="foreground"
                class="qt-input qt-input--mono qr__color-text"
                spellcheck="false"
                @input="onForeground"
              />
            </span>
          </label>

          <label class="qt-field">
            <span class="qt-label">{{ t('common.background') }}</span>
            <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
              <input
                type="color"
                :value="background"
                class="qr__color-picker"
                @input="onBackground"
              />
              <input
                type="text"
                :value="background"
                class="qt-input qt-input--mono qr__color-text"
                spellcheck="false"
                @input="onBackground"
              />
            </span>
          </label>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasText ? t(U + 'descResult', { size, ecl: errorCorrectionLevel, margin }) : t(U + 'descEmpty')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!hasOutput"
          :title="t(U + 'downloadPng')"
          @click="downloadPng"
        >
          <ImageIcon :size="14" /> PNG
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

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-else-if="computing && !hasOutput" class="qr__placeholder">
        <QrCode :size="48" class="qr__placeholder-icon" />
        <span>{{ t('common.generating') }}</span>
      </div>

      <div v-else-if="!hasText" class="qr__placeholder">
        <QrCode :size="48" class="qr__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>

      <div v-else-if="hasOutput" class="qt-stack" style="--qt-stack-gap:16px;align-items:center;padding:16px">
        <img
          :src="pngDataUrl"
          :alt="t(U + 'imgAlt', { text })"
          class="qr__img"
          :style="{ maxWidth: `${size}px`, width: '100%' }"
        />
        <div class="qt-row" style="--qt-row-gap:6px;justify-content:center">
          <span class="qt-badge">{{ size }}×{{ size }}</span>
          <span class="qt-badge">{{ t(U + 'badgeEcl', { ecl: errorCorrectionLevel }) }}</span>
          <span class="qt-badge">{{ t(U + 'badgeMargin', { margin }) }}</span>
          <span class="qt-badge">{{ t('common.chars', text.length) }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.qr__textarea {
  min-height: 72px;
  font-size: 13px;
}
/* Range readout — fixed-width tabular value. */
.qr__range-value {
  font-size: 12px;
  color: var(--qt-text);
  min-width: 92px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* Native colour-picker swatch — fixed 36px square. */
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
/* Hex text input (control + mono via .qt-input--mono) — grows, lowercase. */
.qr__color-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  text-transform: lowercase;
}
/* Centered empty/generating state — big icon + prompt. */
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
/* QR preview image — white card, pixel-perfect rendering. */
.qr__img {
  display: block;
  height: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: #ffffff;
  image-rendering: pixelated;
}
</style>
