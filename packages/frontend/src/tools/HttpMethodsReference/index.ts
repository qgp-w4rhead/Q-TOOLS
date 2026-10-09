/**
 * HttpMethodsReference tool module — exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'http-methods-reference',
    name: 'HTTP Methods Reference',
    description:
      'Searchable reference for HTTP methods (GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD/TRACE) with safe/idempotent badges.',
    category: 'api',
    icon: 'book-open',
    keywords: ['http', 'method', 'get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace', 'connect', 'reference', 'safe', 'idempotent'],
    dependencies: [],
  },
  () => import('./HttpMethodsReference.vue'),
);

export { metadata };

export {
  useHttpMethodsReference,
  searchMethods,
  HTTP_METHODS,
} from './useHttpMethodsReference';
export type {
  HttpMethodInfo,
  UseHttpMethodsReferenceReturn,
} from './useHttpMethodsReference';

export default component;
