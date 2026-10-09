/**
 * RomanNumeralConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'roman-numeral-converter',
  name: 'Roman numeral converter',
  description: 'Convert between Roman numerals and integers (1-3999).',
  category: 'converter',
  icon: 'hash',
  keywords: ['roman', 'numeral', 'integer'],
  dependencies: [],
};

export {
  useRomanNumeralConverter,
  romanToInt,
  intToRoman,
  parseRoman,
  normalizeRoman,
  validateRoman,
  validateInt,
  isValidRoman,
  isValidInt,
  MIN_VALUE,
  MAX_VALUE,
  DEFAULT_MODE,
} from './useRomanNumeralConverter';
export type {
  RomanMode,
  RomanNumeralConverterOutputs,
  UseRomanNumeralConverterReturn,
} from './useRomanNumeralConverter';

const RomanNumeralConverter = defineAsyncComponent(
  () => import('./RomanNumeralConverter.vue'),
);

export default RomanNumeralConverter;
