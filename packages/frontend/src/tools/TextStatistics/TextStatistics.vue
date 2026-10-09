<script setup lang="ts">
/**
 * TextStatistics - compute comprehensive statistics about a body of text.
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
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useTextStatistics,
  formatDuration,
  type TextStats,
} from './useTextStatistics';

const { input, stats, reset } = useTextStatistics();

const { t } = useI18n();
const U = 'tools.text-statistics.ui.';

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
  { label: t(U + 'statCharacters'), value: String(s.characters) },
  { label: t(U + 'statCharactersNoSpaces'), value: String(s.charactersNoSpaces) },
  { label: t(U + 'statWords'), value: String(s.words) },
  { label: t(U + 'statSentences'), value: String(s.sentences) },
  { label: t(U + 'statParagraphs'), value: String(s.paragraphs) },
  { label: t(U + 'statLines'), value: String(s.lines) },
  {
    label: t(U + 'statAvgWordLength'),
    value: s.avgWordLength.toFixed(2),
    hint: t(U + 'hintCharacters'),
  },
  {
    label: t(U + 'statAvgSentenceLength'),
    value: s.avgSentenceLength.toFixed(2),
    hint: t(U + 'hintWords'),
  },
  {
    label: t(U + 'statReadingTime'),
    value: formatDuration(s.readingTimeMs),
    hint: t(U + 'hintWpm', { n: 200 }),
  },
  {
    label: t(U + 'statSpeakingTime'),
    value: formatDuration(s.speakingTimeMs),
    hint: t(U + 'hintWpm', { n: 130 }),
  },
];

const summary = (s: TextStats): string =>
  t(U + 'summary', { chars: s.characters, words: s.words, sentences: s.sentences, lines: s.lines });

const copyStats = (s: TextStats): string =>
  [
    `${t(U + 'statCharacters')}: ${s.characters}`,
    `${t(U + 'statCharactersNoSpaces')}: ${s.charactersNoSpaces}`,
    `${t(U + 'statWords')}: ${s.words}`,
    `${t(U + 'statSentences')}: ${s.sentences}`,
    `${t(U + 'statParagraphs')}: ${s.paragraphs}`,
    `${t(U + 'statLines')}: ${s.lines}`,
    `${t(U + 'statAvgWordLength')}: ${s.avgWordLength.toFixed(2)}`,
    `${t(U + 'statAvgSentenceLength')}: ${s.avgSentenceLength.toFixed(2)}`,
    `${t(U + 'statReadingTime')}: ${formatDuration(s.readingTimeMs)}`,
    `${t(U + 'statSpeakingTime')}: ${formatDuration(s.speakingTimeMs)}`,
  ].join('\n');
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'clearTitle')"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </template>

      <textarea
        class="qt-input"
        style="min-height:220px;line-height:1.6;padding:12px 14px"
        spellcheck="false"
        :placeholder="t(U + 'placeholder')"
        :value="draft"
        @input="onInput"
        :aria-label="t(U + 'ariaInput')"
      ></textarea>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="summary(stats)"
      :copy-text="copyStats(stats)"
      :copy-label="t(U + 'copyStats')"
    >
      <div class="qt-grid" style="--qt-grid-min:160px;--qt-grid-gap:10px">
        <div v-for="card in cards(stats)" :key="card.label" class="qt-result" style="padding:12px 14px">
          <span class="qt-stat-head">{{ card.label }}</span>
          <span style="font-size:22px;font-weight:700;color:var(--qt-text);font-variant-numeric:tabular-nums;line-height:1.2">{{ card.value }}</span>
          <span v-if="card.hint" class="qt-hint">{{ card.hint }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>
