/**
 * DepreciationCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'depreciation-calculator',
    name: 'Depreciation Calculator',
    description: 'Straight-line, declining-balance, and sum-of-years-digits depreciation schedules.',
    category: 'finance',
    icon: 'trending-down',
    keywords: ['depreciation', 'straight-line', 'declining-balance', 'sum-of-years', 'asset', 'schedule'],
    dependencies: [],
  },
  () => import('./DepreciationCalculator.vue'),
);

export { metadata };

export {
  useDepreciationCalculator,
  parseNumber,
  calculateDepreciation,
  formatCurrency,
} from './useDepreciationCalculator';
export type {
  DepreciationMethod,
  DepreciationRow,
  DepreciationResult,
  UseDepreciationCalculatorReturn,
} from './useDepreciationCalculator';

export default component;
