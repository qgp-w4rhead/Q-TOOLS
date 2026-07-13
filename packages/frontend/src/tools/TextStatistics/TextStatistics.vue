<script setup lang="ts">
/**
 * TextStatistics — compute comprehensive statistics about a body of text.
 *
 * Type or paste text into the input area; the statistics panel updates live
 * (debounced). Statistics include character counts (with and without spaces),
 * word/sentence/paragraph/line counts, average word and sentence length, and
 * estimated reading + speaking times.
 *
 * Works in embed mode: receives `input` PostMessages to set the text and
 * sends `output` PostMessages with the computed statistics.
 */
import { ref } from 'vue';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useTextStatistics,
  formatDuration,
  type TextStats,
} from './useTextStatistics';

const { input, stats, reset } = useTextStatistics();

// Debounce the recompute so typing stays responsive. The composable watches
// `input` directly; we just buffer the textarea value and flush on a timer.
const draft = ref<string>(input.value);
let timer: ReturnType<typeof setTimeout> | null = null;

function onInput(e: Event): void {
  draft.value = (e.target as HTMLTextAreaElement).value;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    input.value = draft.value;
  }, 150);
}

function onReset(): void {
  if (timer) clearTimeout(timer);
  reset();
  draft.value = '';
}

interface StatCard {
  label: string;
  value: string;
  hint?: string;
}

const cards = (s: TextStats): StatCard[] => [
  { label: 'Characters', value: String(s.characters) },
  { label: 'Characters (no spaces)', value: String(s.charactersNoSpaces) },
  { label: 'Words', value: String(s.words) },
  { label: 'Sentences', value: String(s.sentences) },
  { label: 'Paragraphs', value: String(s.paragraphs) },
  { label: 'Lines', value: String(s.lines) },
  {
    label: 'Avg. word length',
    value: s.avgWordLength.toFixed(2),
    hint: 'characters',
  },
  {
    label: 'Avg. sentence length',
    value: s.avgSentenceLength.toFixed(2),
    hint: 'words',
  },
  {
    label: 'Reading time',
    value: formatDuration(s.readingTimeMs),
    hint: '@ 200 wpm',
  },
  {
    label: 'Speaking time',
    value: formatDuration(s.speakingTimeMs),
    hint: '@ 130 wpm',
  },
];

const summary = (s: TextStats): string =>
  `${s.characters} chars · ${s.words} words · ${s.sentences} sentences · ${s.lines} lines`;

const copyStats = (s: TextStats): string =>
  [
    `Characters: ${s.characters}`,
    `Characters (no spaces): ${s.charactersNoSpaces}`,
    `Words: ${s.words}`,
    `Sentences: ${s.sentences}`,
    `Paragraphs: ${s.paragraphs}`,
    `Lines: ${s.lines}`,
    `Avg. word length: ${s.avgWordLength.toFixed(2)}`,
    `Avg. sentence length: ${s.avgSentenceLength.toFixed(2)}`,
    `Reading time: ${formatDuration(s.readingTimeMs)}`,
    `Speaking time: ${formatDuration(s.speakingTimeMs)}`,
  ].join('\n');
</script>

<template>
  <div class="ts">
    <ToolInput
      title="Input"
      description="Type or paste text. Statistics update live."
    >
      <template #actions>
        <button
          type="button"
          class="ts__btn ts__btn--ghost"
          title="Clear input"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>Clear</span>
        </button>
      </template>

      <textarea
        class="ts__input"
        spellcheck="false"
        placeholder="Start typing…"
        :value="draft"
        @input="onInput"
        aria-label="Text to analyse"
      ></textarea>
    </ToolInput>

    <ToolOutput
      title="Statistics"
      :description="summary(stats)"
      :copy-text="copyStats(stats)"
      copy-label="Copy stats"
    >
      <div class="ts__grid">
        <div v-for="card in cards(stats)" :key="card.label" class="ts__card">
          <span class="ts__card-label">{{ card.label }}</span>
          <span class="ts__card-value">{{ card.value }}</span>
          <span v-if="card.hint" class="ts__card-hint">{{ card.hint }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ts {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ts__input {
  width: 100%;
  min-height: 220px;
  resize: vertical;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.ts__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ts__btn {
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
.ts__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.ts__btn--ghost:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.ts__btn--ghost:active {
  transform: translateY(1px);
}
.ts__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.ts__card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 12px 14px;
}
.ts__card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ts__card-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.ts__card-hint {
  font-size: 11.5px;
  color: var(--qt-muted);
}
</style>
