/**
 * TipCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'tip-calculator',
    name: 'Tip Calculator',
    description: 'Calculate tip amounts and per-person totals from bill, tip percentage, and party size.',
    category: 'finance',
    icon: 'banknote',
    keywords: ['tip', 'gratuity', 'bill', 'split', 'restaurant', 'party'],
    dependencies: [],
  },
  () => import('./TipCalculator.vue'),
);

export { metadata };

export {
  useTipCalculator,
  parseNumber,
  calculateTip,
  formatCurrency,
  TIP_PRESETS,
} from './useTipCalculator';
export type {
  TipResult,
  UseTipCalculatorReturn,
} from './useTipCalculator';

export default component;
