<script setup lang="ts">
/**
 * YamlPrettify — pretty-print and format YAML.
 *
 * Parses YAML (single document or multi-document `---` streams) via the
 * `yaml` package and re-serializes it with a configurable indent (2 spaces,
 * 4 spaces, or a tab), optional flow style, and optional `---` document
 * markers. The output is rendered with a small hand-rolled syntax
 * highlighter (no external deps) — keys, strings, numbers, booleans, null,
 * comments, anchors/aliases, tags, and punctuation each get their own
 * colour. A "raw" toggle switches to the unhighlighted text for easy
 * copying.
 *
 * The `yaml` package is part of the initial bundle (per `tech-stack.md`),
 * so this tool does not produce its own lazy chunk for the parser — it
 * rides the app-shell bundle.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the YAML,
 * and sends `output` PostMessages whenever the prettified result changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, Code2, FileJson } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useYamlPrettify,
  highlightYaml,
  type YamlIndent,
} from './useYamlPrettify';

const {
  input,
  indent,
  flow,
  directives,
  showRaw,
  outputs,
  error,
  recompute,
  setIndent,
  toggleFlow,
  toggleDirectives,
} = useYamlPrettify();

const indentOptions: Array<{ value: YamlIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
  { value: 'tab', label: 'Tab' },
];

const highlighted = computed(() =>
  outputs.value ? highlightYaml(outputs.value.yaml) : '',
);

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    `${o.documentCount} doc${o.documentCount === 1 ? '' : 's'}`,
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
  setIndent(v === 'tab' ? 'tab' : (Number(v) as YamlIndent));
}
</script>

<template>
  <div class="yp">
    <ToolInput
      title="YAML input"
      description="Paste messy or minified YAML. It is parsed and re-serialized with the chosen indent."
    >
      <template #actions>
        <button
          class="yp__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Format</span>
        </button>
      </template>

      <div class="yp__opts">
        <label class="yp__opt">
          <span class="yp__label">Indent</span>
          <select
            class="yp__select"
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
          class="yp__toggle"
          :class="{ 'yp__toggle--active': flow }"
          :aria-pressed="flow"
          title="Use flow-style collections ({ } and [ ]) instead of block style"
          @click="toggleFlow"
        >
          <Code2 :size="13" />
          <span>Flow</span>
        </button>
        <button
          type="button"
          class="yp__toggle"
          :class="{ 'yp__toggle--active': directives }"
          :aria-pressed="directives"
          title="Emit explicit --- document-start markers"
          @click="toggleDirectives"
        >
          <FileJson :size="13" />
          <span>Directives</span>
        </button>
        <button
          type="button"
          class="yp__toggle"
          :class="{ 'yp__toggle--active': !showRaw }"
          :aria-pressed="!showRaw"
          title="Show syntax-highlighted output"
          @click="showRaw = false"
        >
          <Code2 :size="13" />
          <span>Highlight</span>
        </button>
        <button
          type="button"
          class="yp__toggle"
          :class="{ 'yp__toggle--active': showRaw }"
          :aria-pressed="showRaw"
          title="Show raw prettified text (no colours)"
          @click="showRaw = true"
        >
          <FileJson :size="13" />
          <span>Raw</span>
        </button>
      </div>

      <label class="yp__field">
        <span class="yp__label">YAML</span>
        <textarea
          class="yp__textarea yp__textarea--mono"
          placeholder="Paste YAML here…  e.g.  name: Q-Tools&#10;tools: [a, b, c]"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="Formatted YAML"
      :description="outputs ? metaLine : 'Paste YAML above to format.'"
      :copy-text="outputs?.yaml ?? ''"
      copy-label="Copy YAML"
    >
      <p v-if="error" class="yp__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="yp__empty">
          Paste YAML above to format.
        </p>
        <div v-if="outputs" class="yp__result">
          <div class="yp__result-head">
            <span class="yp__result-label">YAML</span>
            <CopyButton :text="outputs.yaml" label="Copy" icon-only />
          </div>
          <pre
            v-if="outputs.yaml"
            class="yp__code"
            :class="{ 'yp__code--raw': showRaw }"
          ><code v-if="showRaw">{{ outputs.yaml }}</code><code v-else v-html="highlighted" /></pre>
          <p v-else class="yp__empty">YAML parsed to an empty result.</p>
          <div class="yp__meta">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.yp {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.yp__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.yp__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.yp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.yp__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.yp__select {
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
.yp__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.yp__toggle {
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
.yp__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.yp__textarea {
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
.yp__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.yp__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.yp__btn {
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
.yp__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.yp__btn:active:not(:disabled) {
  transform: translateY(0);
}
.yp__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.yp__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.yp__error strong {
  margin-right: 4px;
}
.yp__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.yp__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.yp__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.yp__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.yp__code {
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
.yp__code code {
  font: inherit;
  white-space: pre-wrap;
}

/* Syntax-highlight token colours. Tuned for both dark and light themes. */
.yp__code :deep(.qt-yaml-key) {
  color: oklch(from var(--qt-accent) 70% c h);
}
.yp__code :deep(.qt-yaml-string) {
  color: var(--qt-success);
}
.yp__code :deep(.qt-yaml-number) {
  color: var(--qt-warning);
}
.yp__code :deep(.qt-yaml-boolean) {
  color: var(--qt-danger);
}
.yp__code :deep(.qt-yaml-null) {
  color: var(--qt-muted);
  font-style: italic;
}
.yp__code :deep(.qt-yaml-comment) {
  color: var(--qt-muted);
  font-style: italic;
  opacity: 0.85;
}
.yp__code :deep(.qt-yaml-anchor) {
  color: var(--qt-warning);
  font-weight: 600;
}
.yp__code :deep(.qt-yaml-alias) {
  color: var(--qt-warning);
  font-style: italic;
}
.yp__code :deep(.qt-yaml-tag) {
  color: var(--qt-danger);
}
.yp__code :deep(.qt-yaml-punct) {
  color: var(--qt-muted);
}
.yp__code :deep(.qt-yaml-directive) {
  color: var(--qt-danger);
  font-weight: 600;
}
.yp__code--raw {
  color: var(--qt-text);
}
.yp__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
</style>
