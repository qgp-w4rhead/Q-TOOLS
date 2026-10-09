/**
 * PercentageCalculator tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Three calculation modes:
 *   - "X is what % of Y"
 *   - "X% of Y is"
 *   - "% increase/decrease from X to Y"
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'percentage-calculator',
    name: 'Percentage calculator',
    description: 'Calculate percentages and changes.',
    category: 'math',
    icon: 'percent',
    keywords: ['percentage', 'percent', 'change'],
    dependencies: [],
  },
  () => import('./PercentageCalculator.vue'),
);

export { metadata };

export {
  usePercentageCalculator,
  parseNumber,
  computePercentOfTotal,
  computePercentValue,
  computePercentChange,
  formatNumber,
} from './usePercentageCalculator';
export type {
  PercentMode,
  PercentResult,
  UsePercentageCalculatorReturn,
} from './usePercentageCalculator';

export default component;
