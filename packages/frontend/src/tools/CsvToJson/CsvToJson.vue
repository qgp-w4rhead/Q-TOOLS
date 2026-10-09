<script setup lang="ts">
/**
 * CsvToJson - convert CSV data to JSON.
 *
 * Enter CSV text, pick a delimiter and whether the first row is a header,
 * and see the JSON output live.
 *
 * Works in embed mode: receives `input` PostMessages to set the CSV/options
 * and sends `output` PostMessages with the JSON result.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useCsvToJson } from './useCsvToJson';

const {
  input,
  delimiter,
  hasHeader,
  output,
  rowCount,
  error,
  reset,
} = useCsvToJson();

const { t } = useI18n();
const U = 'tools.csv-to-json.ui.';

const outputDescription = computed(() => {
  if (error.value) return t(U + 'outputDescError');
  if (rowCount.value > 0) return t(U + 'rowsConverted', rowCount.value);
  return t(U + 'outputDescEmpty');
});

function onInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
function onDelimiter(e: Event): void {
  const val = (e.target as HTMLSelectElement).value;
  delimiter.value = val === 'tab' ? '\t' : val;
}
function onHasHeader(e: Event): void {
  hasHeader.value = (e.target as HTMLInputElement).checked;
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
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'reset')"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>{{ t(U + 'reset') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--end" style="--qt-row-gap:16px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'delimiter') }}</span>
          <select class="qt-input" :value="delimiter === '\t' ? 'tab' : delimiter" @change="onDelimiter">
            <option value=",">{{ t(U + 'delimComma') }}</option>
            <option value=";">{{ t(U + 'delimSemicolon') }}</option>
            <option value="tab">{{ t(U + 'delimTab') }}</option>
            <option value="|">{{ t(U + 'delimPipe') }}</option>
          </select>
        </label>
        <label class="qt-check">
          <input
            type="checkbox"
            :checked="hasHeader"
            @change="onHasHeader"
          />
          <span>{{ t(U + 'hasHeader') }}</span>
        </label>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'csvInput') }}</span>
        <textarea
          class="qt-input"
          rows="6"
          :placeholder="t(U + 'placeholder')"
          spellcheck="false"
          :value="input"
          @input="onInput"
        ></textarea>
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="outputDescription"
    >
      <p v-if="error" class="qt-alert qt-alert--error">{{ error }}</p>
      <div v-else class="cj__output-wrap">
        <textarea
          class="qt-input qt-input--mono cj__output"
          readonly
          spellcheck="false"
          :value="output"
          :aria-label="t(U + 'ariaJsonOutput')"
        ></textarea>
        <CopyButton
          :text="output"
          :label="t('common.copy')"
          class="cj__copy"
        />
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Output wrapper — anchors the floating copy button. */
.cj__output-wrap {
  position: relative;
}
/* JSON output textarea (control + mono via .qt-input--mono) — pre-formatted, scrollable. */
.cj__output {
  min-height: 200px;
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
}
/* Floating copy button (top-right of the output). */
.cj__copy {
  position: absolute;
  top: 8px;
  right: 8px;
}
</style>
