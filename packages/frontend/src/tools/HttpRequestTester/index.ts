/**
 * HttpRequestTester tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'http-request-tester',
    name: 'HTTP Request Tester',
    description:
      'Method/URL/headers/body → fetch → response (status, headers, timing, body).',
    category: 'api',
    icon: 'send',
    keywords: ['http', 'request', 'fetch', 'api', 'response', 'tester', 'rest'],
    dependencies: [],
  },
  () => import('./HttpRequestTester.vue'),
);

export { metadata };

export {
  useHttpRequestTester,
  executeRequest,
} from './useHttpRequestTester';
export type {
  HttpMethod,
  RequestConfig,
  ResponseData,
  UseHttpRequestTesterReturn,
} from './useHttpRequestTester';

export default component;
