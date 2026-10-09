<script setup lang="ts">
/**
 * RomanNumeralConverter - convert between Roman numerals and integers.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.roman-numeral-converter.ui.';

const placeholder = computed(() =>
  mode.value === 'roman-to-int'
    ? t(U + 'placeholderRoman')
    : t(U + 'placeholderInt', { min: MIN_VALUE, max: MAX_VALUE }),
);

const inputLabel = computed(() =>
  mode.value === 'roman-to-int' ? t(U + 'roman') : t(U + 'integer'),
);

const outputLabel = computed(() =>
  mode.value === 'roman-to-int' ? t(U + 'integer') : t(U + 'roman'),
);

const description = computed(() =>
  mode.value === 'roman-to-int'
    ? t(U + 'descRoman', { min: MIN_VALUE, max: MAX_VALUE })
    : t(U + 'descInt', { min: MIN_VALUE, max: MAX_VALUE }),
);

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

function onModeChange(m: RomanMode): void {
  setMode(m);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="description">
      <template #actions>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :title="t('common.swapTitle')"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </button>
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
        <span class="qt-label">{{ t('common.direction') }}</span>
        <div class="rn__mode-toggle">
          <button
            type="button"
            class="rn__mode-opt"
            :class="{ 'rn__mode-opt--active': mode === 'roman-to-int' }"
            :aria-pressed="mode === 'roman-to-int'"
            @click="onModeChange('roman-to-int')"
          >
            {{ t(U + 'romanToInt') }}
          </button>
          <button
            type="button"
            class="rn__mode-opt"
            :class="{ 'rn__mode-opt--active': mode === 'int-to-roman' }"
            :aria-pressed="mode === 'int-to-roman'"
            @click="onModeChange('int-to-roman')"
          >
            {{ t(U + 'intToRoman') }}
          </button>
        </div>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ inputLabel }}</span>
        <input
          class="qt-input qt-input--mono"
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
      :description="outputs ? t(U + 'outputDesc', { output: outputs.output }) : t('common.enterToConvert')"
      :copy-text="outputs?.output ?? ''"
      :copy-label="t('common.copyResult')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t('common.enterToConvert') }}
        </p>
        <div v-if="outputs" class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="qt-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono rn__code">{{ outputs.output || '-' }}</code>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Direction pill segmented control (solid-accent active). */
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
}
.rn__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Output code (font via .qt-mono) — break-anywhere, pre-wrapped. */
.rn__code {
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
