<script setup lang="ts">
/**
 * SqlPrettify — pretty-print and format SQL queries.
 *
 * Uses the lazy-loaded `sql-formatter` package to format the input SQL with
 * a configurable dialect (standard SQL, MySQL, PostgreSQL, T-SQL), indent
 * (2 spaces, 4 spaces, or a tab), keyword case (preserve / upper / lower),
 * blank lines between queries, and an optional newline before the final
 * semicolon. The formatted output is rendered in a monospace `<pre>` block.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the SQL and
 * set options, and sends `output` PostMessages whenever the formatted result
 * changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, Database, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useSqlPrettify,
  type SqlLanguage,
  type SqlIndent,
  type SqlKeywordCase,
  type SqlLinesBetweenQueries,
} from './useSqlPrettify';

const {
  input,
  language,
  indent,
  keywordCase,
  linesBetweenQueries,
  newlineBeforeSemicolon,
  outputs,
  error,
  loading,
  recompute,
  setLanguage,
  setIndent,
  setKeywordCase,
  setLinesBetweenQueries,
  toggleNewlineBeforeSemicolon,
} = useSqlPrettify();

const languageOptions: Array<{ value: SqlLanguage; label: string }> = [
  { value: 'sql', label: 'Standard SQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'tsql', label: 'T-SQL' },
];

const indentOptions: Array<{ value: SqlIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
  { value: 'tab', label: 'Tab' },
];

const keywordCaseOptions: Array<{ value: SqlKeywordCase; label: string }> = [
  { value: 'preserve', label: 'Preserve' },
  { value: 'upper', label: 'UPPER' },
  { value: 'lower', label: 'lower' },
];

const linesBetweenOptions: Array<{ value: SqlLinesBetweenQueries; label: string }> = [
  { value: 1, label: '1 line' },
  { value: 2, label: '2 lines' },
  { value: 3, label: '3 lines' },
];

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [`${o.outputBytes} bytes`];
  if (o.inputBytes !== o.outputBytes) {
    const delta = o.outputBytes - o.inputBytes;
    parts.push(`${delta > 0 ? '+' : ''}${delta} B`);
  }
  return parts.join(' · ');
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onLanguageChange(e: Event): void {
  setLanguage((e.target as HTMLSelectElement).value as SqlLanguage);
}

function onIndentChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  setIndent(v === 'tab' ? 'tab' : (Number(v) as SqlIndent));
}

function onKeywordCaseChange(e: Event): void {
  setKeywordCase((e.target as HTMLSelectElement).value as SqlKeywordCase);
}

function onLinesBetweenChange(e: Event): void {
  setLinesBetweenQueries(Number((e.target as HTMLSelectElement).value) as SqlLinesBetweenQueries);
}
</script>

<template>
  <div class="sp">
    <ToolInput
      title="SQL input"
      description="Paste a minified or messy SQL query. It is reformatted with the chosen dialect and indent."
    >
      <template #actions>
        <button
          class="sp__btn"
          type="button"
          :disabled="input.trim().length === 0 || loading"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Format</span>
        </button>
      </template>

      <div class="sp__opts">
        <label class="sp__opt">
          <span class="sp__label">Dialect</span>
          <select class="sp__select" :value="language" @change="onLanguageChange">
            <option v-for="o in languageOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <label class="sp__opt">
          <span class="sp__label">Indent</span>
          <select class="sp__select" :value="indent" @change="onIndentChange">
            <option v-for="o in indentOptions" :key="String(o.value)" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <label class="sp__opt">
          <span class="sp__label">Keyword case</span>
          <select class="sp__select" :value="keywordCase" @change="onKeywordCaseChange">
            <option v-for="o in keywordCaseOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <label class="sp__opt">
          <span class="sp__label">Lines between queries</span>
          <select
            class="sp__select"
            :value="linesBetweenQueries"
            @change="onLinesBetweenChange"
          >
            <option v-for="o in linesBetweenOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="sp__toggle"
          :class="{ 'sp__toggle--active': newlineBeforeSemicolon }"
          :aria-pressed="newlineBeforeSemicolon"
          title="Insert a newline before each semicolon"
          @click="toggleNewlineBeforeSemicolon"
        >
          <span>Newline before ;</span>
        </button>
      </div>

      <label class="sp__field">
        <span class="sp__label">SQL</span>
        <textarea
          class="sp__textarea sp__textarea--mono"
          placeholder="Paste SQL here…  e.g.  select id,name from users where active=1 order by name"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="Formatted SQL"
      :description="outputs ? metaLine : 'Paste SQL above to format.'"
      :copy-text="outputs?.sql ?? ''"
      copy-label="Copy SQL"
    >
      <p v-if="error" class="sp__error">
        <AlertCircle :size="14" />
        <span>{{ error.message }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs && !loading" class="sp__empty">
          Paste SQL above to format.
        </p>
        <div v-if="outputs" class="sp__result">
          <div class="sp__result-head">
            <span class="sp__result-label">
              <Database :size="13" />
              <span>{{ languageOptions.find((o) => o.value === language)?.label ?? 'SQL' }}</span>
            </span>
            <CopyButton :text="outputs.sql" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.sql" class="sp__code"><code>{{ outputs.sql }}</code></pre>
          <p v-else class="sp__empty">SQL formatted to an empty result.</p>
          <div class="sp__meta">
            <span>{{ metaLine }}</span>
          </div>
        </div>
        <div v-if="loading && !outputs" class="sp__loading">
          <Loader2 :size="14" />
          <span>Loading formatter…</span>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.sp__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.sp__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sp__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.sp__select {
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
.sp__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.sp__toggle {
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
.sp__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.sp__textarea {
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
.sp__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.sp__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.sp__btn {
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
.sp__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.sp__btn:active:not(:disabled) {
  transform: translateY(0);
}
.sp__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.sp__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.sp__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.sp__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--qt-muted);
  font-size: 13px;
}
.sp__loading :deep(svg) {
  animation: sp-spin 0.8s linear infinite;
}
@keyframes sp-spin {
  to {
    transform: rotate(360deg);
  }
}
.sp__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sp__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sp__result-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.sp__code {
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
.sp__code code {
  font: inherit;
  white-space: pre-wrap;
}
.sp__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
</style>
