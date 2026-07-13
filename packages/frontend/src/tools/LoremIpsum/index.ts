/**
 * LoremIpsum tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Generates Lorem Ipsum placeholder text from a bundled word pool with
 * configurable paragraphs, sentences per paragraph, words per sentence,
 * and an optional classic "Lorem ipsum dolor sit amet" opening.
 *
 * No external dependencies — pure logic + `crypto.getRandomValues`.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'lorem-ipsum-generator',
  name: 'Lorem ipsum generator',
  description: 'Generate Lorem Ipsum placeholder text with configurable paragraphs, sentences, and words.',
  category: 'text',
  icon: 'align-left',
  keywords: ['lorem', 'ipsum', 'placeholder', 'text', 'filler', 'dummy'],
  dependencies: [],
};

export {
  useLoremIpsum,
  generateLorem,
  generateParagraph,
  generateSentence,
  pickWord,
  randomInt,
  clampInt,
  WORD_POOL,
  CLASSIC_OPENING,
} from './useLoremIpsum';
export type {
  LoremOptions,
  UseLoremIpsumReturn,
} from './useLoremIpsum';

const LoremIpsum = defineAsyncComponent(
  () => import('./LoremIpsum.vue'),
);

export default LoremIpsum;
