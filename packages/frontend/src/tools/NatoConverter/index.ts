/**
 * NatoConverter tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'text-to-nato',
  name: 'Text to NATO alphabet',
  description: 'Spell text using the NATO phonetic alphabet (Alpha, Bravo, Charlie, …).',
  category: 'converter',
  icon: 'languages',
  keywords: ['nato', 'phonetic', 'alphabet', 'spell', 'radio', 'itu'],
  dependencies: [],
};

export {
  useNatoConverter,
  NATO_ALPHABET,
  NATO_DIGITS,
  natoWordFor,
  toNato,
  toNatoRows,
} from './useNato';
export type { NatoRow, UseNatoConverterReturn } from './useNato';

const NatoConverter = defineAsyncComponent(
  () => import('./NatoConverter.vue'),
);

export default NatoConverter;
