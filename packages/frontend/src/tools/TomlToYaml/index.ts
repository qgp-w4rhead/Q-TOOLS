/**
 * TomlToYaml tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `smol-toml` and `yaml` packages are part of the initial bundle (per
 * `tech-stack.md`), so they are statically imported inside the composable.
 * The component itself is still lazy-loaded so the TomlToYaml UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'toml-to-yaml',
  name: 'TOML to YAML',
  description: 'Convert TOML to YAML.',
  category: 'converter',
  icon: 'braces',
  keywords: ['toml', 'yaml', 'convert'],
  dependencies: ['smol-toml', 'yaml'],
};

export {
  useTomlToYaml,
  tomlToYaml,
  parseToml,
  normalizeForYaml,
  DEFAULT_INDENT,
} from './useTomlToYaml';
export type {
  YamlIndent,
  TomlToYamlResult,
  TomlToYamlError,
  TomlToYamlOptions,
  TomlToYamlOutputs,
  UseTomlToYamlReturn,
} from './useTomlToYaml';

const TomlToYaml = defineAsyncComponent(
  () => import('./TomlToYaml.vue'),
);

export default TomlToYaml;
