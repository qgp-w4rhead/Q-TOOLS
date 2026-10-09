<script setup lang="ts">
/**
 * ColorConverter - convert between HEX, RGB, HSL, HSV, and CMYK.
 *
 * A single text input is auto-detected (or parsed against a chosen format)
 * into an internal RGB triple, then every supported format is rendered
 * simultaneously with a live preview swatch. A native `<input type="color">`
 * picker lets the user pick a color visually and feeds back into the input
 * as `#rrggbb`.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input
 * and select the parse mode; sends `output` PostMessages whenever the
 * computed formats change.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, RefreshCw, Palette } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useColorConverter,
  type ParseMode,
} from './useColorConverter';

const {
  input,
  mode,
  outputs,
  error,
  recompute,
  setMode,
  setFromHex,
} = useColorConverter();

const { t } = useI18n();
const U = 'tools.color-converter.ui.';

const MODES: { value: ParseMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'hex', label: 'HEX' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
  { value: 'hsv', label: 'HSV' },
  { value: 'cmyk', label: 'CMYK' },
];

/** Localized mode label (only 'auto' is a translatable word; the rest are format names). */
function modeLabel(m: { value: ParseMode; label: string }): string {
  return m.value === 'auto' ? t('common.auto') : m.label;
}

/** The `#rrggbb` value for the native color picker (6-digit hex only). */
const pickerHex = computed(() => {
  if (!outputs.value) return '#000000';
  return outputs.value.hex;
});

/** CSS background for the preview swatch. */
const swatchStyle = computed(() => {
  const bg = outputs.value?.rgb
    ? `rgb(${outputs.value.rgbTriple.r}, ${outputs.value.rgbTriple.g}, ${outputs.value.rgbTriple.b})`
    : 'transparent';
  return { background: bg };
});

/** Output rows (label + value + copy). */
const outputRows = computed<{ label: string; value: string }[]>(() => {
  if (!outputs.value) return [];
  return [
    { label: 'HEX', value: outputs.value.hex },
    { label: 'RGB', value: outputs.value.rgb },
    { label: 'HSL', value: outputs.value.hsl },
    { label: 'HSV', value: outputs.value.hsv },
    { label: 'CMYK', value: outputs.value.cmyk },
  ];
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

function onModeChange(m: ParseMode): void {
  setMode(m);
}

function onPickerChange(e: Event): void {
  const hex = (e.target as HTMLInputElement).value;
  setFromHex(hex);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'title')" :description="t(U + 'desc')">
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t('common.format') }}</span>
        <div class="cc__mode-toggle">
          <button
            v-for="m in MODES"
            :key="m.value"
            type="button"
            class="cc__mode-opt"
            :class="{ 'cc__mode-opt--active': mode === m.value }"
            :aria-pressed="mode === m.value"
            @click="onModeChange(m.value)"
          >
            {{ modeLabel(m) }}
          </button>
        </div>
      </div>

      <div class="qt-row qt-row--end" style="--qt-row-gap:10px">
        <label class="qt-field cc__field--grow">
          <span class="qt-label">{{ t(U + 'colorString') }}</span>
          <input
            class="qt-input qt-input--mono"
            type="text"
            :placeholder="t(U + 'placeholder')"
            :value="input"
            spellcheck="false"
            autocomplete="off"
            @input="onTextInput"
          />
        </label>
        <label class="qt-field cc__field--picker" :title="t(U + 'pickerTitle')">
          <span class="qt-label">{{ t(U + 'picker') }}</span>
          <span class="cc__picker-wrap">
            <input
              class="cc__picker"
              type="color"
              :value="pickerHex"
              :aria-label="t(U + 'pickerAria')"
              @input="onPickerChange"
            />
            <Palette :size="14" class="cc__picker-icon" />
          </span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="outputs ? t(U + 'outputDesc') : t(U + 'empty')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t(U + 'empty') }}
        </p>
        <div v-if="outputs" class="qt-row" style="--qt-row-gap:var(--qt-gap)">
          <div class="cc__swatch" :style="swatchStyle">
            <span class="cc__swatch-hex">{{ outputs.hex }}</span>
          </div>
          <ul class="qt-stack cc__rows" style="--qt-stack-gap:8px">
            <li v-for="row in outputRows" :key="row.label" class="cc__row">
              <span class="cc__row-label">{{ row.label }}</span>
              <code class="qt-mono cc__row-value">{{ row.value }}</code>
              <CopyButton :text="row.value" :label="t(U + 'copyFormat', { format: row.label })" icon-only />
            </li>
          </ul>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Format pill segmented control (solid-accent active). */
.cc__mode-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
  flex-wrap: wrap;
}
.cc__mode-opt {
  padding: 5px 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}
.cc__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Field sizing modifiers (layout via .qt-field). */
.cc__field--grow {
  flex: 1;
}
.cc__field--picker {
  flex-shrink: 0;
}
/* Native color picker — bordered wrap + reset swatch. */
.cc__picker-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  padding: 3px 8px 3px 3px;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.cc__picker-wrap:hover {
  border-color: var(--qt-accent);
}
.cc__picker {
  width: 36px;
  height: 30px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
}
.cc__picker::-webkit-color-swatch-wrapper {
  padding: 0;
}
.cc__picker::-webkit-color-swatch {
  border: 1px solid var(--qt-border);
  border-radius: 4px;
}
.cc__picker::-moz-color-swatch {
  border: 1px solid var(--qt-border);
  border-radius: 4px;
}
.cc__picker-icon {
  color: var(--qt-muted);
  flex-shrink: 0;
}
/* Live color swatch + hex chip. */
.cc__swatch {
  flex: 1 1 220px;
  min-width: 200px;
  min-height: 120px;
  border-radius: var(--qt-radius-sm);
  border: 1px solid var(--qt-border);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 10px;
  position: relative;
  overflow: hidden;
  transition: background 0.15s ease;
}
.cc__swatch-hex {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 999px;
  background: oklch(from var(--qt-surface) 20% c h / 0.85);
  color: var(--qt-text);
  backdrop-filter: blur(4px);
}
/* Format rows — list reset + grow sizing (stack via .qt-stack). */
.cc__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1 1 320px;
  min-width: 240px;
}
.cc__row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 7px 10px;
}
.cc__row-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-muted);
  width: 44px;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}
.cc__row-value {
  flex: 1;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
}
</style>
