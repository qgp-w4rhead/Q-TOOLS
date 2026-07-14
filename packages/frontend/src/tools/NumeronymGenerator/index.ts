/**
 * NumeronymGenerator tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 *
 * Generates numeronyms from a word or phrase: the first and last letters are
 * kept and the middle is replaced with the count of omitted letters (e.g.
 * "internationalization" → "i18n"). Words shorter than a configurable minimum
 * are left verbatim; non-word separators are preserved; an optional toggle
 * controls whether the first/last letters keep their original case.
 *
 * No external dependencies — pure string arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'numeronym-generator',
  name: 'Numeronym generator',
  description:
    'Generate numeronyms from words or phrases (e.g. internationalization → i18n). Configurable minimum word length and case preservation.',
  category: 'text',
  icon: 'hash',
  keywords: [
    'numeronym', 'i18n', 'l10n', 'a11y', 'abbreviation', 'acronym',
    'shorten', 'compress', 'word', 'phrase',
  ],
  dependencies: [],
};

export {
  useNumeronymGenerator,
  toNumeronym,
  generateNumeronyms,
  tokenizeNumeronyms,
  clampInt,
  DEFAULT_MIN_LENGTH,
  MIN_LENGTH_FLOOR,
  MIN_LENGTH_CEIL,
} from './useNumeronymGenerator';
export type {
  NumeronymOptions,
  NumeronymToken,
  UseNumeronymGeneratorReturn,
} from './useNumeronymGenerator';

const NumeronymGenerator = defineAsyncComponent(
  () => import('./NumeronymGenerator.vue'),
);

export default NumeronymGenerator;
