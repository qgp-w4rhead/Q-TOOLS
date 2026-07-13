<script setup lang="ts">
/**
 * JsonToXml — convert JSON to XML.
 *
 * Builds XML text from a parsed JSON value via `fast-xml-parser`'s
 * `XMLBuilder`. The `fast-xml-parser` package is part of the initial
 * bundle (per `tech-stack.md`), so this tool rides the app-shell bundle
 * for its builder.
 *
 * Options: root element name (wraps the parsed value under a single root
 * for well-formed XML), attribute-name prefix (keys starting with the
 * prefix become attributes), pretty print toggle, and indent size
 * (2/4 spaces, shown only when pretty print is on).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the JSON
 * and option overrides, and sends `output` PostMessages whenever the
 * computed XML changes.
 */
import { computed } from 'vue';
import { AlertCircle, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useJsonToXml,
  type XmlIndent,
} from './useJsonToXml';

const {
  input,
  rootName,
  attributeNamePrefix,
  pretty,
  indent,
  outputs,
  error,
  recompute,
  setRootName,
  setAttributePrefix,
  setPretty,
  setIndent,
} = useJsonToXml();

const description = computed(() =>
  'Parse JSON and build XML. Keys prefixed with the attribute prefix become attributes; the parsed value is wrapped under the root element name.',
);

const indentOptions: Array<{ value: XmlIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
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
  setIndent(v as XmlIndent);
}

function onRootNameInput(e: Event): void {
  setRootName((e.target as HTMLInputElement).value);
}

function onPrefixInput(e: Event): void {
  setAttributePrefix((e.target as HTMLInputElement).value);
}

function onPrettyToggle(e: Event): void {
  setPretty((e.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="j2x">
    <ToolInput title="JSON input" :description="description">
      <template #actions>
        <button
          class="j2x__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="j2x__opts">
        <label class="j2x__opt">
          <span class="j2x__label">Root element</span>
          <input
            class="j2x__input"
            type="text"
            :value="rootName"
            spellcheck="false"
            autocomplete="off"
            placeholder="root (empty = use JSON's top key)"
            @input="onRootNameInput"
          />
        </label>

        <label class="j2x__opt">
          <span class="j2x__label">Attribute prefix</span>
          <input
            class="j2x__input j2x__input--narrow"
            type="text"
            :value="attributeNamePrefix"
            spellcheck="false"
            autocomplete="off"
            placeholder="@_"
            @input="onPrefixInput"
          />
        </label>

        <label v-if="pretty" class="j2x__opt">
          <span class="j2x__label">Indent</span>
          <select
            class="j2x__select"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>

        <label class="j2x__opt j2x__opt--check">
          <input
            class="j2x__checkbox"
            type="checkbox"
            :checked="pretty"
            @change="onPrettyToggle"
          />
          <span class="j2x__label">Pretty print</span>
        </label>
      </div>

      <label class="j2x__field">
        <span class="j2x__label">JSON</span>
        <textarea
          class="j2x__textarea j2x__textarea--mono"
          placeholder='Paste JSON here… e.g. {"user":{"name":"Alice","@_id":"1"}}'
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="XML output"
      :description="outputs ? `${outputs.rootKeyCount} root element${outputs.rootKeyCount === 1 ? '' : 's'} · ${outputs.outputBytes} bytes` : 'Paste JSON above to convert.'"
      :copy-text="outputs?.xml ?? ''"
      copy-label="Copy XML"
    >
      <p v-if="error" class="j2x__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="j2x__empty">
          Paste JSON above to convert.
        </p>
        <div v-if="outputs" class="j2x__result">
          <div class="j2x__result-head">
            <span class="j2x__result-label">XML</span>
            <CopyButton :text="outputs.xml" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.xml" class="j2x__code">{{ outputs.xml }}</pre>
          <p v-else class="j2x__empty">JSON parsed to an empty result.</p>
          <div class="j2x__meta">
            <span>{{ outputs.rootKeyCount }} root element{{ outputs.rootKeyCount === 1 ? '' : 's' }}</span>
            <span class="j2x__dot">·</span>
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="j2x__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.j2x {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.j2x__opts {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}
.j2x__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2x__opt--check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.j2x__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2x__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.j2x__select,
.j2x__input {
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
.j2x__input {
  cursor: text;
  min-width: 200px;
}
.j2x__input--narrow {
  min-width: 80px;
  width: 100px;
}
.j2x__select:focus,
.j2x__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.j2x__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.j2x__textarea {
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
.j2x__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.j2x__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.j2x__btn {
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
.j2x__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.j2x__btn:active:not(:disabled) {
  transform: translateY(0);
}
.j2x__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.j2x__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.j2x__error strong {
  margin-right: 4px;
}
.j2x__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.j2x__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.j2x__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.j2x__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.j2x__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
.j2x__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
.j2x__dot {
  opacity: 0.6;
}
</style>
