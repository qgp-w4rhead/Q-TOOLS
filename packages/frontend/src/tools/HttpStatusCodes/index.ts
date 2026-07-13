/**
 * HttpStatusCodes tool module — exports the lazy-loaded component plus its
 * metadata, composable, pure helpers, and the bundled HTTP status database
 * so the tool can be registered in the registry and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'http-status-codes',
  name: 'HTTP status codes',
  description: 'Searchable reference for HTTP status codes (1xx-5xx) with descriptions.',
  category: 'web',
  icon: 'server',
  keywords: ['http', 'status', 'code', 'response', 'error', 'rest', 'api'],
  dependencies: [],
};

export {
  useHttpStatusCodes,
  getStatusByCode,
  filterByCategory,
  searchStatusCodes,
  queryStatusCodes,
} from './useHttpStatusCodes';
export type {
  CategoryFilter,
  SearchResult,
  UseHttpStatusCodesReturn,
} from './useHttpStatusCodes';

export {
  HTTP_STATUS_ENTRIES,
  HTTP_STATUS_BY_CODE,
  HTTP_STATUS_CATEGORIES,
  HTTP_STATUS_COUNTS,
  categoryFromCode,
  DATABASE_SIZE_BYTES,
} from './httpStatusDatabase';
export type {
  HttpStatusEntry,
  HttpStatusCategory,
} from './httpStatusDatabase';

const HttpStatusCodes = defineAsyncComponent(
  () => import('./HttpStatusCodes.vue'),
);

export default HttpStatusCodes;
