<script setup lang="ts">
/**
 * WifiQrCodeGenerator - generate a QR code that auto-configures WiFi on
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.wifi-qr-code-generator.ui.';

const ECL_LABEL_KEYS: Record<ErrorCorrectionLevel, string> = {
  L: 'eclL',
  M: 'eclM',
  Q: 'eclQ',
  H: 'eclH',
};
const ENC_LABEL_KEYS: Record<WifiEncryption, string> = {
  WPA: 'encWpa',
  WEP: 'encWep',
  None: 'encNone',
};
function eclOptionLabel(lvl: (typeof ERROR_CORRECTION_LEVELS)[number]): string {
  return t(U + 'eclOption', {
    label: t(U + ECL_LABEL_KEYS[lvl.value]),
    value: lvl.value,
    recovery: lvl.recovery,
  });
}
function encLabel(enc: WifiEncryption): string {
  return t(U + ENC_LABEL_KEYS[enc]);
}

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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
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

      <div class="qt-stack" style="--qt-stack-gap:14px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'ssid') }}</span>
          <input
            type="text"
            class="qt-input qt-input--mono"
            :placeholder="t(U + 'ssidPlaceholder')"
            :value="ssid"
            spellcheck="false"
            autocomplete="off"
            @input="onSsid"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t('common.password') }}</span>
          <span class="qt-row qt-row--nowrap" style="--qt-row-gap:8px">
            <input
              :type="showPassword ? 'text' : 'password'"
              class="qt-input qt-input--mono"
              style="flex:1;min-width:0"
              placeholder="••••••••"
              :value="password"
              spellcheck="false"
              autocomplete="off"
              :disabled="encryption === 'None'"
              @input="onPassword"
            />
            <button
              type="button"
              class="qt-btn qt-btn--ghost qt-btn--icon"
              :title="showPassword ? t(U + 'hidePassword') : t(U + 'showPassword')"
              :disabled="encryption === 'None'"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="!showPassword" :size="16" />
              <EyeOff v-else :size="16" />
            </button>
          </span>
        </label>

        <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:12px">
          <label class="qt-field">
            <span class="qt-label">{{ t(U + 'encryption') }}</span>
            <select
              class="qt-input"
              :value="encryption"
              @change="onEncryption"
            >
              <option
                v-for="enc in WIFI_ENCRYPTIONS"
                :key="enc.value"
                :value="enc.value"
              >
                {{ encLabel(enc.value) }}
              </option>
            </select>
          </label>

          <label class="qt-field" style="justify-content:center">
            <span class="qt-label">{{ t(U + 'hiddenNetwork') }}</span>
            <label class="qt-check wifi-qr__checkbox">
              <input
                type="checkbox"
                :checked="hidden"
                @change="onHidden"
              />
              <span>{{ t(U + 'hiddenSsid') }}</span>
            </label>
          </label>
        </div>
      </div>

      <details class="wifi-qr__advanced">
        <summary class="wifi-qr__summary">{{ t(U + 'qrOptions') }}</summary>
        <div class="qt-stack" style="--qt-stack-gap:14px;margin-top:12px">
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
              <span class="wifi-qr__range-value">{{ size }}px</span>
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
              <span class="wifi-qr__range-value">{{ margin }} {{ t(U + 'modules') }}</span>
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
                  class="wifi-qr__color-picker"
                  @input="onForeground"
                />
                <input
                  type="text"
                  :value="foreground"
                  class="qt-input qt-input--mono wifi-qr__color-text"
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
                  class="wifi-qr__color-picker"
                  @input="onBackground"
                />
                <input
                  type="text"
                  :value="background"
                  class="qt-input qt-input--mono wifi-qr__color-text"
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
      :title="t(U + 'outputTitle')"
      :description="hasSsid ? t(U + 'descResult', { size, ecl: errorCorrectionLevel, enc: encLabel(encryption) }) : t(U + 'descEmpty')"
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

      <div v-else-if="computing && !hasOutput" class="wifi-qr__placeholder">
        <Wifi :size="48" class="wifi-qr__placeholder-icon" />
        <span>{{ t('common.generating') }}</span>
      </div>

      <div v-else-if="!hasSsid" class="wifi-qr__placeholder">
        <Wifi :size="48" class="wifi-qr__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>

      <div v-else-if="hasOutput" class="qt-stack" style="--qt-stack-gap:16px;align-items:center;padding:16px">
        <img
          :src="pngDataUrl"
          :alt="t(U + 'imgAlt', { ssid })"
          class="wifi-qr__img"
          :style="{ maxWidth: `${size}px`, width: '100%' }"
        />
        <div class="qt-row" style="--qt-row-gap:6px;justify-content:center">
          <span class="qt-badge">{{ encLabel(encryption) }}</span>
          <span class="qt-badge" v-if="hidden">{{ t(U + 'badgeHidden') }}</span>
          <span class="qt-badge">{{ size }}×{{ size }}</span>
          <span class="qt-badge">{{ t(U + 'badgeEcl', { ecl: errorCorrectionLevel }) }}</span>
        </div>
        <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px;width:100%;max-width:560px">
          <code class="qt-mono wifi-qr__string">{{ wifiString }}</code>
          <CopyButton :text="wifiString" />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Hidden-network checkbox (base via .qt-check) — padded, larger box. */
.wifi-qr__checkbox {
  padding: 8px 0;
}
.wifi-qr__checkbox input {
  width: 16px;
  height: 16px;
}
/* Collapsible advanced section — top rule + summary toggle. */
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
/* Range readout — fixed-width tabular value. */
.wifi-qr__range-value {
  font-size: 12px;
  color: var(--qt-text);
  min-width: 92px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* Native colour-picker swatch — fixed 36px square. */
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
/* Hex text input (control + mono via .qt-input--mono) — grows, lowercase. */
.wifi-qr__color-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  text-transform: lowercase;
}
/* Centered empty/generating state — big icon + prompt. */
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
/* QR preview image — white card, pixel-perfect rendering. */
.wifi-qr__img {
  display: block;
  height: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: #ffffff;
  image-rendering: pixelated;
}
/* WIFI: connection string (font via .qt-mono) — bordered, single-line ellipsis. */
.wifi-qr__string {
  flex: 1;
  min-width: 0;
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
</style>
