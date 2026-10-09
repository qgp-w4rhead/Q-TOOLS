/**
 * TextSorter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Sort lines of text by various criteria: alphabetical, numeric, length,
 * with ascending/descending and case-sensitive/insensitive options.
 *
 * No external dependencies - pure string manipulation only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'text-sorter',
  name: 'Text sorter',
  description: 'Sort lines of text alphabetically, numerically, or by length.',
  category: 'text',
  icon: 'arrow-down-narrow-wide',
  keywords: ['text', 'sort', 'order', 'alphabetical', 'numeric', 'length', 'lines', 'ascending', 'descending'],
  dependencies: [],
};

export {
  useTextSorter,
  sortLines,
} from './useTextSorter';
export type {
  SortMode,
  UseTextSorterReturn,
} from './useTextSorter';

const TextSorter = defineAsyncComponent(
  () => import('./TextSorter.vue'),
);

export default TextSorter;
