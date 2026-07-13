<script setup lang="ts">
/**
 * RomanNumeralConverter — convert between Roman numerals and integers.
 *
 * Bidirectional: Roman → integer and integer → Roman. Range 1-3999 (no
 * vinculum / overbar notation). Validates input and shows clear error
 * messages for non-canonical forms (e.g. IIII instead of IV), illegal
 * subtractive pairs (e.g. IL, IC, IM), out-of-order symbols, and
 * out-of-range integers.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input
 * and select the mode, and sends `output` PostMessages whenever the
 * computed output changes.
 */
import { computed } from 'vue';
import { AlertCircle, ArrowLeftRight, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useRomanNumeralConverter,
  MIN_VALUE,
  MAX_VALUE,
  type RomanMode,
} from './useRomanNumeralConverter';

const {
  input,
  mode,
  outputs,
  error,
  recompute,
  setMode,
  swap,
} = useRomanNumeralConverter();

const placeholder = computed(() =>
  mode.value === 'roman-to-int'
    ? 'e.g. MMMCMXCIX'
    : `e.g. 2024 (${MIN_VALUE}-${MAX_VALUE})`,
);

const inputLabel = computed(() =>
  mode.value === 'roman-to-int' ? 'Roman numeral' : 'Integer',
);

const outputLabel = computed(() =>
  mode.value === 'roman-to-int' ? 'Integer' : 'Roman numeral',
);

const description = computed(() =>
  mode.value === 'roman-to-int'
    ? `Enter a Roman numeral (I, V, X, L, C, D, M). Range: ${MIN_VALUE}-${MAX_VALUE}.`
    : `Enter an integer from ${MIN_VALUE} to ${MAX_VALUE}. Largest value: MMMCMXCIX (${MAX_VALUE}).`,
);

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

function onModeChange(m: RomanMode): void {
  setMode(m);
}
</script>

<template>
  <div class="rn">
    <ToolInput title="Input" :description="description">
      <template #actions>
        <button
          class="rn__btn rn__btn--ghost"
          type="button"
          title="Swap direction and feed the result back as input"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="rn__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="rn__mode-row">
        <span class="rn__label">Direction</span>
        <div class="rn__mode-toggle">
          <button
            type="button"
            class="rn__mode-opt"
            :class="{ 'rn__mode-opt--active': mode === 'roman-to-int' }"
            :aria-pressed="mode === 'roman-to-int'"
            @click="onModeChange('roman-to-int')"
          >
            Roman → Integer
          </button>
          <button
            type="button"
            class="rn__mode-opt"
            :class="{ 'rn__mode-opt--active': mode === 'int-to-roman' }"
            :aria-pressed="mode === 'int-to-roman'"
            @click="onModeChange('int-to-roman')"
          >
            Integer → Roman
          </button>
        </div>
      </div>

      <label class="rn__field">
        <span class="rn__label">{{ inputLabel }}</span>
        <input
          class="rn__input rn__input--mono"
          type="text"
          inputmode="text"
          :placeholder="placeholder"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="outputs ? `Result: ${outputs.output}` : 'Enter a value above to convert.'"
      :copy-text="outputs?.output ?? ''"
      copy-label="Copy result"
    >
      <p v-if="error" class="rn__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="rn__empty">
          Enter a value above to convert.
        </p>
        <div v-if="outputs" class="rn__result">
          <div class="rn__result-head">
            <span class="rn__result-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" label="Copy" icon-only />
          </div>
          <code class="rn__code">{{ outputs.output || '—' }}</code>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.rn {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.rn__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rn__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.rn__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.rn__input--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.rn__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.rn__mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rn__mode-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
}
.rn__mode-opt {
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
.rn__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.rn__btn {
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
.rn__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.rn__btn:active:not(:disabled) {
  transform: translateY(0);
}
.rn__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rn__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.rn__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.rn__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.rn__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.rn__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rn__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rn__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.rn__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
