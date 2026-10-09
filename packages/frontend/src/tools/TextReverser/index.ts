/**
 * TextReverser tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Reverse text by characters, words, or lines with optional preserve-case
 * and trim options.
 *
 * No external dependencies - pure string manipulation only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'text-reverser',
  name: 'Text reverser',
  description: 'Reverse text by characters, words, or lines.',
  category: 'text',
  icon: 'flip-horizontal',
  keywords: ['text', 'reverse', 'flip', 'backwards', 'characters', 'words', 'lines'],
  dependencies: [],
};

export {
  useTextReverser,
  reverseText,
} from './useTextReverser';
export type {
  ReverseMode,
  UseTextReverserReturn,
} from './useTextReverser';

const TextReverser = defineAsyncComponent(
  () => import('./TextReverser.vue'),
);

export default TextReverser;
