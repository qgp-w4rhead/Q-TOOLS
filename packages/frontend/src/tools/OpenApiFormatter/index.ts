/**
 * OpenApiFormatter tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'openapi-spec-formatter',
    name: 'OpenAPI Spec Formatter',
    description:
      'Pretty-print / validate OpenAPI 3.x JSON/YAML with error reporting.',
    category: 'api',
    icon: 'file-code',
    keywords: ['openapi', 'swagger', 'spec', 'format', 'validate', 'json', 'yaml', 'api'],
    dependencies: [],
  },
  () => import('./OpenApiFormatter.vue'),
);

export { metadata };

export {
  useOpenApiFormatter,
  validateOpenApi,
} from './useOpenApiFormatter';
export type {
  InputFormat,
  ValidationResult,
  UseOpenApiFormatterReturn,
} from './useOpenApiFormatter';

export default component;
