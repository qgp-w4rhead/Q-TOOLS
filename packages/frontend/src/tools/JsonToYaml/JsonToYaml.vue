<script setup lang="ts">
/**
 * JsonToYaml — convert JSON to YAML documents.
 *
 * Parses JSON (a single value, or an array of values when multi-document
 * output is enabled) and serializes it to YAML via the `yaml` package. The
 * `yaml` package is part of the initial bundle (per `tech-stack.md`), so
 * this tool rides the app-shell bundle for its serializer.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON,
 * and sends `output` PostMessages whenever the computed YAML changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw, FileJson, Braces } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useJsonToYaml, type YamlIndent } from './useJsonToYaml';

const {
  input,
  indent,
  flow,
  multiDoc,
  outputs,
  error,
  recompute,
  setIndent,
  toggleFlow,
  toggleMultiDoc,
} = useJsonToYaml();

const description = computed(() =>
  multiDoc.value
    ? 'Parse JSON and emit a multi-document YAML stream (one `---` doc per array element).'
    : 'Parse JSON and emit YAML. Top-level arrays become a single YAML sequence.',
);

const indentOptions: Array<{ value: YamlIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
];

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  const stageLabel = e.stage === 'json' ? 'JSON' : 'YAML';
  if (e.line != null && e.column != null) {
    return `${stageLabel} · Line ${e.line}, column ${e.column}`;
  }
  if (e.line != null) return `${stageLabel} · Line ${e.line}`;
  return stageLabel;
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onIndentChange(e: Event): void {
  const v = Number((e.target as HTMLSelectElement).value);
  setIndent(v as YamlIndent);
}
</script>

<template>
  <div class="j2y">
    <ToolInput title="JSON input" :description="description">
      <template #actions>
        <button
          class="j2y__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="j2y__opts">
        <label class="j2y__opt">
          <span class="j2y__label">Indent</span>
          <select
            class="j2y__select"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="j2y__toggle"
          :class="{ 'j2y__toggle--active': flow }"
          :aria-pressed="flow"
          title="Use flow-style collections ([1, 2] and {a: 1}) instead of block style"
          @click="toggleFlow"
        >
          <Braces :size="13" />
          <span>Flow style</span>
        </button>
        <button
          type="button"
          class="j2y__toggle"
          :class="{ 'j2y__toggle--active': multiDoc }"
          :aria-pressed="multiDoc"
          title="Emit a top-level JSON array as a multi-document YAML stream (--- separated)"
          @click="toggleMultiDoc"
        >
          <FileJson :size="13" />
          <span>Multi-doc stream</span>
        </button>
      </div>

      <label class="j2y__field">
        <span class="j2y__label">JSON</span>
        <textarea
          class="j2y__textarea j2y__textarea--mono"
          placeholder="Paste JSON here…"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="YAML output"
      :description="outputs ? `${outputs.documentCount} document${outputs.documentCount === 1 ? '' : 's'} · ${outputs.outputBytes} bytes` : 'Paste JSON above to convert.'"
      :copy-text="outputs?.yaml ?? ''"
      copy-label="Copy YAML"
    >
      <p v-if="error" class="j2y__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="j2y__empty">
          Paste JSON above to convert.
        </p>
        <div v-if="outputs" class="j2y__result">
          <div class="j2y__result-head">
            <span class="j2y__result-label">YAML</span>
            <CopyButton :text="outputs.yaml" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.yaml" class="j2y__code">{{ outputs.yaml }}</pre>
          <p v-else class="j2y__empty">JSON parsed to an empty result.</p>
          <div class="j2y__meta">
            <span>{{ outputs.documentCount }} doc{{ outputs.documentCount === 1 ? '' : 's' }}</span>
            <span class="j2y__dot">·</span>
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="j2y__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.j2y {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.j2y__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.j2y__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2y__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2y__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.j2y__select {
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
.j2y__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.j2y__toggle {
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
.j2y__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.j2y__textarea {
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
.j2y__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.j2y__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.j2y__btn {
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
.j2y__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.j2y__btn:active:not(:disabled) {
  transform: translateY(0);
}
.j2y__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.j2y__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.j2y__error strong {
  margin-right: 4px;
}
.j2y__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.j2y__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2y__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.j2y__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.j2y__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.j2y__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.j2y__dot {
  opacity: 0.6;
}
</style>
