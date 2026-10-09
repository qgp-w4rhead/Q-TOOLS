<script setup lang="ts">
/**
 * JsonToXml - convert JSON to XML.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.json-to-xml.ui.';

const description = computed(() => t(U + 'desc'));

const indentOptions: Array<{ value: XmlIndent; label: string }> = [
  { value: 2, label: '2 spaces' },
  { value: 4, label: '4 spaces' },
];

/** Localized indent-option label. */
function indentLabel(o: { value: XmlIndent }): string {
  return t(U + 'indentN', { n: o.value });
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
          <span class="qt-label">{{ t(U + 'rootElement') }}</span>
          <input
            class="qt-input j2x__input"
            type="text"
            :value="rootName"
            spellcheck="false"
            autocomplete="off"
            :placeholder="t(U + 'rootPlaceholder')"
            @input="onRootNameInput"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'attrPrefix') }}</span>
          <input
            class="qt-input j2x__input--narrow"
            type="text"
            :value="attributeNamePrefix"
            spellcheck="false"
            autocomplete="off"
            placeholder="@_"
            @input="onPrefixInput"
          />
        </label>

        <label v-if="pretty" class="qt-field">
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

        <label class="qt-check">
          <input
            type="checkbox"
            :checked="pretty"
            @change="onPrettyToggle"
          />
          <span>{{ t(U + 'prettyPrint') }}</span>
        </label>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'jsonLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono j2x__textarea"
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
      :description="outputs ? t(U + 'outputDesc', { elements: t(U + 'rootElements', outputs.rootKeyCount), bytes: outputs.outputBytes }) : t(U + 'empty')"
      :copy-text="outputs?.xml ?? ''"
      :copy-label="t(U + 'copyXml')"
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
            <span class="qt-label">XML</span>
            <CopyButton :text="outputs.xml" :label="t('common.copy')" icon-only />
          </div>
          <pre v-if="outputs.xml" class="qt-mono j2x__code">{{ outputs.xml }}</pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'rootElements', outputs.rootKeyCount) }}</span>
            <span class="j2x__dot">·</span>
            <span>{{ t(U + 'bytesIn', { n: outputs.inputBytes }) }}</span>
            <span class="j2x__dot">·</span>
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
.j2x__input {
  min-width: 200px;
}
.j2x__input--narrow {
  min-width: 80px;
  width: 100px;
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.j2x__textarea {
  min-height: 180px;
}
/* XML output block (font via .qt-mono) — scrollable, pre-wrapped. */
.j2x__code {
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
/* Meta separator dot. */
.j2x__dot {
  opacity: 0.6;
}
</style>
