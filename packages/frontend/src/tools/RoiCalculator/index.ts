/**
 * RoiCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'roi-calculator',
    name: 'ROI Calculator',
    description: 'Calculate return on investment percentage, annualized return, and gain or loss.',
    category: 'finance',
    icon: 'trending-up',
    keywords: ['roi', 'return', 'investment', 'annualized', 'gain', 'loss', 'profit'],
    dependencies: [],
  },
  () => import('./RoiCalculator.vue'),
);

export { metadata };

export {
  useRoiCalculator,
  parseNumber,
  calculateRoi,
  formatCurrency,
  formatPercent,
} from './useRoiCalculator';
export type {
  RoiResult,
  UseRoiCalculatorReturn,
} from './useRoiCalculator';

export default component;
