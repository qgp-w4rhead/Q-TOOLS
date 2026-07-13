<script setup lang="ts">
/**
 * ListConverter — convert lists between formats.
 *
 * Parses an input list in one of seven built-in formats (comma, newline,
 * JSON array, bullet list, numbered list, tab, pipe) or a custom delimiter,
 * and re-emits it in any of the same formats. Optional per-item trim and
 * duplicate removal (first-seen order preserved).
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text
 * and set the from/to formats and options; sends `output` PostMessages
 * whenever the converted list changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, ArrowLeftRight, Scissors, Copy } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useListConverter,
  LIST_FORMATS,
  LIST_FORMAT_LABELS,
  type ListFormat,
} from './useListConverter';

const {
  input,
  fromFormat,
  toFormat,
  trim,
  removeDuplicates,
  customDelimiter,
  outputs,
  error,
  recompute,
  swapFormats,
  setFromFormat,
  setToFormat,
  toggleTrim,
  toggleRemoveDuplicates,
} = useListConverter();

const description = computed(() => {
  const from = LIST_FORMAT_LABELS[fromFormat.value];
  const to = LIST_FORMAT_LABELS[toFormat.value];
  return `Convert a ${from} list into a ${to} list.`;
});

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  const stageLabel = e.stage === 'parse' ? 'Parse' : 'Format';
  if (e.line != null && e.column != null) {
    return `${stageLabel} · Line ${e.line}, column ${e.column}`;
  }
  if (e.line != null) return `${stageLabel} · Line ${e.line}`;
  return stageLabel;
});

const outputDescription = computed(() => {
  if (error.value) return 'Conversion failed.';
  if (!outputs.value) return 'Enter a list above to convert.';
  const o = outputs.value;
  const parts: string[] = [`${o.count} item${o.count === 1 ? '' : 's'}`];
  if (o.duplicatesRemoved > 0) {
    parts.push(`${o.duplicatesRemoved} duplicate${o.duplicatesRemoved === 1 ? '' : 's'} removed`);
  }
  parts.push(`${o.outputBytes} bytes`);
  return parts.join(' · ');
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onFromChange(e: Event): void {
  setFromFormat((e.target as HTMLSelectElement).value as ListFormat);
}

function onToChange(e: Event): void {
  setToFormat((e.target as HTMLSelectElement).value as ListFormat);
}

function onCustomDelimiter(e: Event): void {
  customDelimiter.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="lc">
    <ToolInput title="Input list" :description="description">
      <template #actions>
        <button
          class="lc__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="lc__row">
        <label class="lc__field">
          <span class="lc__label">From</span>
          <select
            class="lc__select"
            :value="fromFormat"
            @change="onFromChange"
          >
            <option v-for="f in LIST_FORMATS" :key="f" :value="f">
              {{ LIST_FORMAT_LABELS[f] }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="lc__swap"
          title="Swap from/to formats (and feed output back into input)"
          @click="swapFormats"
        >
          <ArrowLeftRight :size="14" />
        </button>

        <label class="lc__field">
          <span class="lc__label">To</span>
          <select
            class="lc__select"
            :value="toFormat"
            @change="onToChange"
          >
            <option v-for="f in LIST_FORMATS" :key="f" :value="f">
              {{ LIST_FORMAT_LABELS[f] }}
            </option>
          </select>
        </label>
      </div>

      <label v-if="fromFormat === 'custom' || toFormat === 'custom'" class="lc__field lc__custom">
        <span class="lc__label">Custom delimiter</span>
        <input
          type="text"
          class="lc__input"
          :value="customDelimiter"
          placeholder="e.g. ; or  |  or  ::"
          spellcheck="false"
          autocomplete="off"
          @input="onCustomDelimiter"
        />
      </label>

      <div class="lc__opts">
        <button
          type="button"
          class="lc__toggle"
          :class="{ 'lc__toggle--active': trim }"
          :aria-pressed="trim"
          title="Trim whitespace from each item"
          @click="toggleTrim"
        >
          <Scissors :size="13" />
          <span>Trim items</span>
        </button>
        <button
          type="button"
          class="lc__toggle"
          :class="{ 'lc__toggle--active': removeDuplicates }"
          :aria-pressed="removeDuplicates"
          title="Remove duplicate items (first-seen order preserved)"
          @click="toggleRemoveDuplicates"
        >
          <Copy :size="13" />
          <span>Remove duplicates</span>
        </button>
      </div>

      <textarea
        class="lc__textarea lc__textarea--mono"
        placeholder="Paste a list here… (e.g. apple, banana, cherry)"
        :value="input"
        rows="8"
        spellcheck="false"
        autocomplete="off"
        @input="onTextInput"
      />
    </ToolInput>

    <ToolOutput
      title="Output list"
      :description="outputDescription"
      :copy-text="outputs?.output ?? ''"
      copy-label="Copy output"
    >
      <p v-if="error" class="lc__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="lc__empty">
          Enter a list above to convert.
        </p>
        <div v-if="outputs" class="lc__result">
          <div class="lc__result-head">
            <span class="lc__result-label">{{ LIST_FORMAT_LABELS[toFormat] }}</span>
            <CopyButton :text="outputs.output" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.output" class="lc__code">{{ outputs.output }}</pre>
          <p v-else class="lc__empty">List parsed to an empty result.</p>
          <div class="lc__meta">
            <span>{{ outputs.count }} item{{ outputs.count === 1 ? '' : 's' }}</span>
            <template v-if="outputs.duplicatesRemoved > 0">
              <span class="lc__dot">·</span>
              <span>{{ outputs.duplicatesRemoved }} duplicate{{ outputs.duplicatesRemoved === 1 ? '' : 's' }} removed</span>
            </template>
            <span class="lc__dot">·</span>
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="lc__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.lc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.lc__row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.lc__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 140px;
}
.lc__custom {
  flex: 0 0 240px;
}
.lc__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.lc__select,
.lc__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.lc__select:focus,
.lc__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.lc__swap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
  will-change: transform;
}
.lc__swap:hover {
  color: var(--qt-accent);
  border-color: var(--qt-accent);
  transform: rotate(180deg);
}
.lc__opts {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lc__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 11px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: color, border-color;
}
.lc__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.lc__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 160px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.lc__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.lc__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.lc__btn {
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
.lc__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.lc__btn:active:not(:disabled) {
  transform: translateY(0);
}
.lc__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.lc__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.lc__error strong {
  margin-right: 4px;
}
.lc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.lc__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lc__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lc__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.lc__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.lc__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.lc__dot {
  opacity: 0.6;
}
</style>
