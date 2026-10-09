<script setup lang="ts">
/**
 * SqlPrettify - pretty-print and format SQL queries.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.sql-prettify-and-format.ui.';

const languageOptions = computed<Array<{ value: SqlLanguage; label: string }>>(() => [
  { value: 'sql', label: t(U + 'dialectStandard') },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'tsql', label: 'T-SQL' },
]);

const indentOptions = computed<Array<{ value: SqlIndent; label: string }>>(() => [
  { value: 2, label: t(U + 'indent2') },
  { value: 4, label: t(U + 'indent4') },
  { value: 'tab', label: t(U + 'indentTab') },
]);

const keywordCaseOptions = computed<Array<{ value: SqlKeywordCase; label: string }>>(() => [
  { value: 'preserve', label: t(U + 'casePreserve') },
  { value: 'upper', label: t(U + 'caseUpper') },
  { value: 'lower', label: t(U + 'caseLower') },
]);

const linesBetweenOptions = computed<Array<{ value: SqlLinesBetweenQueries; label: string }>>(() => [
  { value: 1, label: t(U + 'lines1') },
  { value: 2, label: t(U + 'lines2') },
  { value: 3, label: t(U + 'lines3') },
]);

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [t(U + 'metaBytes', { n: o.outputBytes })];
  if (o.inputBytes !== o.outputBytes) {
    const delta = o.outputBytes - o.inputBytes;
    parts.push(t(U + 'metaDelta', { sign: delta > 0 ? '+' : '', n: delta }));
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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0 || loading"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t(U + 'format') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'dialect') }}</span>
          <select class="qt-input" style="font-size:13px;padding:6px 10px" :value="language" @change="onLanguageChange">
            <option v-for="o in languageOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'indent') }}</span>
          <select class="qt-input" style="font-size:13px;padding:6px 10px" :value="indent" @change="onIndentChange">
            <option v-for="o in indentOptions" :key="String(o.value)" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'keywordCase') }}</span>
          <select class="qt-input" style="font-size:13px;padding:6px 10px" :value="keywordCase" @change="onKeywordCaseChange">
            <option v-for="o in keywordCaseOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'linesBetween') }}</span>
          <select
            class="qt-input"
            style="font-size:13px;padding:6px 10px"
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
          class="qt-chip"
          :class="{ 'qt-chip--solid': newlineBeforeSemicolon }"
          :aria-pressed="newlineBeforeSemicolon"
          :title="t(U + 'newlineTitle')"
          @click="toggleNewlineBeforeSemicolon"
        >
          <span>{{ t(U + 'newlineBefore') }}</span>
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'sqlLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:180px"
          :placeholder="t(U + 'phSql')"
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
      :copy-text="outputs?.sql ?? ''"
      :copy-label="t(U + 'copySql')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error.message }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs && !loading" class="qt-alert qt-alert--empty">
          {{ t(U + 'descEmpty') }}
        </p>
        <div v-if="outputs" class="qt-panel qt-stack" style="--qt-stack-gap:6px;padding:8px 10px">
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
            <span class="qt-label" style="color:var(--qt-text);flex:1">
              <Database :size="13" />
              <span>{{ languageOptions.find((o) => o.value === language)?.label ?? 'SQL' }}</span>
            </span>
            <CopyButton :text="outputs.sql" :label="t('common.copy')" icon-only />
          </div>
          <pre v-if="outputs.sql" class="sp__code"><code>{{ outputs.sql }}</code></pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px;font-size:12px;color:var(--qt-muted)">
            <span>{{ metaLine }}</span>
          </div>
        </div>
        <div v-if="loading && !outputs" class="qt-alert qt-alert--note" style="font-size:13px">
          <Loader2 :size="14" class="qt-spin" />
          <span>{{ t(U + 'loading') }}</span>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Formatted output — bare code inside the result panel (no border/padding). */
.sp__code {
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
.sp__code code {
  font: inherit;
  white-space: pre-wrap;
}
</style>
