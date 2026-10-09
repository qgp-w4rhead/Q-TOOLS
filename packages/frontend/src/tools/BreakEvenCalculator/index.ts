/**
 * BreakEvenCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'break-even-calculator',
    name: 'Break-Even Calculator',
    description: 'Calculate the break-even point from fixed costs, variable cost per unit, and price per unit.',
    category: 'finance',
    icon: 'scale',
    keywords: ['break-even', 'breakeven', 'fixed', 'variable', 'cost', 'price', 'units'],
    dependencies: [],
  },
  () => import('./BreakEvenCalculator.vue'),
);

export { metadata };

export {
  useBreakEvenCalculator,
  parseNumber,
  calculateBreakEven,
  formatCurrency,
  formatNumber,
  formatPercent,
} from './useBreakEvenCalculator';
export type {
  BreakEvenResult,
  UseBreakEvenCalculatorReturn,
} from './useBreakEvenCalculator';

export default component;
