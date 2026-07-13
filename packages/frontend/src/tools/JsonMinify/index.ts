/**
 * JsonMinify tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * No external npm dependencies are required (uses only the JSON builtin +
 * TextEncoder). The component is lazy-loaded so the JsonMinify UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'json-minify',
  name: 'JSON minify',
  description: 'Minify JSON by removing all whitespace.',
  category: 'dev',
  icon: 'braces',
  keywords: ['json', 'minify', 'compress', 'compact', 'squeeze'],
  dependencies: [],
};

export {
  useJsonMinify,
  minifyJson,
  parseJsonInput,
  analyzeJson,
} from './useJsonMinify';
export type {
  JsonMinifyResult,
  JsonMinifyError,
  JsonMinifyOutputs,
  UseJsonMinifyReturn,
} from './useJsonMinify';

const JsonMinify = defineAsyncComponent(
  () => import('./JsonMinify.vue'),
);

export default JsonMinify;
