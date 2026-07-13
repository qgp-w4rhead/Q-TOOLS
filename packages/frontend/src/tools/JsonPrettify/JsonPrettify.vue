<script setup lang="ts">
/**
 * JsonPrettify — pretty-print and format JSON.
 *
 * Parses JSON with `JSON.parse` and re-serializes it with `JSON.stringify`
 * using a configurable indent (2 spaces, 4 spaces, or a tab). The output is
 * rendered with a small hand-rolled syntax highlighter (no external deps) —
 * keys, strings, numbers, booleans, null, and punctuation each get their own
 * colour. A "raw" toggle switches to the unhighlighted text for easy copying.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the prettified result changes.
 */
import { computed } from 'vue';
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

const indentOptions: Array<{ value: JsonIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
  { value: 'tab', label: 'Tab' },
];

const highlighted = computed(() =>
  outputs.value ? highlightJson(outputs.value.json) : '',
);

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    `${o.outputBytes} bytes`,
    `${o.keyCount} key${o.keyCount === 1 ? '' : 's'}`,
    `depth ${o.maxDepth}`,
  ];
  if (o.inputBytes !== o.outputBytes) {
    const delta = o.outputBytes - o.inputBytes;
    parts.push(`${delta > 0 ? '+' : ''}${delta} B`);
  }
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

function onIndentChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  setIndent(v === 'tab' ? 'tab' : (Number(v) as JsonIndent));
}
</script>

<template>
  <div class="jp">
    <ToolInput
      title="JSON input"
      description="Paste minified or messy JSON. It is parsed and re-serialized with the chosen indent."
    >
      <template #actions>
        <button
          class="jp__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Format</span>
        </button>
      </template>

      <div class="jp__opts">
        <label class="jp__opt">
          <span class="jp__label">Indent</span>
          <select
            class="jp__select"
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
          class="jp__toggle"
          :class="{ 'jp__toggle--active': !showRaw }"
          :aria-pressed="!showRaw"
          title="Show syntax-highlighted output"
          @click="showRaw = false"
        >
          <Code2 :size="13" />
          <span>Highlight</span>
        </button>
        <button
          type="button"
          class="jp__toggle"
          :class="{ 'jp__toggle--active': showRaw }"
          :aria-pressed="showRaw"
          title="Show raw prettified text (no colours)"
          @click="showRaw = true"
        >
          <FileJson :size="13" />
          <span>Raw</span>
        </button>
      </div>

      <label class="jp__field">
        <span class="jp__label">JSON</span>
        <textarea
          class="jp__textarea jp__textarea--mono"
          placeholder='Paste JSON here…  e.g.  {"a":1,"b":[2,3,true,null]}'
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="Formatted JSON"
      :description="outputs ? metaLine : 'Paste JSON above to format.'"
      :copy-text="outputs?.json ?? ''"
      copy-label="Copy JSON"
    >
      <p v-if="error" class="jp__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="jp__empty">
          Paste JSON above to format.
        </p>
        <div v-if="outputs" class="jp__result">
          <div class="jp__result-head">
            <span class="jp__result-label">JSON</span>
            <CopyButton :text="outputs.json" label="Copy" icon-only />
          </div>
          <pre
            v-if="outputs.json"
            class="jp__code"
            :class="{ 'jp__code--raw': showRaw }"
          ><code v-if="showRaw">{{ outputs.json }}</code><code v-else v-html="highlighted" /></pre>
          <p v-else class="jp__empty">JSON parsed to an empty result.</p>
          <div class="jp__meta">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.jp {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.jp__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.jp__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jp__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.jp__select {
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
.jp__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.jp__toggle {
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
.jp__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.jp__textarea {
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
.jp__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.jp__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.jp__btn {
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
.jp__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.jp__btn:active:not(:disabled) {
  transform: translateY(0);
}
.jp__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.jp__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.jp__error strong {
  margin-right: 4px;
}
.jp__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.jp__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jp__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.jp__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.jp__code {
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
.jp__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
</style>
