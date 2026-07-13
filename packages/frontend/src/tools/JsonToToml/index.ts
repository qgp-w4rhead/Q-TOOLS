/**
 * JsonToToml tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The `smol-toml` package is part of the initial bundle (per
 * `tech-stack.md`), so it is statically imported inside the composable.
 * The component itself is still lazy-loaded so the JsonToToml UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'json-to-toml',
  name: 'JSON to TOML',
  description: 'Convert JSON to TOML.',
  category: 'converter',
  icon: 'braces',
  keywords: ['json', 'toml', 'convert'],
  dependencies: ['smol-toml'],
};

export {
  useJsonToToml,
  jsonToToml,
  parseJsonObject,
} from './useJsonToToml';
export type {
  JsonToTomlResult,
  JsonToTomlError,
  JsonToTomlOptions,
  JsonToTomlOutputs,
  UseJsonToTomlReturn,
} from './useJsonToToml';

const JsonToToml = defineAsyncComponent(
  () => import('./JsonToToml.vue'),
);

export default JsonToToml;
