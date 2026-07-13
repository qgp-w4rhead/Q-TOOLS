<script setup lang="ts">
/**
 * XmlFormatter — pretty-print and format XML.
 *
 * Parses XML via `fast-xml-parser`'s `XMLParser` (with `preserveOrder: true`)
 * and re-serializes it via `XMLBuilder` with `format: true` and a
 * configurable indent. The round-trip preserves the XML declaration,
 * comments, CDATA sections, attributes, repeated tags, and document order.
 *
 * The output is rendered with a small hand-rolled syntax highlighter (no
 * external deps) — tags, attributes, strings, comments, CDATA, the XML
 * declaration, and text each get their own colour. A "raw" toggle switches
 * to the unhighlighted text for easy copying.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the XML,
 * and sends `output` PostMessages whenever the formatted result changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, Code2, FileCode } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useXmlFormatter,
  highlightXml,
  type XmlIndent,
} from './useXmlFormatter';

const {
  input,
  indent,
  trimValues,
  preserveComments,
  preserveCDATA,
  collapseEmpty,
  showRaw,
  outputs,
  error,
  recompute,
  setIndent,
  setTrim,
  setPreserveComments,
  setPreserveCDATA,
  setCollapseEmpty,
} = useXmlFormatter();

const indentOptions: Array<{ value: XmlIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
  { value: 'tab', label: 'Tab' },
];

const highlighted = computed(() =>
  outputs.value ? highlightXml(outputs.value.xml) : '',
);

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    `${o.outputBytes} bytes`,
    `${o.tagCount} tag${o.tagCount === 1 ? '' : 's'}`,
    `${o.attributeCount} attr${o.attributeCount === 1 ? '' : 's'}`,
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
  setIndent(v === 'tab' ? 'tab' : (Number(v) as XmlIndent));
}
</script>

<template>
  <div class="xf">
    <ToolInput
      title="XML input"
      description="Paste minified or messy XML. It is parsed and re-serialized with the chosen indent, preserving comments, CDATA, and attributes."
    >
      <template #actions>
        <button
          class="xf__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Format</span>
        </button>
      </template>

      <div class="xf__opts">
        <label class="xf__opt">
          <span class="xf__label">Indent</span>
          <select
            class="xf__select"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="String(o.value)" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>

        <label class="xf__opt xf__opt--check">
          <input
            class="xf__checkbox"
            type="checkbox"
            :checked="trimValues"
            @change="setTrim(($event.target as HTMLInputElement).checked)"
          />
          <span class="xf__label">Trim values</span>
        </label>

        <label class="xf__opt xf__opt--check">
          <input
            class="xf__checkbox"
            type="checkbox"
            :checked="preserveComments"
            @change="setPreserveComments(($event.target as HTMLInputElement).checked)"
          />
          <span class="xf__label">Keep comments</span>
        </label>

        <label class="xf__opt xf__opt--check">
          <input
            class="xf__checkbox"
            type="checkbox"
            :checked="preserveCDATA"
            @change="setPreserveCDATA(($event.target as HTMLInputElement).checked)"
          />
          <span class="xf__label">Keep CDATA</span>
        </label>

        <label class="xf__opt xf__opt--check">
          <input
            class="xf__checkbox"
            type="checkbox"
            :checked="collapseEmpty"
            @change="setCollapseEmpty(($event.target as HTMLInputElement).checked)"
          />
          <span class="xf__label">Self-close empty</span>
        </label>

        <button
          type="button"
          class="xf__toggle"
          :class="{ 'xf__toggle--active': !showRaw }"
          :aria-pressed="!showRaw"
          title="Show syntax-highlighted output"
          @click="showRaw = false"
        >
          <Code2 :size="13" />
          <span>Highlight</span>
        </button>
        <button
          type="button"
          class="xf__toggle"
          :class="{ 'xf__toggle--active': showRaw }"
          :aria-pressed="showRaw"
          title="Show raw formatted text (no colours)"
          @click="showRaw = true"
        >
          <FileCode :size="13" />
          <span>Raw</span>
        </button>
      </div>

      <label class="xf__field">
        <span class="xf__label">XML</span>
        <textarea
          class="xf__textarea xf__textarea--mono"
          placeholder='Paste XML here…  e.g.  <root a="1"><item>foo</item></root>'
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="Formatted XML"
      :description="outputs ? metaLine : 'Paste XML above to format.'"
      :copy-text="outputs?.xml ?? ''"
      copy-label="Copy XML"
    >
      <p v-if="error" class="xf__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="xf__empty">
          Paste XML above to format.
        </p>
        <div v-if="outputs" class="xf__result">
          <div class="xf__result-head">
            <span class="xf__result-label">XML</span>
            <CopyButton :text="outputs.xml" label="Copy" icon-only />
          </div>
          <pre
            v-if="outputs.xml"
            class="xf__code"
            :class="{ 'xf__code--raw': showRaw }"
          ><code v-if="showRaw">{{ outputs.xml }}</code><code v-else v-html="highlighted" /></pre>
          <p v-else class="xf__empty">XML parsed to an empty result.</p>
          <div class="xf__meta">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.xf {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.xf__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.xf__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.xf__opt--check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.xf__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.xf__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.xf__select {
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
.xf__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.xf__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.xf__toggle {
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
.xf__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.xf__textarea {
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
.xf__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.xf__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.xf__btn {
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
.xf__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.xf__btn:active:not(:disabled) {
  transform: translateY(0);
}
.xf__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.xf__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.xf__error strong {
  margin-right: 4px;
}
.xf__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.xf__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.xf__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.xf__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.xf__code {
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
.xf__code code {
  font: inherit;
  white-space: pre-wrap;
}

/* Syntax-highlight token colours. Tuned for both dark and light themes. */
.xf__code :deep(.qt-xml-tag) {
  color: oklch(from var(--qt-accent) 70% c h);
}
.xf__code :deep(.qt-xml-attr) {
  color: var(--qt-warning);
}
.xf__code :deep(.qt-xml-string) {
  color: var(--qt-success);
}
.xf__code :deep(.qt-xml-comment) {
  color: var(--qt-muted);
  font-style: italic;
}
.xf__code :deep(.qt-xml-cdata) {
  color: var(--qt-warning);
  font-style: italic;
}
.xf__code :deep(.qt-xml-decl) {
  color: var(--qt-muted);
}
.xf__code :deep(.qt-xml-text) {
  color: var(--qt-text);
}
.xf__code--raw {
  color: var(--qt-text);
}
.xf__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
</style>
