/**
 * TextToUnicode tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'text-to-unicode',
  name: 'Text to Unicode',
  description: 'Convert text to \\uXXXX Unicode escape sequences and back, with code point / UTF-8 / UTF-16 analysis.',
  category: 'converter',
  icon: 'languages',
  keywords: ['unicode', 'codepoint', 'text', 'utf8', 'utf16', 'escape', 'surrogate'],
  dependencies: [],
};

export {
  useTextToUnicode,
  encodeUnicodeEscapes,
  decodeUnicodeEscapes,
  toCodePointHex,
  iterCodePoints,
  analyzeChars,
  DEFAULT_MODE,
  DEFAULT_PREFIX,
} from './useTextToUnicode';
export type {
  UnicodeMode,
  TextToUnicodeOutputs,
  UnicodeAnalysis,
  CharBreakdownRow,
  UseTextToUnicodeReturn,
} from './useTextToUnicode';

const TextToUnicode = defineAsyncComponent(
  () => import('./TextToUnicode.vue'),
);

export default TextToUnicode;
