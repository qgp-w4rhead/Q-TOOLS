<script setup lang="ts">
/**
 * TextReverser - reverse text by characters, words, or lines.
 *
 * Enter text, pick a reverse mode, and see the reversed output live.
 *
 * Works in embed mode: receives `input` PostMessages to set text/mode
 * and sends `output` PostMessages with the reversed text.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useTextReverser,
  type ReverseMode,
} from './useTextReverser';

const {
  input,
  mode,
  output,
  reset,
} = useTextReverser();

const { t } = useI18n();
const U = 'tools.text-reverser.ui.';

function onInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}
function setMode(next: ReverseMode): void {
  mode.value = next;
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
          :class="{ 'qt-seg__btn--active': mode === 'chars' }"
          @click="setMode('chars')"
        >
          {{ t(U + 'modeChars') }}
        </button>
        <button
          type="button"
          class="qt-seg__btn"
          :class="{ 'qt-seg__btn--active': mode === 'words' }"
          @click="setMode('words')"
        >
          {{ t(U + 'modeWords') }}
        </button>
        <button
          type="button"
          class="qt-seg__btn"
          :class="{ 'qt-seg__btn--active': mode === 'lines' }"
          @click="setMode('lines')"
        >
          {{ t(U + 'modeLines') }}
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'inputText') }}</span>
        <textarea
          class="qt-input"
          rows="5"
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
          style="min-height:120px"
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
