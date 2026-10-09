/**
 * ApiKeyGenerator tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'api-key-generator',
    name: 'API Key Generator',
    description:
      'Generate API keys with configurable prefix, entropy, format (hex/base64/base32), and checksum.',
    category: 'api',
    icon: 'key-round',
    keywords: ['api', 'key', 'generate', 'token', 'secret', 'hex', 'base64', 'base32', 'checksum', 'entropy'],
    dependencies: [],
  },
  () => import('./ApiKeyGenerator.vue'),
);

export { metadata };

export {
  useApiKeyGenerator,
  generateApiKey,
  generateMultipleKeys,
} from './useApiKeyGenerator';
export type {
  KeyFormat,
  ApiKeyConfig,
  UseApiKeyGeneratorReturn,
} from './useApiKeyGenerator';

export default component;
