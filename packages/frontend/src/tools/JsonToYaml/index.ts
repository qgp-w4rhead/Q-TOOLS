/**
 * JsonToYaml tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `yaml` package is part of the initial bundle (per `tech-stack.md`),
 * so it is statically imported inside the composable. The component itself
 * is still lazy-loaded so the JsonToYaml UI lands in its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'json-to-yaml',
  name: 'JSON to YAML',
  description: 'Convert JSON to YAML documents.',
  category: 'converter',
  icon: 'braces',
  keywords: ['json', 'yaml', 'convert'],
  dependencies: ['yaml'],
};

export {
  useJsonToYaml,
  jsonToYaml,
  parseJsonInput,
  DEFAULT_INDENT,
} from './useJsonToYaml';
export type {
  YamlIndent,
  JsonToYamlResult,
  JsonToYamlError,
  JsonToYamlOptions,
  JsonToYamlOutputs,
  UseJsonToYamlReturn,
} from './useJsonToYaml';

const JsonToYaml = defineAsyncComponent(
  () => import('./JsonToYaml.vue'),
);

export default JsonToYaml;
