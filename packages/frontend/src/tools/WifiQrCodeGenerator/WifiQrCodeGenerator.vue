<script setup lang="ts">
/**
 * WifiQrCodeGenerator — generate a QR code that auto-configures WiFi on
 * mobile devices when scanned.
 *
 * Inputs: SSID, password, encryption (WPA/WEP/None), hidden-network toggle,
 * plus QR rendering options (size, error correction, margin, foreground +
 * background colors). Output: a live QR preview (PNG via `<img>`), the raw
 * `WIFI:T:…;S:…;P:…;H:…;;` configuration string, and PNG + SVG downloads.
 *
 * Uses the `qrcode` package (initial bundle, statically imported). No other
 * external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the SSID,
 * password, encryption, hidden, and QR rendering options; sends `output`
 * PostMessages with `{ wifiString, pngDataUrl, svgString, … }` whenever the
 * rendered QR changes.
 */
import { computed, ref } from 'vue';
import {
  Wifi,
  Image as ImageIcon,
  FileCode,
  RotateCcw,
  Palette,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useWifiQrCodeGenerator,
  WIFI_ENCRYPTIONS,
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
  type WifiEncryption,
} from './useWifiQrCodeGenerator';

const {
  ssid,
  password,
  encryption,
  hidden,
  size,
  errorCorrectionLevel,
  margin,
  foreground,
  background,
  wifiString,
  pngDataUrl,
  svgString,
  error,
  computing,
} = useWifiQrCodeGenerator();

const hasSsid = computed(() => ssid.value.trim().length > 0);
const hasOutput = computed(() => pngDataUrl.value.length > 0);
const showPassword = computed({
  get: () => showPasswordValue.value,
  set: (v: boolean) => {
    showPasswordValue.value = v;
  },
});
const showPasswordValue = ref(false);

function onSsid(e: Event): void {
  ssid.value = (e.target as HTMLInputElement).value;
}
function onPassword(e: Event): void {
  password.value = (e.target as HTMLInputElement).value;
}
function onEncryption(e: Event): void {
  encryption.value = (e.target as HTMLSelectElement).value as WifiEncryption;
}
function onHidden(e: Event): void {
  hidden.value = (e.target as HTMLInputElement).checked;
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
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

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
  return new Blob([decodeURIComponent(base64)], { type: mime });
}

