/**
 * JsonPrettify tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * No external npm dependencies are required (uses only the JSON builtin +
 * TextEncoder). The component is lazy-loaded so the JsonPrettify UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'json-prettify-and-format',
  name: 'JSON prettify and format',
  description: 'Pretty-print and format JSON with syntax highlighting.',
  category: 'dev',
  icon: 'braces',
  keywords: ['json', 'prettify', 'format', 'beautify', 'highlight'],
  dependencies: [],
};

export {
  useJsonPrettify,
  prettifyJson,
  parseJsonInput,
  highlightJson,
  analyzeJson,
  DEFAULT_INDENT,
} from './useJsonPrettify';
export type {
  JsonIndent,
  JsonPrettifyResult,
  JsonPrettifyError,
  JsonPrettifyOptions,
  JsonPrettifyOutputs,
  JsonTokenClass,
  UseJsonPrettifyReturn,
} from './useJsonPrettify';

const JsonPrettify = defineAsyncComponent(
  () => import('./JsonPrettify.vue'),
);

export default JsonPrettify;
