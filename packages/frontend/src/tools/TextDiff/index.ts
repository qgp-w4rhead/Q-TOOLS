/**
 * TextDiff tool module — exports the lazy-loaded component plus its metadata
 * and composable so the tool can be registered in the registry and routed
 * dynamically.
 *
 * The diff is computed by the lazy-loaded `diff` package (JsDiff), which lands
 * in its own Vite chunk (~20 KB) and is cached after first use. Supports
 * character, word, line and sentence granularity; inline, side-by-side and
 * unified-patch output views; ignore-case and ignore-whitespace options.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'text-diff',
  name: 'Text diff',
  description:
    'Compare two text blocks with char/word/line/sentence diff. Inline, side-by-side and unified-patch views.',
  category: 'text',
  icon: 'git-compare',
  keywords: ['text', 'diff', 'compare', 'patch', 'unified', 'side-by-side'],
  dependencies: ['diff'],
};

export {
  useTextDiff,
  loadDiff,
  resetDiffCache,
  runDiff,
  computeDiff,
  buildUnifiedPatch,
  formatInlineHtml,
  buildSideBySide,
  summarizeChanges,
  escapeHtml,
  byteLength,
} from './useTextDiff';
export type {
  DiffGranularity,
  DiffViewMode,
  DiffChange,
  SideBySideRow,
  DiffCounts,
  DiffOptions,
  TextDiffResult,
  TextDiffOutputs,
  UseTextDiffReturn,
} from './useTextDiff';

const TextDiff = defineAsyncComponent(() => import('./TextDiff.vue'));

export default TextDiff;
