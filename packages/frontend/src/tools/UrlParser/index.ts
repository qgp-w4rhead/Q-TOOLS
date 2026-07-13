/**
 * UrlParser tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'url-parser',
  name: 'URL parser',
  description: 'Parse URLs into their components and rebuild them.',
  category: 'web',
  icon: 'link',
  keywords: ['url', 'parse', 'origin', 'query', 'hostname', 'protocol'],
  dependencies: [],
};

export {
  useUrlParser,
  parseUrl,
  buildUrl,
  parseQueryParams,
  serializeQueryParams,
  normalizeUrlInput,
} from './useUrlParser';
export type {
  QueryParam,
  ParsedUrl,
  ParseResult,
  UrlParserOutputs,
  UseUrlParserReturn,
} from './useUrlParser';

const UrlParser = defineAsyncComponent(
  () => import('./UrlParser.vue'),
);

export default UrlParser;
