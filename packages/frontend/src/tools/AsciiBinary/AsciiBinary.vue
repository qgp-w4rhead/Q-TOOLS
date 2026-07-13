<script setup lang="ts">
/**
 * AsciiBinary — convert text to ASCII/UTF-8 binary and back.
 *
 * Bidirectional: text → binary (encode) and binary → text (decode). UTF-8
 * safe via TextEncoder/TextDecoder, so any Unicode input (emoji, CJK,
 * combining marks) round-trips correctly. Each byte is rendered as 8
 * zero-padded bits; bytes are joined with a configurable separator
 * (default a single space, or a contiguous stream when "none").
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the
 * input, select the mode, and set the separator; sends `output`
 * PostMessages whenever the computed output changes.
 */
import { computed } from 'vue';
import { AlertCircle, ArrowLeftRight, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useAsciiBinary,
  type BinaryMode,
} from './useAsciiBinary';

const {
  input,
  mode,
  separator,
  outputs,
  error,
  recompute,
  setMode,
  setSeparator,
  swap,
} = useAsciiBinary();

const placeholder = computed(() =>
  mode.value === 'encode'
    ? 'Enter text to convert to binary…'
    : 'Enter binary (8-bit groups of 0/1, whitespace-separated or contiguous)…',
);

const inputLabel = computed(() => (mode.value === 'encode' ? 'Text' : 'Binary'));
const outputLabel = computed(() => (mode.value === 'encode' ? 'Binary' : 'Text'));

const description = computed(() =>
  mode.value === 'encode'
    ? separator.value.length === 0
      ? 'Encode UTF-8 text to a contiguous stream of 8-bit binary groups.'
      : 'Encode UTF-8 text to 8-bit binary groups separated by the chosen delimiter.'
    : 'Decode 8-bit binary groups (whitespace-separated or a contiguous multiple-of-8 stream) back to UTF-8 text.',
);

/** Whether the custom separator input is currently shown. */
const isCustomSeparator = computed(
  () => separator.value !== ' ' && separator.value !== '',
);

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onModeChange(m: BinaryMode): void {
  setMode(m);
}

function onPresetSeparator(preset: 'space' | 'none'): void {
  setSeparator(preset === 'space' ? ' ' : '');
}

function onCustomSeparator(e: Event): void {
  const v = (e.target as HTMLInputElement).value;
  setSeparator(v);
}
</script>

<template>
  <div class="bin">
    <ToolInput title="Input" :description="description">
      <template #actions>
        <button
          class="bin__btn bin__btn--ghost"
          type="button"
          title="Swap direction and feed the result back as input"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="bin__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="bin__mode-row">
        <span class="bin__label">Direction</span>
        <div class="bin__mode-toggle">
          <button
            type="button"
            class="bin__mode-opt"
            :class="{ 'bin__mode-opt--active': mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            @click="onModeChange('encode')"
          >
            Encode
          </button>
          <button
            type="button"
            class="bin__mode-opt"
            :class="{ 'bin__mode-opt--active': mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            @click="onModeChange('decode')"
          >
            Decode
          </button>
        </div>
      </div>

      <div v-if="mode === 'encode'" class="bin__sep-row">
        <span class="bin__label">Separator</span>
        <div class="bin__sep-toggle">
          <button
            type="button"
            class="bin__sep-opt"
            :class="{ 'bin__sep-opt--active': separator === ' ' }"
            :aria-pressed="separator === ' '"
            @click="onPresetSeparator('space')"
          >
            Space
          </button>
          <button
            type="button"
            class="bin__sep-opt"
            :class="{ 'bin__sep-opt--active': separator === '' }"
            :aria-pressed="separator === ''"
            @click="onPresetSeparator('none')"
          >
            None
          </button>
          <button
            type="button"
            class="bin__sep-opt"
            :class="{ 'bin__sep-opt--active': isCustomSeparator }"
            :aria-pressed="isCustomSeparator"
            title="Use a custom separator string"
            @click="setSeparator(isCustomSeparator ? ' ' : ', ')"
          >
            Custom
          </button>
        </div>
        <input
          v-if="isCustomSeparator"
          class="bin__sep-input"
          type="text"
          :value="separator"
          placeholder="e.g. , or - or \\n"
          spellcheck="false"
          autocomplete="off"
          @input="onCustomSeparator"
        />
      </div>

      <label class="bin__field">
        <span class="bin__label">{{ inputLabel }}</span>
        <textarea
          class="bin__textarea bin__textarea--mono"
          :placeholder="placeholder"
          :value="input"
          rows="6"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="outputs ? `${outputs.byteCount} bytes · ${outputs.outputBytes} chars out` : 'Enter a value above to convert.'"
      :copy-text="outputs?.output ?? ''"
      copy-label="Copy result"
    >
      <p v-if="error" class="bin__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="bin__empty">
          Enter a value above to convert.
        </p>
        <div v-if="outputs" class="bin__result">
          <div class="bin__result-head">
            <span class="bin__result-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" label="Copy" icon-only />
          </div>
          <code class="bin__code">{{ outputs.output || '—' }}</code>
          <div class="bin__meta">
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="bin__dot">·</span>
            <span>{{ outputs.byteCount }} byte groups</span>
            <span class="bin__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.bin {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.bin__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bin__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.bin__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.bin__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.bin__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.bin__mode-row,
.bin__sep-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.bin__mode-toggle,
.bin__sep-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
}
.bin__mode-opt,
.bin__sep-opt {
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
.bin__mode-opt--active,
.bin__sep-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.bin__sep-input {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 5px 9px;
  width: 140px;
  transition: border-color 0.15s ease;
  will-change: border-color;
}
.bin__sep-input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.bin__btn {
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
.bin__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.bin__btn:active:not(:disabled) {
  transform: translateY(0);
}
.bin__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bin__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.bin__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.bin__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.bin__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.bin__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bin__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bin__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.bin__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.bin__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.bin__dot {
  opacity: 0.6;
}
</style>
