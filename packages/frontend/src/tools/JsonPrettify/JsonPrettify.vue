<script setup lang="ts">
/**
 * JsonPrettify - pretty-print and format JSON.
 *
 * Parses JSON with `JSON.parse` and re-serializes it with `JSON.stringify`
 * using a configurable indent (2 spaces, 4 spaces, or a tab). The output is
 * rendered with a small hand-rolled syntax highlighter (no external deps) -
 * keys, strings, numbers, booleans, null, and punctuation each get their own
 * colour. A "raw" toggle switches to the unhighlighted text for easy copying.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the prettified result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, RefreshCw, Code2, FileJson } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useJsonPrettify,
  highlightJson,
  type JsonIndent,
} from './useJsonPrettify';

const {
  input,
  indent,
  showRaw,
  outputs,
  error,
  recompute,
  setIndent,
} = useJsonPrettify();

const { t } = useI18n();
const U = 'tools.json-prettify-and-format.ui.';

const indentOptions = computed<Array<{ value: JsonIndent; label: string }>>(() => [
  { value: 2, label: t(U + 'indent2') },
  { value: 4, label: t(U + 'indent4') },
  { value: 'tab', label: t(U + 'indentTab') },
]);

const highlighted = computed(() =>
  outputs.value ? highlightJson(outputs.value.json) : '',
);

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    t(U + 'metaBytes', { n: o.outputBytes }),
    t(o.keyCount === 1 ? U + 'metaKeysOne' : U + 'metaKeys', { n: o.keyCount }),
    t(U + 'metaDepth', { n: o.maxDepth }),
  ];
  if (o.inputBytes !== o.outputBytes) {
    const delta = o.outputBytes - o.inputBytes;
    parts.push(t(U + 'metaDelta', { sign: delta > 0 ? '+' : '', n: delta }));
  }
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

function onIndentChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  setIndent(v === 'tab' ? 'tab' : (Number(v) as JsonIndent));
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
          <span>{{ t(U + 'format') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'indent') }}</span>
          <select
            class="qt-input"
            style="font-size:13px;padding:6px 10px"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="String(o.value)" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--solid': !showRaw }"
          :aria-pressed="!showRaw"
          :title="t(U + 'highlightTitle')"
          @click="showRaw = false"
        >
          <Code2 :size="13" />
          <span>{{ t(U + 'highlight') }}</span>
        </button>
        <button
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--solid': showRaw }"
          :aria-pressed="showRaw"
          :title="t(U + 'rawTitle')"
          @click="showRaw = true"
        >
          <FileJson :size="13" />
          <span>{{ t(U + 'raw') }}</span>
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
      :copy-text="outputs?.json ?? ''"
      :copy-label="t(U + 'copyJson')"
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
            <span class="qt-label" style="color:var(--qt-text);flex:1">{{ t(U + 'jsonLabel') }}</span>
            <CopyButton :text="outputs.json" :label="t('common.copy')" icon-only />
          </div>
          <pre
            v-if="outputs.json"
            class="jp__code"
            :class="{ 'jp__code--raw': showRaw }"
          ><code v-if="showRaw">{{ outputs.json }}</code><code v-else v-html="highlighted" /></pre>
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

/* Formatted output — bare code inside the result panel (no border/padding). */
.jp__code {
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
.jp__code code {
  font: inherit;
  white-space: pre-wrap;
}

/* Syntax-highlight token colours. Tuned for both dark and light themes. */
.jp__code :deep(.qt-json-key) {
  color: oklch(from var(--qt-accent) 70% c h);
}
.jp__code :deep(.qt-json-string) {
  color: var(--qt-success);
}
.jp__code :deep(.qt-json-number) {
  color: var(--qt-warning);
}
.jp__code :deep(.qt-json-boolean) {
  color: var(--qt-danger);
}
.jp__code :deep(.qt-json-null) {
  color: var(--qt-muted);
  font-style: italic;
}
.jp__code :deep(.qt-json-punct) {
  color: var(--qt-muted);
}
.jp__code--raw {
  color: var(--qt-text);
}
</style>
