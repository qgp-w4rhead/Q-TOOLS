/**
 * IncomeTaxCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'income-tax-calculator',
    name: 'Income Tax Bracket Calculator',
    description: 'Progressive income tax calculator with configurable tax brackets.',
    category: 'finance',
    icon: 'receipt',
    keywords: ['income', 'tax', 'bracket', 'progressive', 'marginal', 'deduction'],
    dependencies: [],
  },
  () => import('./IncomeTaxCalculator.vue'),
);

export { metadata };

export {
  useIncomeTaxCalculator,
  parseNumber,
  calculateIncomeTax,
  formatCurrency,
  formatPercent,
  DEFAULT_BRACKETS,
} from './useIncomeTaxCalculator';
export type {
  TaxBracket,
  BracketResult,
  IncomeTaxResult,
  UseIncomeTaxCalculatorReturn,
} from './useIncomeTaxCalculator';

export default component;
