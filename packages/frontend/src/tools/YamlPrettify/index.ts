/**
 * YamlPrettify tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * The only npm dependency is `yaml`, which is part of the initial bundle
 * per `tech-stack.md` (statically imported by the composable). The
 * component itself is lazy-loaded so the YamlPrettify UI lands in its own
 * Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'yaml-prettify-and-format',
  name: 'YAML prettify and format',
  description: 'Pretty-print and format YAML with syntax highlighting.',
  category: 'dev',
  icon: 'braces',
  keywords: ['yaml', 'prettify', 'format', 'beautify', 'highlight'],
  dependencies: ['yaml'],
};

export {
  useYamlPrettify,
  prettifyYaml,
  parseYamlDocuments,
  highlightYaml,
  analyzeYaml,
  DEFAULT_INDENT,
} from './useYamlPrettify';
export type {
  YamlIndent,
  YamlPrettifyResult,
  YamlPrettifyError,
  YamlPrettifyOptions,
  YamlPrettifyOutputs,
  YamlTokenClass,
  UseYamlPrettifyReturn,
} from './useYamlPrettify';

const YamlPrettify = defineAsyncComponent(
  () => import('./YamlPrettify.vue'),
);

export default YamlPrettify;
