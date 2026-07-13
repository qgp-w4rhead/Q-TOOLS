/**
 * YamlToToml tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Both `yaml` and `smol-toml` are part of the initial bundle (per
 * `tech-stack.md`), so they are statically imported inside the composable.
 * The component itself is still lazy-loaded so the YamlToToml UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'yaml-to-toml',
  name: 'YAML to TOML',
  description: 'Convert YAML documents to TOML.',
  category: 'converter',
  icon: 'braces',
  keywords: ['yaml', 'toml', 'convert'],
  dependencies: ['yaml', 'smol-toml'],
};

export {
  useYamlToToml,
  yamlToToml,
  parseYamlObject,
} from './useYamlToToml';
export type {
  YamlToTomlResult,
  YamlToTomlError,
  YamlToTomlOutputs,
  UseYamlToTomlReturn,
} from './useYamlToToml';

const YamlToToml = defineAsyncComponent(
  () => import('./YamlToToml.vue'),
);

export default YamlToToml;
