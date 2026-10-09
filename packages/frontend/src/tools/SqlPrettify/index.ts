/**
 * SqlPrettify tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The heavy lifting is done by `sql-formatter` (lazy-loaded inside the
 * composable), which lands in its own Vite chunk (~50 KB) and is cached
 * after first use.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'sql-prettify-and-format',
  name: 'SQL prettify and format',
  description: 'Pretty-print and format SQL queries (standard, MySQL, PostgreSQL, T-SQL).',
  category: 'dev',
  icon: 'database',
  keywords: ['sql', 'prettify', 'format', 'beautify', 'mysql', 'postgresql', 'tsql'],
  dependencies: ['sql-formatter'],
};

export {
  useSqlPrettify,
  formatSql,
  loadSqlFormatter,
  normaliseError,
  DEFAULT_LANGUAGE,
  DEFAULT_INDENT,
  DEFAULT_KEYWORD_CASE,
  DEFAULT_LINES_BETWEEN_QUERIES,
  DEFAULT_NEWLINE_BEFORE_SEMICOLON,
} from './useSqlPrettify';
export type {
  SqlLanguage,
  SqlIndent,
  SqlKeywordCase,
  SqlLinesBetweenQueries,
  SqlPrettifyOptions,
  SqlPrettifyResult,
  SqlPrettifyError,
  SqlPrettifyOutputs,
  UseSqlPrettifyReturn,
} from './useSqlPrettify';

const SqlPrettify = defineAsyncComponent(
  () => import('./SqlPrettify.vue'),
);

export default SqlPrettify;
