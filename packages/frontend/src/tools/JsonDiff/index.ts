/**
 * JsonDiff tool module — exports the lazy-loaded component plus its metadata
 * and composable so the tool can be registered in the registry and routed
 * dynamically.
 *
 * The diff is computed by a hand-rolled recursive walker (no external
 * dependency — the milestone spec explicitly allows a custom implementation),
 * so this tool declares no npm dependencies and rides its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'json-diff',
  name: 'JSON diff',
  description: 'Compare two JSON documents and show differences.',
  category: 'web',
  icon: 'git-compare',
  keywords: ['json', 'diff', 'compare'],
  dependencies: [],
};

export {
  useJsonDiff,
  diffJson,
  parseJson,
  computeJsonDiff,
  deepEqualJson,
  formatJsonValue,
  formatDiffValue,
} from './useJsonDiff';
export type {
  DiffType,
  DiffEntry,
  JsonDiffError,
  DiffViewMode,
  JsonDiffResult,
  JsonDiffOutputs,
  UseJsonDiffReturn,
} from './useJsonDiff';

const JsonDiff = defineAsyncComponent(
  () => import('./JsonDiff.vue'),
);

export default JsonDiff;
