<script setup lang="ts">
/**
 * JsonToCsv - convert a JSON array of objects to CSV.
 *
 * Parses JSON (an array of objects, or a single object wrapped into a one-row
 * array) and serializes it to CSV per RFC 4180. Nested objects and arrays are
 * flattened to compact JSON strings so each cell is a single scalar value.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the computed CSV changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.json-to-csv.ui.';

const delimiterOptions = computed<Array<{ value: CsvDelimiter; label: string }>>(() => [
  { value: 'comma', label: t(U + 'delimComma') },
  { value: 'semicolon', label: t(U + 'delimSemicolon') },
  { value: 'tab', label: t(U + 'delimTab') },
]);

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    t(o.rowCount === 1 ? U + 'metaRowsOne' : U + 'metaRows', { n: o.rowCount }),
    t(o.columnCount === 1 ? U + 'metaColsOne' : U + 'metaCols', { n: o.columnCount }),
    t(U + 'metaBytes', { n: o.outputBytes }),
  ];
  return parts.join(' · ');
});

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  if (e.line != null && e.column != null) {
    return t(U + 'errLineCol', { line: e.line, col: e.column });
  }
  if (e.line != null) return t(U + 'errLine', { line: e.line });
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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
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
          <span>{{ t(U + 'convert') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'delimiter') }}</span>
          <select
            class="qt-input"
            style="font-size:13px;padding:6px 10px"
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
          class="qt-chip"
          :class="{ 'qt-chip--solid': header }"
          :aria-pressed="header"
          :title="t(U + 'headerTitle')"
          @click="toggleHeader"
        >
          <FileSpreadsheet :size="13" />
          <span>{{ t(U + 'headerRow') }}</span>
        </button>
        <button
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--solid': quoteAll }"
          :aria-pressed="quoteAll"
          :title="t(U + 'quoteTitle')"
          @click="toggleQuoteAll"
        >
          <Quote :size="13" />
          <span>{{ t(U + 'quoteAll') }}</span>
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'jsonLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:180px"
          :placeholder="t(U + 'phJson')"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="outputs ? metaLine : t(U + 'descEmpty')"
      :copy-text="outputs?.csv ?? ''"
      :copy-label="t(U + 'copyCsv')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation" style="margin-right:4px">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t(U + 'descEmpty') }}
        </p>
        <div v-if="outputs" class="qt-panel qt-stack" style="--qt-stack-gap:6px;padding:8px 10px">
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
            <span class="qt-label" style="color:var(--qt-text);flex:1">CSV</span>
            <CopyButton :text="outputs.csv" :label="t('common.copy')" icon-only />
          </div>
          <pre v-if="outputs.csv" class="j2c__code">{{ outputs.csv }}</pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px;font-size:12px;color:var(--qt-muted)">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* CSV output — bare code inside the result panel (no border/padding). */
.j2c__code {
  font-family: var(--qt-font-mono);
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  tab-size: 4;
}
</style>
