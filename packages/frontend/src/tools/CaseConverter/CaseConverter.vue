<script setup lang="ts">
/**
 * CaseConverter — convert text between nine casing conventions.
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
  <div class="ccase">
    <ToolInput
      title="Text"
      description="Enter the text to convert. Conversion is live."
    >
      <template #actions>
        <button
          class="ccase__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="ccase__mode-row">
        <span class="ccase__label">Case</span>
        <div class="ccase__mode-toggle">
          <button
            v-for="m in CASE_MODES"
            :key="m.value"
            type="button"
            class="ccase__mode-opt"
            :class="{ 'ccase__mode-opt--active': mode === m.value }"
            :aria-pressed="mode === m.value"
            :title="`Example: ${m.example}`"
            @click="onModeChange(m.value)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <textarea
        class="ccase__textarea"
        placeholder="Type or paste text here…"
        :value="input"
        spellcheck="false"
        autocomplete="off"
        rows="6"
        @input="onTextInput"
      />

      <p class="ccase__stats">
        <span>{{ inputStats.chars }} chars</span>
        <span>{{ inputStats.words }} words</span>
        <span>{{ inputStats.lines }} lines</span>
      </p>
    </ToolInput>

    <ToolOutput
      title="Converted text"
      :description="output ? `Converted to ${mode} case.` : 'Enter text above to convert.'"
    >
      <template v-if="output" #actions>
        <CopyButton :text="output" label="Copy result" />
      </template>
      <p v-if="!output" class="ccase__empty">
        Enter text above to see the converted result.
      </p>
      <pre v-else class="ccase__output">{{ output }}</pre>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ccase {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ccase__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ccase__mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
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
  will-change: color, background;
}
.ccase__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.ccase__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 10px 12px;
  resize: vertical;
  min-height: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.ccase__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ccase__stats {
  display: flex;
  gap: 14px;
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
}
.ccase__btn {
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
.ccase__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.ccase__btn:active:not(:disabled) {
  transform: translateY(0);
}
.ccase__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ccase__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.ccase__output {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  min-height: 80px;
}
</style>
