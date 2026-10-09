<script setup lang="ts">
/**
 * CaseConverter - convert text between nine casing conventions.
 *
 * A textarea input is converted live (debounced) into the selected case.
 * UPPER and lower preserve all separators; sentence case and Title Case
 * preserve newlines; the five identifier conventions (camel, Pascal, snake,
 * kebab, constant) process each line independently so multi-line input
 * stays multi-line.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text
 * and select the case mode; sends `output` PostMessages whenever the
 * converted text changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useCaseConverter,
  CASE_MODES,
  type CaseMode,
} from './useCaseConverter';

const {
  input,
  mode,
  output,
  recompute,
  setMode,
} = useCaseConverter();

const { t } = useI18n();
const U = 'tools.case-converter.ui.';

/** Character + word + line counts for the input. */
const inputStats = computed(() => {
  const text = input.value;
  const chars = text.length;
  const lines = text.length === 0 ? 0 : text.split('\n').length;
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  return { chars, lines, words };
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onModeChange(m: CaseMode): void {
  setMode(m);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.text')"
      :description="t(U + 'desc')"
    >
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
        <span class="qt-label">{{ t(U + 'case') }}</span>
        <div class="ccase__mode-toggle">
          <button
            v-for="m in CASE_MODES"
            :key="m.value"
            type="button"
            class="ccase__mode-opt"
            :class="{ 'ccase__mode-opt--active': mode === m.value }"
            :aria-pressed="mode === m.value"
            :title="t(U + 'exampleTitle', { example: m.example })"
            @click="onModeChange(m.value)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <textarea
        class="qt-input qt-input--mono ccase__textarea"
        :placeholder="t('common.typeOrPaste')"
        :value="input"
        spellcheck="false"
        autocomplete="off"
        rows="6"
        @input="onTextInput"
      />

      <p class="qt-row qt-row--center qt-hint" style="--qt-row-gap:14px">
        <span>{{ t('common.chars', { n: inputStats.chars }) }}</span>
        <span>{{ t('common.words', inputStats.words) }}</span>
        <span>{{ t('common.lines', inputStats.lines) }}</span>
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="output ? t(U + 'outputDesc', { mode }) : t(U + 'empty')"
    >
      <template v-if="output" #actions>
        <CopyButton :text="output" :label="t('common.copyResult')" />
      </template>
      <p v-if="!output" class="qt-alert qt-alert--empty">
        {{ t(U + 'emptyResult') }}
      </p>
      <pre v-else class="qt-result qt-mono ccase__output">{{ output }}</pre>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Case-mode pill segmented control (solid-accent active). */
.ccase__mode-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
  flex-wrap: wrap;
  gap: 2px;
}
.ccase__mode-opt {
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
.ccase__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.ccase__textarea {
  min-height: 120px;
}
/* Output block (card via .qt-result, font via .qt-mono) — pre-wrapped. */
.ccase__output {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 80px;
}
</style>
