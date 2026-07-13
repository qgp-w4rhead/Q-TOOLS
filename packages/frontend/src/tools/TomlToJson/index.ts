/**
 * TomlToJson tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `smol-toml` package is part of the initial bundle (per
 * `tech-stack.md`), so it is statically imported inside the composable.
 * The component itself is still lazy-loaded so the TomlToJson UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'toml-to-json',
  name: 'TOML to JSON',
  description: 'Convert TOML to JSON.',
  category: 'converter',
  icon: 'braces',
  keywords: ['toml', 'json', 'convert'],
  dependencies: ['smol-toml'],
};

export {
  useTomlToJson,
  tomlToJson,
  parseToml,
  DEFAULT_INDENT,
} from './useTomlToJson';
export type {
  JsonIndent,
  TomlToJsonResult,
  TomlParseError,
  TomlToJsonOutputs,
  UseTomlToJsonReturn,
} from './useTomlToJson';

const TomlToJson = defineAsyncComponent(
  () => import('./TomlToJson.vue'),
);

export default TomlToJson;
