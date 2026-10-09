/**
 * CurlCommandBuilder tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'curl-command-builder',
    name: 'cURL Command Builder',
    description:
      'Visual form → cURL command; reverse: paste cURL → parsed fields.',
    category: 'api',
    icon: 'terminal',
    keywords: ['curl', 'command', 'http', 'request', 'build', 'parse', 'cli'],
    dependencies: [],
  },
  () => import('./CurlCommandBuilder.vue'),
);

export { metadata };

export {
  useCurlCommandBuilder,
  buildCurlCommand,
  parseCurlCommand,
} from './useCurlCommandBuilder';
export type {
  HttpMethod,
  CurlField,
  ParsedCurl,
  UseCurlCommandBuilderReturn,
} from './useCurlCommandBuilder';

export default component;
