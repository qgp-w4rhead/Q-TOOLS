<script setup lang="ts">
/**
 * XmlToJson - convert XML to JSON.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.xml-to-json.ui.';

const description = computed(() => t(U + 'desc'));

const indentOptions: Array<{ value: JsonIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
  { value: 0, label: 'Compact' },
];

const arrayModeOptions: Array<{ value: ArrayMode; label: string }> = [
  { value: 'auto', label: 'Auto (repeated → array)' },
  { value: 'always', label: 'Always (every tag → array)' },
];

/** Localized indent-option label (0 = compact). */
function indentLabel(o: { value: JsonIndent }): string {
  return o.value === 0 ? t(U + 'compact') : t(U + 'indentN', { n: o.value });
}

/** Localized array-mode label. */
function arrayModeLabel(o: { value: ArrayMode }): string {
  return o.value === 'auto' ? t(U + 'arrayAuto') : t(U + 'arrayAlways');
}

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
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="description">
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--end" style="--qt-row-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'arrayMode') }}</span>
          <select
            class="qt-input"
            :value="arrayMode"
            @change="onArrayModeChange"
          >
            <option v-for="o in arrayModeOptions" :key="o.value" :value="o.value">
              {{ arrayModeLabel(o) }}
            </option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'indent') }}</span>
          <select
            class="qt-input"
            :value="indent"
            @change="onIndentChange"
          >
            <option v-for="o in indentOptions" :key="o.value" :value="o.value">
              {{ indentLabel(o) }}
            </option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'attrPrefix') }}</span>
          <input
            class="qt-input x2j__input"
            type="text"
            :value="attributeNamePrefix"
            spellcheck="false"
            autocomplete="off"
            placeholder="@_"
            @input="onPrefixInput"
          />
        </label>

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="trimValues"
            @change="onTrimToggle"
          />
          <span>{{ t(U + 'trimValues') }}</span>
        </label>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'xmlLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono x2j__textarea"
          :placeholder="t(U + 'placeholder')"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="outputs ? t(U + 'outputDesc', { keys: t(U + 'rootKeys', outputs.rootKeyCount), bytes: outputs.outputBytes }) : t(U + 'empty')"
      :copy-text="outputs?.json ?? ''"
      :copy-label="t(U + 'copyJson')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t(U + 'empty') }}
        </p>
        <div v-if="outputs" class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="qt-label">JSON</span>
            <CopyButton :text="outputs.json" :label="t('common.copy')" icon-only />
          </div>
          <pre v-if="outputs.json" class="qt-mono x2j__code">{{ outputs.json }}</pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'rootKeys', outputs.rootKeyCount) }}</span>
            <span class="x2j__dot">·</span>
            <span>{{ t(U + 'bytesIn', { n: outputs.inputBytes }) }}</span>
            <span class="x2j__dot">·</span>
            <span>{{ t(U + 'bytesOut', { n: outputs.outputBytes }) }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Opt input sizing (control via .qt-input). */
.x2j__input {
  min-width: 80px;
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.x2j__textarea {
  min-height: 180px;
}
/* JSON output block (font via .qt-mono) — scrollable, pre-wrapped. */
.x2j__code {
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
/* Meta separator dot. */
.x2j__dot {
  opacity: 0.6;
}
</style>
