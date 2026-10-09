/**
 * MockResponseGenerator tool module — exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'mock-response-generator',
    name: 'API Mock Response Generator',
    description:
      'Generate mock JSON from schema, template, or faker-style patterns.',
    category: 'api',
    icon: 'braces',
    keywords: ['mock', 'response', 'generate', 'fake', 'schema', 'template', 'faker', 'json', 'api'],
    dependencies: [],
  },
  () => import('./MockResponseGenerator.vue'),
);

export { metadata };

export {
  useMockResponseGenerator,
  generateMock,
} from './useMockResponseGenerator';
export type {
  GenerationMode,
  MockConfig,
  MockResult,
  UseMockResponseGeneratorReturn,
} from './useMockResponseGenerator';

export default component;
