<script setup lang="ts">
/**
 * XmlToJson — convert XML to JSON.
 *
 * Parses XML text via `fast-xml-parser`'s `XMLParser` and emits pretty-printed
 * (or compact) JSON. The `fast-xml-parser` package is part of the initial
 * bundle (per `tech-stack.md`), so this tool rides the app-shell bundle for its
 * parser.
 *
 * Options: attribute-name prefix, array mode (auto/always/never), trim values,
 * and JSON indent (2/4/compact).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the XML, and
 * sends `output` PostMessages whenever the computed JSON changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useXmlToJson,
  type ArrayMode,
  type JsonIndent,
} from './useXmlToJson';

const {
  input,
  attributeNamePrefix,
  arrayMode,
  trimValues,
  indent,
  outputs,
  error,
  recompute,
  setArrayMode,
  setIndent,
  setTrim,
  setAttributePrefix,
} = useXmlToJson();

const description = computed(() =>
  'Parse XML and emit JSON. Attributes are keyed by their prefix; tag values are coerced to native JS types.',
);

const indentOptions: Array<{ value: JsonIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
  { value: 0, label: 'Compact' },
];

const arrayModeOptions: Array<{ value: ArrayMode; label: string }> = [
  { value: 'auto', label: 'Auto (repeated → array)' },
  { value: 'always', label: 'Always (every tag → array)' },
];

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
  const v = Number((e.target as HTMLSelectElement).value);
  setIndent(v as JsonIndent);
}

function onArrayModeChange(e: Event): void {
  setArrayMode((e.target as HTMLSelectElement).value as ArrayMode);
}

function onPrefixInput(e: Event): void {
  setAttributePrefix((e.target as HTMLInputElement).value);
}

function onTrimToggle(e: Event): void {
  setTrim((e.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="x2j">
    <ToolInput title="XML input" :description="description">
      <template #actions>
        <button
          class="x2j__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="x2j__opts">
        <label class="x2j__opt">
          <span class="x2j__label">Array mode</span>
          <select
            class="x2j__select"
            :value="arrayMode"
            @change="onArrayModeChange"
          >
            <option v-for="o in arrayModeOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>

        <label class="x2j__opt">
          <span class="x2j__label">Indent</span>
          <select
            class="x2j__select"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>

        <label class="x2j__opt">
          <span class="x2j__label">Attribute prefix</span>
          <input
            class="x2j__input"
            type="text"
            :value="attributeNamePrefix"
            spellcheck="false"
            autocomplete="off"
            placeholder="@_"
            @input="onPrefixInput"
          />
        </label>

        <label class="x2j__opt x2j__opt--check">
          <input
            class="x2j__checkbox"
            type="checkbox"
            :checked="trimValues"
            @change="onTrimToggle"
          />
          <span class="x2j__label">Trim values</span>
        </label>
      </div>

      <label class="x2j__field">
        <span class="x2j__label">XML</span>
        <textarea
          class="x2j__textarea x2j__textarea--mono"
          placeholder="Paste XML here…"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="JSON output"
      :description="outputs ? `${outputs.rootKeyCount} root key${outputs.rootKeyCount === 1 ? '' : 's'} · ${outputs.outputBytes} bytes` : 'Paste XML above to convert.'"
      :copy-text="outputs?.json ?? ''"
      copy-label="Copy JSON"
    >
      <p v-if="error" class="x2j__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="x2j__empty">
          Paste XML above to convert.
        </p>
        <div v-if="outputs" class="x2j__result">
          <div class="x2j__result-head">
            <span class="x2j__result-label">JSON</span>
            <CopyButton :text="outputs.json" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.json" class="x2j__code">{{ outputs.json }}</pre>
          <p v-else class="x2j__empty">XML parsed to an empty result.</p>
          <div class="x2j__meta">
            <span>{{ outputs.rootKeyCount }} root key{{ outputs.rootKeyCount === 1 ? '' : 's' }}</span>
            <span class="x2j__dot">·</span>
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="x2j__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.x2j {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.x2j__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.x2j__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.x2j__opt--check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.x2j__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.x2j__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.x2j__select,
.x2j__input {
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
.x2j__input {
  cursor: text;
  min-width: 80px;
}
.x2j__select:focus,
.x2j__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.x2j__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.x2j__textarea {
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
.x2j__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.x2j__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.x2j__btn {
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
.x2j__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.x2j__btn:active:not(:disabled) {
  transform: translateY(0);
}
.x2j__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.x2j__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.x2j__error strong {
  margin-right: 4px;
}
.x2j__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.x2j__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.x2j__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.x2j__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.x2j__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.x2j__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.x2j__dot {
  opacity: 0.6;
}
</style>
