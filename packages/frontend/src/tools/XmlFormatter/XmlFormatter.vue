<script setup lang="ts">
/**
 * XmlFormatter - pretty-print and format XML.
 *
 * Parses XML via `fast-xml-parser`'s `XMLParser` (with `preserveOrder: true`)
 * and re-serializes it via `XMLBuilder` with `format: true` and a
 * configurable indent. The round-trip preserves the XML declaration,
 * comments, CDATA sections, attributes, repeated tags, and document order.
 *
 * The output is rendered with a small hand-rolled syntax highlighter (no
 * external deps) - tags, attributes, strings, comments, CDATA, the XML
 * declaration, and text each get their own colour. A "raw" toggle switches
 * to the unhighlighted text for easy copying.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the XML,
 * and sends `output` PostMessages whenever the formatted result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.xml-formatter.ui.';

const indentOptions = computed<Array<{ value: XmlIndent; label: string }>>(() => [
  { value: 2, label: t(U + 'indent2') },
  { value: 4, label: t(U + 'indent4') },
  { value: 'tab', label: t(U + 'indentTab') },
]);

const highlighted = computed(() =>
  outputs.value ? highlightXml(outputs.value.xml) : '',
);

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    t(U + 'metaBytes', { n: o.outputBytes }),
    t(o.tagCount === 1 ? U + 'metaTagsOne' : U + 'metaTags', { n: o.tagCount }),
    t(o.attributeCount === 1 ? U + 'metaAttrsOne' : U + 'metaAttrs', { n: o.attributeCount }),
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
  setIndent(v === 'tab' ? 'tab' : (Number(v) as XmlIndent));
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

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="trimValues"
            @change="setTrim(($event.target as HTMLInputElement).checked)"
          />
          <span class="qt-label">{{ t(U + 'trimValues') }}</span>
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="preserveComments"
            @change="setPreserveComments(($event.target as HTMLInputElement).checked)"
          />
          <span class="qt-label">{{ t(U + 'keepComments') }}</span>
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="preserveCDATA"
            @change="setPreserveCDATA(($event.target as HTMLInputElement).checked)"
          />
          <span class="qt-label">{{ t(U + 'keepCdata') }}</span>
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="collapseEmpty"
            @change="setCollapseEmpty(($event.target as HTMLInputElement).checked)"
          />
          <span class="qt-label">{{ t(U + 'selfClose') }}</span>
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
          <FileCode :size="13" />
          <span>{{ t(U + 'raw') }}</span>
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'xmlLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:180px"
          :placeholder="t(U + 'phXml')"
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
      :copy-text="outputs?.xml ?? ''"
      :copy-label="t(U + 'copyXml')"
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
            <span class="qt-label" style="color:var(--qt-text);flex:1">{{ t(U + 'xmlLabel') }}</span>
            <CopyButton :text="outputs.xml" :label="t('common.copy')" icon-only />
          </div>
          <pre
            v-if="outputs.xml"
            class="xf__code"
            :class="{ 'xf__code--raw': showRaw }"
          ><code v-if="showRaw">{{ outputs.xml }}</code><code v-else v-html="highlighted" /></pre>
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
.xf__code {
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
</style>
