/**
 * RegexCheatsheet tool module — exports the lazy-loaded component plus its
 * metadata, composable, pure helpers, and the bundled syntax database so
 * the tool can be registered in the registry and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'regex-cheatsheet',
  name: 'Regex cheatsheet',
  description: 'Quick reference for regular expression syntax.',
  category: 'dev',
  icon: 'regex',
  keywords: ['regex', 'cheatsheet', 'reference', 'regexp', 'syntax'],
  dependencies: [],
};

export {
  useRegexCheatsheet,
  filterByCategory,
  searchEntries,
  queryEntries,
} from './useRegexCheatsheet';
export type {
  CategoryFilter,
  SearchResult,
  UseRegexCheatsheetReturn,
} from './useRegexCheatsheet';

export {
  REGEX_CHEATSHEET_ENTRIES,
  REGEX_CHEATSHEET_CATEGORIES,
  REGEX_CHEATSHEET_CATEGORY_LABELS,
  REGEX_CHEATSHEET_COUNTS,
  REGEX_CHEATSHEET_TOTAL,
  REGEX_CHEATSHEET_SIZE_BYTES,
} from './regexCheatsheetDatabase';
export type {
  RegexCheatsheetCategory,
  RegexCheatsheetEntry,
} from './regexCheatsheetDatabase';

const RegexCheatsheet = defineAsyncComponent(
  () => import('./RegexCheatsheet.vue'),
);

export default RegexCheatsheet;
