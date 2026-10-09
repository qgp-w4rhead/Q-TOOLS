/**
 * WhatXWord tool module.
 *
 * Fully self-contained three-word coordinate encoder.
 * No external API needed — word lists generated deterministically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'whatxword-encoder',
  name: 'WhatXWord Encoder',
  description: 'Encode/decode lat/lon ↔ three-word addresses. Fully offline with 80K+ word list and multiple word packs.',
  category: 'geo',
  icon: 'map-pin',
  keywords: ['whatxword', 'w3w', 'three', 'word', 'address', 'lat', 'lon', 'geocode', 'offline', 'encode', 'decode'],
  dependencies: [],
};

export {
  useWhatXWord,
  encodeWhatXWord,
  decodeWhatXWord,
  isValidWhatXWord,
  getWordCount,
  suggestClosestWords,
  detectInputType,
} from './useWhatXWord';
export type {
  WhatXWordMode,
  WordPack,
  WhatXWordResult,
  WordSuggestion,
  DetectedInputType,
  UseWhatXWordReturn,
} from './useWhatXWord';

const WhatXWord = defineAsyncComponent(
  () => import('./WhatXWord.vue'),
);

export default WhatXWord;
