/**
 * MimeTypes tool module — exports the lazy-loaded component plus its
 * metadata, composable, pure helpers, and the bundled MIME database so the
 * tool can be registered in the registry and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'mime-types',
  name: 'MIME types',
  description: 'Look up MIME types for file extensions and vice versa.',
  category: 'web',
  icon: 'file',
  keywords: ['mime', 'type', 'extension', 'content-type'],
  dependencies: [],
};

export {
  useMimeTypes,
  normalizeExtension,
  normalizeMimeType,
  detectQueryKind,
  lookupByExtension,
  lookupByMimeType,
  searchMimeTypes,
  searchMimeTypesFull,
} from './useMimeTypes';
export type {
  QueryKind,
  ExtensionLookupResult,
  MimeLookupResult,
  SearchHit,
  LookupResult,
  UseMimeTypesReturn,
} from './useMimeTypes';

export {
  MIME_ENTRIES,
  MIME_BY_EXTENSION,
  EXTENSIONS_BY_MIME,
  ENTRY_BY_EXTENSION,
  ENTRY_BY_MIME,
  ALL_MIME_TYPES,
  ALL_EXTENSIONS,
  DATABASE_SIZE_BYTES,
} from './mimeDatabase';
export type { MimeEntry, MimeCategory } from './mimeDatabase';

const MimeTypes = defineAsyncComponent(() => import('./MimeTypes.vue'));

export default MimeTypes;
