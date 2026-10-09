<script setup lang="ts">
/**
 * DuplicateLineRemover - remove duplicate lines from text.
 *
 * Enter text, toggle case-sensitive and trim-whitespace options, and see
 * the deduplicated output with statistics.
 *
 * Works in embed mode: receives `input` PostMessages to set text/options
 * and sends `output` PostMessages with the deduplicated text.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useDuplicateLineRemover } from './useDuplicateLineRemover';

const {
  input,
  caseSensitive,
  trimWhitespace,
  output,
  removedCount,
  originalCount,
  reset,
} = useDuplicateLineRemover();

const { t } = useI18n();
const U = 'tools.duplicate-line-remover.ui.';

function onInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
function onCaseSensitive(e: Event): void {
  caseSensitive.value = (e.target as HTMLInputElement).checked;
}
function onTrimWhitespace(e: Event): void {
  trimWhitespace.value = (e.target as HTMLInputElement).checked;
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

      <div class="qt-row" style="--qt-row-gap:16px;margin-bottom:10px">
        <label class="qt-check">
          <input
            type="checkbox"
            style="width:16px;height:16px"
            :checked="caseSensitive"
            @change="onCaseSensitive"
          />
          <span class="qt-label">{{ t(U + 'caseSensitive') }}</span>
        </label>
        <label class="qt-check">
          <input
            type="checkbox"
            style="width:16px;height:16px"
            :checked="trimWhitespace"
            @change="onTrimWhitespace"
          />
          <span class="qt-label">{{ t(U + 'trimWhitespace') }}</span>
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
      :description="originalCount > 0 ? t(U + 'descResult', { total: originalCount, unique: originalCount - removedCount, removed: removedCount }) : t(U + 'descEmpty')"
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
