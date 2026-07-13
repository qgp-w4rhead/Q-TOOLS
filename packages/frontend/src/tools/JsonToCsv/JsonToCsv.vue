<script setup lang="ts">
/**
 * JsonToCsv — convert a JSON array of objects to CSV.
 *
 * Parses JSON (an array of objects, or a single object wrapped into a one-row
 * array) and serializes it to CSV per RFC 4180. Nested objects and arrays are
 * flattened to compact JSON strings so each cell is a single scalar value.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the computed CSV changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, FileSpreadsheet, Quote } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useJsonToCsv, type CsvDelimiter } from './useJsonToCsv';

const {
  input,
  header,
  delimiter,
  quoteAll,
  outputs,
  error,
  recompute,
  toggleHeader,
  setDelimiter,
  toggleQuoteAll,
} = useJsonToCsv();

const delimiterOptions: Array<{ value: CsvDelimiter; label: string }> = [
  { value: 'comma', label: 'Comma (,)' },
  { value: 'semicolon', label: 'Semicolon (;)' },
  { value: 'tab', label: 'Tab' },
];

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    `${o.rowCount} row${o.rowCount === 1 ? '' : 's'}`,
    `${o.columnCount} column${o.columnCount === 1 ? '' : 's'}`,
    `${o.outputBytes} bytes`,
  ];
  return parts.join(' · ');
});

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  if (e.line != null && e.column != null) {
    return `Line ${e.line}, column ${e.column}`;
  }
  if (e.line != null) return `Line ${e.line}`;
  return '';
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onDelimiterChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value as CsvDelimiter;
  setDelimiter(v);
}
</script>

<template>
  <div class="j2c">
    <ToolInput
      title="JSON input"
      description="Paste a JSON array of objects (or a single object). Nested values are flattened to JSON strings."
    >
      <template #actions>
        <button
          class="j2c__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="j2c__opts">
        <label class="j2c__opt">
          <span class="j2c__label">Delimiter</span>
          <select
            class="j2c__select"
            :value="delimiter"
            @change="onDelimiterChange"
          >
            <option v-for="o in delimiterOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="j2c__toggle"
          :class="{ 'j2c__toggle--active': header }"
          :aria-pressed="header"
          title="Include a header row of column names"
          @click="toggleHeader"
        >
          <FileSpreadsheet :size="13" />
          <span>Header row</span>
        </button>
        <button
          type="button"
          class="j2c__toggle"
          :class="{ 'j2c__toggle--active': quoteAll }"
          :aria-pressed="quoteAll"
          title="Wrap every field in double quotes (not just those that need it)"
          @click="toggleQuoteAll"
        >
          <Quote :size="13" />
          <span>Quote all fields</span>
        </button>
      </div>

      <label class="j2c__field">
        <span class="j2c__label">JSON</span>
        <textarea
          class="j2c__textarea j2c__textarea--mono"
          placeholder='Paste JSON here…  e.g.  [\n  {"name": "Ada", "age": 36, "active": true},\n  {"name": "Linus", "age": 54}\n]'
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="CSV output"
      :description="outputs ? metaLine : 'Paste JSON above to convert.'"
      :copy-text="outputs?.csv ?? ''"
      copy-label="Copy CSV"
    >
      <p v-if="error" class="j2c__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="j2c__empty">
          Paste JSON above to convert.
        </p>
        <div v-if="outputs" class="j2c__result">
          <div class="j2c__result-head">
            <span class="j2c__result-label">CSV</span>
            <CopyButton :text="outputs.csv" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.csv" class="j2c__code">{{ outputs.csv }}</pre>
          <p v-else class="j2c__empty">JSON parsed to an empty result.</p>
          <div class="j2c__meta">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.j2c {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.j2c__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.j2c__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2c__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2c__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.j2c__select {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  padding: 6px 10px;
  cursor: pointer;
  transition: border-color 0.15s ease;
  will-change: border-color;
}
.j2c__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.j2c__toggle {
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
.j2c__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.j2c__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 180px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.j2c__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.j2c__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.j2c__btn {
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
.j2c__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.j2c__btn:active:not(:disabled) {
  transform: translateY(0);
}
.j2c__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.j2c__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.j2c__error strong {
  margin-right: 4px;
}
.j2c__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.j2c__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2c__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.j2c__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.j2c__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  tab-size: 4;
}
.j2c__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
</style>
