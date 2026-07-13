<script setup lang="ts">
/**
 * ColorConverter — convert between HEX, RGB, HSL, HSV, and CMYK.
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

const MODES: { value: ParseMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'hex', label: 'HEX' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
  { value: 'hsv', label: 'HSV' },
  { value: 'cmyk', label: 'CMYK' },
];

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
  <div class="cc">
    <ToolInput title="Color" description="Enter a color in any format (HEX, RGB, HSL, HSV, CMYK) — auto-detected.">
      <template #actions>
        <button
          class="cc__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="cc__mode-row">
        <span class="cc__label">Format</span>
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
            {{ m.label }}
          </button>
        </div>
      </div>

      <div class="cc__input-row">
        <label class="cc__field cc__field--grow">
          <span class="cc__label">Color string</span>
          <input
            class="cc__text"
            type="text"
            placeholder="#58a6ff · rgb(88,166,255) · hsl(212, 100%, 67%) …"
            :value="input"
            spellcheck="false"
            autocomplete="off"
            @input="onTextInput"
          />
        </label>
        <label class="cc__field cc__field--picker" title="Pick a color visually">
          <span class="cc__label">Picker</span>
          <span class="cc__picker-wrap">
            <input
              class="cc__picker"
              type="color"
              :value="pickerHex"
              aria-label="Color picker"
              @input="onPickerChange"
            />
            <Palette :size="14" class="cc__picker-icon" />
          </span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Converted formats"
      :description="outputs ? 'All color spaces for the input above.' : 'Enter a color above to convert.'"
    >
      <p v-if="error" class="cc__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="cc__empty">
          Enter a color above to convert.
        </p>
        <div v-if="outputs" class="cc__body">
          <div class="cc__swatch" :style="swatchStyle">
            <span class="cc__swatch-hex">{{ outputs.hex }}</span>
          </div>
          <ul class="cc__rows">
            <li v-for="row in outputRows" :key="row.label" class="cc__row">
              <span class="cc__row-label">{{ row.label }}</span>
              <code class="cc__row-value">{{ row.value }}</code>
              <CopyButton :text="row.value" :label="`Copy ${row.label}`" icon-only />
            </li>
          </ul>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.cc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.cc__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cc__field--grow {
  flex: 1;
}
.cc__field--picker {
  flex-shrink: 0;
}
.cc__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.cc__mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
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
  will-change: color, background;
}
.cc__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.cc__input-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.cc__text {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 9px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.cc__text:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
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
  will-change: border-color;
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
.cc__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.cc__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.cc__btn:active:not(:disabled) {
  transform: translateY(0);
}
.cc__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cc__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.cc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.cc__body {
  display: flex;
  gap: var(--qt-gap);
  flex-wrap: wrap;
  align-items: stretch;
}
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
  will-change: background;
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
.cc__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1 1 320px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
}
</style>