function downloadPng(): void {
  if (!pngDataUrl.value) return;
  const safeSsid = (ssid.value.trim() || 'wifi').replace(/[^a-z0-9_-]+/gi, '_');
  download(pngDataUrl.value, `wifi-${safeSsid}.png`, 'image/png');
}
function downloadSvg(): void {
  if (!svgString.value) return;
  const safeSsid = (ssid.value.trim() || 'wifi').replace(/[^a-z0-9_-]+/gi, '_');
  download(svgString.value, `wifi-${safeSsid}.svg`, 'image/svg+xml');
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
  <div class="wifi-qr">
    <ToolInput
      title="WiFi network"
      description="Generate a QR code that auto-configures WiFi when scanned."
    >
      <template #actions>
        <button
          type="button"
          class="wifi-qr__reset-btn"
          title="Reset QR options to defaults"
          @click="resetOptions"
        >
          <RotateCcw :size="14" /> Reset
        </button>
      </template>

      <div class="wifi-qr__form">
        <label class="wifi-qr__field">
          <span class="wifi-qr__label">SSID (network name)</span>
          <input
            type="text"
            class="wifi-qr__input"
            placeholder="MyNetwork"
            :value="ssid"
            spellcheck="false"
            autocomplete="off"
            @input="onSsid"
          />
        </label>

        <label class="wifi-qr__field">
          <span class="wifi-qr__label">Password</span>
          <span class="wifi-qr__password-row">
            <input
              :type="showPassword ? 'text' : 'password'"
              class="wifi-qr__input"
              placeholder="••••••••"
              :value="password"
              spellcheck="false"
              autocomplete="off"
              :disabled="encryption === 'None'"
              @input="onPassword"
            />
            <button
              type="button"
              class="wifi-qr__toggle-btn"
              :title="showPassword ? 'Hide password' : 'Show password'"
              :disabled="encryption === 'None'"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="!showPassword" :size="16" />
              <EyeOff v-else :size="16" />
            </button>
          </span>
        </label>

        <div class="wifi-qr__row">
          <label class="wifi-qr__field">
            <span class="wifi-qr__label">Encryption</span>
            <select
              class="wifi-qr__select"
              :value="encryption"
              @change="onEncryption"
            >
              <option
                v-for="enc in WIFI_ENCRYPTIONS"
                :key="enc.value"
                :value="enc.value"
              >
                {{ enc.label }}
              </option>
            </select>
          </label>

          <label class="wifi-qr__field wifi-qr__checkbox-field">
            <span class="wifi-qr__label">Hidden network</span>
            <label class="wifi-qr__checkbox">
              <input
                type="checkbox"
                :checked="hidden"
                @change="onHidden"
              />
              <span>Hidden SSID</span>
            </label>
          </label>
        </div>
      </div>

      <details class="wifi-qr__advanced">
        <summary class="wifi-qr__summary">QR options</summary>
        <div class="wifi-qr__options">
          <label class="wifi-qr__field">
            <span class="wifi-qr__label">Size</span>
            <span class="wifi-qr__range-row">
              <input
                type="range"
                :min="MIN_SIZE"
                :max="MAX_SIZE"
                step="16"
                :value="size"
                class="wifi-qr__range"
                @input="onSize"
              />
              <span class="wifi-qr__range-value">{{ size }}px</span>
            </span>
          </label>

          <label class="wifi-qr__field">
            <span class="wifi-qr__label">Margin (quiet zone)</span>
            <span class="wifi-qr__range-row">
              <input
                type="range"
                :min="MIN_MARGIN"
                :max="MAX_MARGIN"
                step="1"
                :value="margin"
                class="wifi-qr__range"
                @input="onMargin"
              />
              <span class="wifi-qr__range-value">{{ margin }} modules</span>
            </span>
          </label>

          <label class="wifi-qr__field">
            <span class="wifi-qr__label">Error correction</span>
            <select
              class="wifi-qr__select"
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

          <div class="wifi-qr__colors">
            <label class="wifi-qr__field wifi-qr__color-field">
              <span class="wifi-qr__label"><Palette :size="12" /> Foreground</span>
              <span class="wifi-qr__color-row">
                <input
                  type="color"
                  :value="foreground"
                  class="wifi-qr__color-picker"
                  @input="onForeground"
                />
                <input
                  type="text"
                  :value="foreground"
                  class="wifi-qr__color-text"
                  spellcheck="false"
                  @input="onForeground"
                />
              </span>
            </label>

            <label class="wifi-qr__field wifi-qr__color-field">
              <span class="wifi-qr__label">Background</span>
              <span class="wifi-qr__color-row">
                <input
                  type="color"
                  :value="background"
                  class="wifi-qr__color-picker"
                  @input="onBackground"
                />
                <input
                  type="text"
                  :value="background"
                  class="wifi-qr__color-text"
                  spellcheck="false"
                  @input="onBackground"
                />
              </span>
            </label>
          </div>
        </div>
      </details>
    </ToolInput>

    <ToolOutput
      title="WiFi QR code"
      :description="hasSsid ? `${size}×${size}px · ${errorCorrectionLevel} · ${encryption}` : 'Enter an SSID to generate a WiFi QR code.'"
    >
      <template #actions>
        <button
          type="button"
          class="wifi-qr__download-btn"
          :disabled="!hasOutput"
          title="Download PNG"
          @click="downloadPng"
        >
          <ImageIcon :size="14" /> PNG
        </button>
        <button
          type="button"
          class="wifi-qr__download-btn"
          :disabled="!hasOutput"
          title="Download SVG"
          @click="downloadSvg"
        >
          <FileCode :size="14" /> SVG
        </button>
      </template>

      <div v-if="error" class="wifi-qr__error">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-else-if="computing && !hasOutput" class="wifi-qr__placeholder">
        <Wifi :size="48" class="wifi-qr__placeholder-icon" />
        <span>Generating…</span>
      </div>

      <div v-else-if="!hasSsid" class="wifi-qr__placeholder">
        <Wifi :size="48" class="wifi-qr__placeholder-icon" />
        <span>Enter an SSID to generate a WiFi QR code.</span>
      </div>

      <div v-else-if="hasOutput" class="wifi-qr__preview">
        <img
          :src="pngDataUrl"
          :alt="`WiFi QR code for ${ssid}`"
          class="wifi-qr__img"
          :style="{ maxWidth: `${size}px`, width: '100%' }"
        />
        <div class="wifi-qr__meta">
          <span class="wifi-qr__meta-pill">{{ encryption }}</span>
          <span class="wifi-qr__meta-pill" v-if="hidden">hidden</span>
          <span class="wifi-qr__meta-pill">{{ size }}×{{ size }}</span>
          <span class="wifi-qr__meta-pill">ECL {{ errorCorrectionLevel }}</span>
        </div>
        <div class="wifi-qr__string-row">
          <code class="wifi-qr__string">{{ wifiString }}</code>
          <CopyButton :text="wifiString" />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.wifi-qr {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
}
.wifi-qr__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.wifi-qr__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.wifi-qr__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wifi-qr__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.wifi-qr__input {
  width: 100%;
  padding: 10px 12px;
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 13px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  outline: none;
}
.wifi-qr__input:focus {
  border-color: var(--qt-accent);
}
.wifi-qr__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wifi-qr__password-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}
.wifi-qr__password-row .wifi-qr__input {
  flex: 1;
  min-width: 0;
}
.wifi-qr__toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  flex-shrink: 0;
  color: var(--qt-muted);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.wifi-qr__toggle-btn:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.wifi-qr__toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wifi-qr__select {
  padding: 8px 10px;
  font-size: 13px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  outline: none;
}
.wifi-qr__select:focus {
  border-color: var(--qt-accent);
}
.wifi-qr__checkbox-field {
  justify-content: center;
}
.wifi-qr__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--qt-text);
  cursor: pointer;
  padding: 8px 0;
}
.wifi-qr__checkbox input {
  accent-color: var(--qt-accent);
  width: 16px;
  height: 16px;
}
.wifi-qr__advanced {
  margin-top: 14px;
  border-top: 1px solid var(--qt-border);
  padding-top: 12px;
}
.wifi-qr__summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}
.wifi-qr__summary:hover {
  color: var(--qt-accent);
}
.wifi-qr__options {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 12px;
}
.wifi-qr__range-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wifi-qr__range {
  flex: 1;
  accent-color: var(--qt-accent);
}
.wifi-qr__range-value {
  font-size: 12px;
  color: var(--qt-text);
  min-width: 92px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.wifi-qr__colors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.wifi-qr__color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wifi-qr__color-picker {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}
.wifi-qr__color-text {
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
.wifi-qr__color-text:focus {
  border-color: var(--qt-accent);
}
.wifi-qr__reset-btn,
.wifi-qr__download-btn {
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
.wifi-qr__reset-btn:hover,
.wifi-qr__download-btn:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.wifi-qr__download-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wifi-qr__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: var(--qt-muted);
  text-align: center;
  font-size: 13px;
}
.wifi-qr__placeholder-icon {
  opacity: 0.4;
}
.wifi-qr__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
}
.wifi-qr__img {
  display: block;
  height: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: #ffffff;
  image-rendering: pixelated;
}
.wifi-qr__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}
.wifi-qr__meta-pill {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.wifi-qr__string-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 560px;
}
.wifi-qr__string {
  flex: 1;
  min-width: 0;
  font-family: var(--qt-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  padding: 8px 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wifi-qr__error {
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
