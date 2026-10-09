/**
 * CompoundInterestCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'compound-interest-calculator',
    name: 'Compound Interest Calculator',
    description: 'Calculate final amount and interest earned with configurable compounding frequency.',
    category: 'finance',
    icon: 'banknote',
    keywords: ['compound', 'interest', 'principal', 'rate', 'compounding', 'investment'],
    dependencies: [],
  },
  () => import('./CompoundInterestCalculator.vue'),
);

export { metadata };

export {
  useCompoundInterestCalculator,
  parseNumber,
  calculateCompoundInterest,
  formatCurrency,
} from './useCompoundInterestCalculator';
export type {
  CompoundingFrequency,
  ContributionFrequency,
  CompoundInterestResult,
  UseCompoundInterestCalculatorReturn,
} from './useCompoundInterestCalculator';

export default component;
