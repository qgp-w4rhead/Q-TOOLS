<script setup lang="ts">
/**
 * YamlPrettify - pretty-print and format YAML.
 *
 * Parses YAML (single document or multi-document `---` streams) via the
 * `yaml` package and re-serializes it with a configurable indent (2 spaces,
 * 4 spaces, or a tab), optional flow style, and optional `---` document
 * markers. The output is rendered with a small hand-rolled syntax
 * highlighter (no external deps) - keys, strings, numbers, booleans, null,
 * comments, anchors/aliases, tags, and punctuation each get their own
 * colour. A "raw" toggle switches to the unhighlighted text for easy
 * copying.
 *
 * The `yaml` package is part of the initial bundle (per `tech-stack.md`),
 * so this tool does not produce its own lazy chunk for the parser - it
 * rides the app-shell bundle.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the YAML,
 * and sends `output` PostMessages whenever the prettified result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.yaml-prettify-and-format.ui.';

const indentOptions = computed<Array<{ value: YamlIndent; label: string }>>(() => [
  { value: 2, label: t(U + 'indent2') },
  { value: 4, label: t(U + 'indent4') },
  { value: 'tab', label: t(U + 'indentTab') },
]);

const highlighted = computed(() =>
  outputs.value ? highlightYaml(outputs.value.yaml) : '',
);

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    t(o.documentCount === 1 ? U + 'metaDocsOne' : U + 'metaDocs', { n: o.documentCount }),
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
  setIndent(v === 'tab' ? 'tab' : (Number(v) as YamlIndent));
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
          :class="{ 'qt-chip--solid': flow }"
          :aria-pressed="flow"
          :title="t(U + 'flowTitle')"
          @click="toggleFlow"
        >
          <Code2 :size="13" />
          <span>{{ t(U + 'flow') }}</span>
        </button>
        <button
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--solid': directives }"
          :aria-pressed="directives"
          :title="t(U + 'directivesTitle')"
          @click="toggleDirectives"
        >
          <FileJson :size="13" />
          <span>{{ t(U + 'directives') }}</span>
        </button>
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
        <span class="qt-label">{{ t(U + 'yamlLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:180px"
          :placeholder="t(U + 'phYaml')"
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
      :copy-text="outputs?.yaml ?? ''"
      :copy-label="t(U + 'copyYaml')"
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
            <span class="qt-label" style="color:var(--qt-text);flex:1">{{ t(U + 'yamlLabel') }}</span>
            <CopyButton :text="outputs.yaml" :label="t('common.copy')" icon-only />
          </div>
          <pre
            v-if="outputs.yaml"
            class="yp__code"
            :class="{ 'yp__code--raw': showRaw }"
          ><code v-if="showRaw">{{ outputs.yaml }}</code><code v-else v-html="highlighted" /></pre>
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
.yp__code {
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
</style>
