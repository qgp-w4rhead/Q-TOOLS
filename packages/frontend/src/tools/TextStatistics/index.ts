/**
 * TextStatistics tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Computes comprehensive text statistics: character counts (with and without
 * spaces), word/sentence/paragraph/line counts, average word and sentence
 * length, and estimated reading + speaking times.
 *
 * No external dependencies - pure string arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'text-statistics',
  name: 'Text statistics',
  description:
    'Count characters, words, sentences, paragraphs, lines, average lengths, and estimate reading + speaking time.',
  category: 'text',
  icon: 'bar-chart',
  keywords: [
    'text', 'statistics', 'count', 'words', 'characters', 'sentences',
    'paragraphs', 'lines', 'reading', 'speaking', 'time',
  ],
  dependencies: [],
};

export {
  useTextStatistics,
  computeStats,
  countCharacters,
  countCharactersNoSpaces,
  countWords,
  countSentences,
  countParagraphs,
  countLines,
  averageWordLength,
  averageSentenceLength,
  readingTimeMs,
  speakingTimeMs,
  formatDuration,
  READING_WPM,
  SPEAKING_WPM,
} from './useTextStatistics';
export type {
  TextStats,
  UseTextStatisticsReturn,
} from './useTextStatistics';

const TextStatistics = defineAsyncComponent(
  () => import('./TextStatistics.vue'),
);

export default TextStatistics;
