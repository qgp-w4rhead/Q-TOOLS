<script setup lang="ts">
/**
 * LoremIpsum - generate Lorem Ipsum placeholder text.
 *
 * Configure the number of paragraphs, sentences per paragraph, and words per
 * sentence. Optionally start the first paragraph with the canonical
 * "Lorem ipsum dolor sit amet, consectetur adipiscing elit." opening. The
 * output regenerates live whenever any option changes and can be copied to
 * the clipboard.
 *
 * Works in embed mode: receives `input` PostMessages to set options (and
 * trigger `generate`/`reset` actions) and sends `output` PostMessages with
 * the generated text.
 */
import { RotateCcw, Sparkles } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useLoremIpsum } from './useLoremIpsum';

const {
  paragraphs,
  sentencesPerParagraph,
  wordsPerSentence,
  startWithClassic,
  output,
  generate,
  reset,
} = useLoremIpsum();

function onParagraphs(e: Event): void {
  paragraphs.value = Number((e.target as HTMLInputElement).value);
}
function onSentences(e: Event): void {
  sentencesPerParagraph.value = Number((e.target as HTMLInputElement).value);
}
function onWords(e: Event): void {
  wordsPerSentence.value = Number((e.target as HTMLInputElement).value);
}
function onClassic(e: Event): void {
  startWithClassic.value = (e.target as HTMLInputElement).checked;
}

const { t } = useI18n();
const U = 'tools.lorem-ipsum-generator.ui.';

const wordCount = () => {
  const trimmed = output.value.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
};
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

      <div class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:10px;margin-bottom:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'paragraphs') }}</span>
          <input
            type="number"
            class="qt-input"
            min="1"
            max="100"
            :value="paragraphs"
            @input="onParagraphs"
          />
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'sentencesPerParagraph') }}</span>
          <input
            type="number"
            class="qt-input"
            min="1"
            max="20"
            :value="sentencesPerParagraph"
            @input="onSentences"
          />
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'wordsPerSentence') }}</span>
          <input
            type="number"
            class="qt-input"
            min="1"
            max="50"
            :value="wordsPerSentence"
            @input="onWords"
          />
        </label>
        <label class="qt-check" style="align-self:end;padding-bottom:8px">
          <input
            type="checkbox"
            style="width:16px;height:16px"
            :checked="startWithClassic"
            @change="onClassic"
          />
          <span class="qt-label">{{ t(U + 'startClassic') }}</span>
        </label>
      </div>

      <button
        type="button"
        class="qt-btn qt-btn--primary"
        @click="generate"
      >
        <Sparkles :size="14" />
        <span>{{ t(U + 'regenerate') }}</span>
      </button>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descWords', { n: wordCount() })"
    >
      <div class="qt-output-wrap">
        <textarea
          class="qt-output"
          style="min-height:240px"
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
