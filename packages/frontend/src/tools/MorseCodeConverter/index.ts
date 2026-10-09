/**
 * MorseCodeConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'morse-code-converter',
    name: 'Morse Code Converter',
    description: 'Bidirectional text ↔ Morse code (ITU standard).',
    category: 'cipher',
    icon: 'radio',
    keywords: ['morse', 'code', 'itu', 'telegraph', 'dot', 'dash', 'encode', 'decode'],
    dependencies: [],
  },
  () => import('./MorseCodeConverter.vue'),
);

export { metadata };

export {
  useMorseCodeConverter,
  textToMorse,
  morseToText,
  MORSE_CODE_MAP,
  MORSE_DECODE_MAP,
  DEFAULT_LETTER_SEPARATOR,
  DEFAULT_WORD_SEPARATOR,
} from './useMorseCodeConverter';
export type { MorseMode, UseMorseCodeConverterReturn } from './useMorseCodeConverter';

export default component;
