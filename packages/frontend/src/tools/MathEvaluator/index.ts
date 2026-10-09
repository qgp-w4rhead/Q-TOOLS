/**
 * MathEvaluator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 *
 * The heavy lifting is done by `expr-eval` (lazy-loaded inside the
 * composable), which lands in its own Vite chunk (~15 KB) and is cached after
 * first use. The expression is **never** passed through `eval()`.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'math-evaluator',
    name: 'Math evaluator',
    description: 'Safely evaluate math expressions (no eval).',
    category: 'math',
    icon: 'calculator',
    keywords: ['math', 'evaluate', 'expression', 'expr-eval', 'calculator'],
    dependencies: ['expr-eval'],
  },
  () => import('./MathEvaluator.vue'),
);

export { metadata };

export {
  useMathEvaluator,
  evaluateExpression,
  formatResult,
  loadExprEval,
  normaliseError,
  addHistory,
  MAX_HISTORY,
} from './useMathEvaluator';
export type {
  MathResult,
  MathError,
  MathOutcome,
  MathHistoryEntry,
} from './useMathEvaluator';

export default component;
