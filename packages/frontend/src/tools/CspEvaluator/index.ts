/**
 * CspEvaluator tool module - exports the lazy-loaded component plus its
 * metadata and composable.
 *
 * Paste a Content-Security-Policy header → analysis of directives, missing
 * protections, unsafe-inline warnings.
 *
 * No external dependencies - pure string parsing.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'csp-evaluator',
    name: 'CSP Evaluator',
    description: 'Analyze Content-Security-Policy headers for missing protections and unsafe patterns.',
    category: 'security',
    icon: 'shield-check',
    keywords: ['csp', 'content-security-policy', 'evaluate', 'analyze', 'security', 'headers', 'xss'],
    dependencies: [],
  },
  () => import('./CspEvaluator.vue'),
);

export { metadata };

export {
  useCspEvaluator,
  evaluateCsp,
} from './useCspEvaluator';
export type {
  CspSeverity,
  CspFinding,
  CspDirective,
  CspEvaluation,
  UseCspEvaluatorReturn,
} from './useCspEvaluator';

export default component;
