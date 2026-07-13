<script setup lang="ts">
/**
 * LoremIpsum — generate Lorem Ipsum placeholder text.
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

const wordCount = () => {
  const trimmed = output.value.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
};
</script>

<template>
  <div class="li">
    <ToolInput
      title="Options"
      description="Configure how much placeholder text to generate. Output regenerates live."
    >
      <template #actions>
        <button
          type="button"
          class="li__btn li__btn--ghost"
          title="Reset to defaults"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <div class="li__grid">
        <label class="li__field">
          <span class="li__label">Paragraphs</span>
          <input
            type="number"
            class="li__input"
            min="1"
            max="100"
            :value="paragraphs"
            @input="onParagraphs"
          />
        </label>
        <label class="li__field">
          <span class="li__label">Sentences / paragraph</span>
          <input
            type="number"
            class="li__input"
            min="1"
            max="20"
            :value="sentencesPerParagraph"
            @input="onSentences"
          />
        </label>
        <label class="li__field">
          <span class="li__label">Words / sentence</span>
          <input
            type="number"
            class="li__input"
            min="1"
            max="50"
            :value="wordsPerSentence"
            @input="onWords"
          />
        </label>
        <label class="li__field li__field--check">
          <input
            type="checkbox"
            class="li__checkbox"
            :checked="startWithClassic"
            @change="onClassic"
          />
          <span class="li__label">Start with classic opening</span>
        </label>
      </div>

      <button
        type="button"
        class="li__btn li__btn--primary"
        @click="generate"
      >
        <Sparkles :size="14" />
        <span>Regenerate</span>
      </button>
    </ToolInput>

    <ToolOutput
      title="Generated text"
      :description="`~${wordCount()} words`"
    >
      <div class="li__output-wrap">
        <textarea
          class="li__output"
          readonly
          spellcheck="false"
          :value="output"
          aria-label="Generated Lorem Ipsum text"
        ></textarea>
        <CopyButton
          :text="output"
          label="Copy"
          class="li__copy"
        />
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.li {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.li__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.li__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.li__field--check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.li__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.li__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.li__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.li__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.li__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--qt-radius-sm);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.li__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.li__btn--ghost:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.li__btn--primary {
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  color: var(--qt-accent-contrast, #fff);
}
.li__btn--primary:hover {
  opacity: 0.92;
}
.li__btn--primary:active {
  transform: translateY(1px);
}
.li__output-wrap {
  position: relative;
}
.li__output {
  width: 100%;
  min-height: 240px;
  resize: vertical;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  line-height: 1.6;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.li__output:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.li__copy {
  position: absolute;
  top: 8px;
  right: 8px;
}
</style>
