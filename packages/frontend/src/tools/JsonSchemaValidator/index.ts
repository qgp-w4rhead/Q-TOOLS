/**
 * JsonSchemaValidator tool module — exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'json-schema-validator',
    name: 'JSON Schema Validator',
    description:
      'Validate JSON instance against a JSON Schema (draft 2020-12 / draft-7).',
    category: 'api',
    icon: 'check-check',
    keywords: ['json', 'schema', 'validate', 'validation', 'draft', 'json-schema', 'ajv', 'instance'],
    dependencies: [],
  },
  () => import('./JsonSchemaValidator.vue'),
);

export { metadata };

export {
  useJsonSchemaValidator,
  validateJsonSchema,
} from './useJsonSchemaValidator';
export type {
  ValidationError,
  ValidationOutcome,
  UseJsonSchemaValidatorReturn,
} from './useJsonSchemaValidator';

export default component;
