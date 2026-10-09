<script setup lang="ts">
/**
 * TextSorter - sort lines of text by various criteria.
 *
 * Enter text, pick a sort mode (alphabetical, numeric, or by length),
 * toggle descending and case-sensitive options, and see the sorted
 * output live.
 *
 * Works in embed mode: receives `input` PostMessages to set text/options
 * and sends `output` PostMessages with the sorted text.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useTextSorter,
  type SortMode,
} from './useTextSorter';

const {
  input,
  mode,
  descending,
  caseSensitive,
  output,
  reset,
} = useTextSorter();

const { t } = useI18n();
const U = 'tools.text-sorter.ui.';

function onInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
function setMode(next: SortMode): void {
  mode.value = next;
}
function onDescending(e: Event): void {
  descending.value = (e.target as HTMLInputElement).checked;
}
function onCaseSensitive(e: Event): void {
  caseSensitive.value = (e.target as HTMLInputElement).checked;
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
          :title="t(U + 'resetTitle')"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <div class="qt-seg" style="margin-bottom:10px">
        <button
          type="button"
          class="qt-seg__btn"
          :class="{ 'qt-seg__btn--active': mode === 'alpha' }"
          @click="setMode('alpha')"
        >
          {{ t(U + 'modeAlpha') }}
        </button>
        <button
          type="button"
          class="qt-seg__btn"
          :class="{ 'qt-seg__btn--active': mode === 'numeric' }"
          @click="setMode('numeric')"
        >
          {{ t(U + 'modeNumeric') }}
        </button>
        <button
          type="button"
          class="qt-seg__btn"
          :class="{ 'qt-seg__btn--active': mode === 'length' }"
          @click="setMode('length')"
        >
          {{ t(U + 'modeLength') }}
        </button>
      </div>

      <div class="qt-row" style="--qt-row-gap:16px;margin-bottom:10px">
        <label class="qt-check">
          <input
            type="checkbox"
            style="width:16px;height:16px"
            :checked="descending"
            @change="onDescending"
          />
          <span class="qt-label">{{ t(U + 'descending') }}</span>
        </label>
        <label class="qt-check">
          <input
            type="checkbox"
            style="width:16px;height:16px"
            :checked="caseSensitive"
            @change="onCaseSensitive"
          />
          <span class="qt-label">{{ t(U + 'caseSensitive') }}</span>
        </label>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'inputText') }}</span>
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
      :description="t(U + 'descDone')"
    >
      <div class="qt-output-wrap">
        <textarea
          class="qt-output"
          style="min-height:140px"
          readonly
          spellcheck="false"
          :value="output"
          :aria-label="t(U + 'ariaOutput')"
        ></textarea>
        <CopyButton
          :text="output"
          :label="t('common.copy')"
          class="qt-copy-float"
        />
      </div>
    </ToolOutput>
  </div>
</template>
