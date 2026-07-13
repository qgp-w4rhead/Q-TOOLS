/**
 * GitCheatsheet tool module — exports the lazy-loaded component plus its
 * metadata, composable, pure helpers, and the bundled command database so
 * the tool can be registered in the registry and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'git-cheatsheet',
  name: 'Git cheatsheet',
  description: 'Searchable reference for common Git commands.',
  category: 'dev',
  icon: 'git-branch',
  keywords: ['git', 'cheatsheet', 'reference', 'commands', 'vcs'],
  dependencies: [],
};

export {
  useGitCheatsheet,
  filterByCategory,
  searchCommands,
  queryCommands,
} from './useGitCheatsheet';
export type {
  CategoryFilter,
  SearchResult,
  UseGitCheatsheetReturn,
} from './useGitCheatsheet';

export {
  GIT_CHEATSHEET_ENTRIES,
  GIT_CHEATSHEET_CATEGORIES,
  GIT_CHEATSHEET_CATEGORY_LABELS,
  GIT_CHEATSHEET_COUNTS,
  GIT_CHEATSHEET_TOTAL,
  DATABASE_SIZE_BYTES,
} from './gitCheatsheetDatabase';
export type {
  GitCheatsheetCategory,
  GitCheatsheetEntry,
} from './gitCheatsheetDatabase';

const GitCheatsheet = defineAsyncComponent(
  () => import('./GitCheatsheet.vue'),
);

export default GitCheatsheet;
