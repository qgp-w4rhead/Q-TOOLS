/**
 * YamlToJson tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `yaml` package is part of the initial bundle (per `tech-stack.md`),
 * so it is statically imported inside the composable. The component itself
 * is still lazy-loaded so the YamlToJson UI lands in its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'yaml-to-json',
  name: 'YAML to JSON',
  description: 'Convert YAML documents to JSON.',
  category: 'converter',
  icon: 'braces',
  keywords: ['yaml', 'json', 'convert'],
  dependencies: ['yaml'],
};

export {
  useYamlToJson,
  yamlToJson,
  parseYamlDocuments,
  DEFAULT_INDENT,
} from './useYamlToJson';
export type {
  JsonIndent,
  YamlToJsonResult,
  YamlParseError,
  YamlToJsonOutputs,
  UseYamlToJsonReturn,
} from './useYamlToJson';

const YamlToJson = defineAsyncComponent(
  () => import('./YamlToJson.vue'),
);

export default YamlToJson;
