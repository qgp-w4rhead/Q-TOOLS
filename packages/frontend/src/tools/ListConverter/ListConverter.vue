<script setup lang="ts">
/**
 * ListConverter - convert lists between formats.
 *
 * Parses an input list in one of seven built-in formats (comma, newline,
 * JSON array, bullet list, numbered list, tab, pipe) or a custom delimiter,
 * and re-emits it in any of the same formats. Optional per-item trim and
 * duplicate removal (first-seen order preserved).
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text
 * and set the from/to formats and options; sends `output` PostMessages
 * whenever the converted list changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, RefreshCw, ArrowLeftRight, Scissors, Copy } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useListConverter,
  LIST_FORMATS,
  type ListFormat,
} from './useListConverter';

const {
  input,
  fromFormat,
  toFormat,
  trim,
  removeDuplicates,
  customDelimiter,
  outputs,
  error,
  recompute,
  swapFormats,
  setFromFormat,
  setToFormat,
  toggleTrim,
  toggleRemoveDuplicates,
} = useListConverter();

const { t } = useI18n();
const U = 'tools.list-converter.ui.';

/** Localized label for a list format (comma → fmtComma, …). */
const FMT_KEYS: Record<ListFormat, string> = {
  comma: 'fmtComma',
  newline: 'fmtNewline',
  json: 'fmtJson',
  bullet: 'fmtBullet',
  numbered: 'fmtNumbered',
  tab: 'fmtTab',
  pipe: 'fmtPipe',
  custom: 'fmtCustom',
};
function fmtLabel(f: ListFormat): string {
  return t(U + FMT_KEYS[f]);
}

const description = computed(() =>
  t(U + 'desc', { from: fmtLabel(fromFormat.value), to: fmtLabel(toFormat.value) }),
);

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  const stageLabel = e.stage === 'parse' ? t(U + 'stageParse') : t(U + 'stageFormat');
  if (e.line != null && e.column != null) {
    return t(U + 'errStageLineCol', { stage: stageLabel, line: e.line, col: e.column });
  }
  if (e.line != null) return t(U + 'errStageLine', { stage: stageLabel, line: e.line });
  return stageLabel;
});

const outputDescription = computed(() => {
  if (error.value) return t(U + 'conversionFailed');
  if (!outputs.value) return t(U + 'empty');
  const o = outputs.value;
  const parts: string[] = [t(U + 'items', o.count)];
  if (o.duplicatesRemoved > 0) {
    parts.push(t(U + 'duplicatesRemoved', o.duplicatesRemoved));
  }
  parts.push(t(U + 'bytesCount', o.outputBytes));
  return parts.join(' · ');
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onFromChange(e: Event): void {
  setFromFormat((e.target as HTMLSelectElement).value as ListFormat);
}

function onToChange(e: Event): void {
  setToFormat((e.target as HTMLSelectElement).value as ListFormat);
}

function onCustomDelimiter(e: Event): void {
  customDelimiter.value = (e.target as HTMLInputElement).value;
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

      <div class="qt-row qt-row--end" style="--qt-row-gap:10px">
        <label class="qt-field lc__field">
          <span class="qt-label">{{ t(U + 'from') }}</span>
          <select
            class="qt-input"
            :value="fromFormat"
            @change="onFromChange"
          >
            <option v-for="f in LIST_FORMATS" :key="f" :value="f">
              {{ fmtLabel(f) }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="lc__swap"
          :title="t(U + 'swapTitle')"
          @click="swapFormats"
        >
          <ArrowLeftRight :size="14" />
        </button>

        <label class="qt-field lc__field">
          <span class="qt-label">{{ t(U + 'to') }}</span>
          <select
            class="qt-input"
            :value="toFormat"
            @change="onToChange"
          >
            <option v-for="f in LIST_FORMATS" :key="f" :value="f">
              {{ fmtLabel(f) }}
            </option>
          </select>
        </label>
      </div>

      <label v-if="fromFormat === 'custom' || toFormat === 'custom'" class="qt-field lc__custom">
        <span class="qt-label">{{ t(U + 'customDelimiter') }}</span>
        <input
          type="text"
          class="qt-input"
          :value="customDelimiter"
          :placeholder="t(U + 'customDelimiterPlaceholder')"
          spellcheck="false"
          autocomplete="off"
          @input="onCustomDelimiter"
        />
      </label>

      <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
        <button
          type="button"
          class="qt-chip qt-chip--filled"
          :class="{ 'qt-chip--solid': trim }"
          :aria-pressed="trim"
          :title="t(U + 'trimItemsTitle')"
          @click="toggleTrim"
        >
          <Scissors :size="13" />
          <span>{{ t(U + 'trimItems') }}</span>
        </button>
        <button
          type="button"
          class="qt-chip qt-chip--filled"
          :class="{ 'qt-chip--solid': removeDuplicates }"
          :aria-pressed="removeDuplicates"
          :title="t(U + 'removeDuplicatesTitle')"
          @click="toggleRemoveDuplicates"
        >
          <Copy :size="13" />
          <span>{{ t(U + 'removeDuplicates') }}</span>
        </button>
      </div>

      <textarea
        class="qt-input qt-input--mono lc__textarea"
        :placeholder="t(U + 'placeholder')"
        :value="input"
        rows="8"
        spellcheck="false"
        autocomplete="off"
        @input="onTextInput"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="outputDescription"
      :copy-text="outputs?.output ?? ''"
      :copy-label="t(U + 'copyOutput')"
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
            <span class="qt-label">{{ fmtLabel(toFormat) }}</span>
            <CopyButton :text="outputs.output" :label="t('common.copy')" icon-only />
          </div>
          <pre v-if="outputs.output" class="qt-mono lc__code">{{ outputs.output }}</pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'items', outputs.count) }}</span>
            <template v-if="outputs.duplicatesRemoved > 0">
              <span class="lc__dot">·</span>
              <span>{{ t(U + 'duplicatesRemoved', outputs.duplicatesRemoved) }}</span>
            </template>
            <span class="lc__dot">·</span>
            <span>{{ t(U + 'bytesIn', { n: outputs.inputBytes }) }}</span>
            <span class="lc__dot">·</span>
            <span>{{ t(U + 'bytesOut', { n: outputs.outputBytes }) }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* From/to fields grow equally in the row (layout via .qt-field). */
.lc__field {
  flex: 1;
  min-width: 140px;
}
/* Custom-delimiter field — fixed width. */
.lc__custom {
  flex: 0 0 240px;
}
/* Swap button — square icon button with a rotate-on-hover flourish. */
.lc__swap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
}
.lc__swap:hover {
  color: var(--qt-accent);
  border-color: var(--qt-accent);
  transform: rotate(180deg);
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.lc__textarea {
  min-height: 160px;
}
/* Output block (font via .qt-mono) — scrollable, pre-wrapped. */
.lc__code {
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
}
/* Meta separator dot. */
.lc__dot {
  opacity: 0.6;
}
</style>
