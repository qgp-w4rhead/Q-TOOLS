/**
 * LoanCalculator tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'loan-calculator',
    name: 'Loan / Mortgage Calculator',
    description: 'Calculate monthly payments and generate an amortization schedule from principal, rate, and term.',
    category: 'finance',
    icon: 'banknote',
    keywords: ['loan', 'mortgage', 'amortization', 'principal', 'interest', 'monthly', 'payment'],
    dependencies: [],
  },
  () => import('./LoanCalculator.vue'),
);

export { metadata };

export {
  useLoanCalculator,
  parseNumber,
  calculateLoan,
  formatCurrency,
  formatNumber,
} from './useLoanCalculator';
export type {
  TermUnit,
  AmortizationRow,
  LoanResult,
  UseLoanCalculatorReturn,
} from './useLoanCalculator';

export default component;
