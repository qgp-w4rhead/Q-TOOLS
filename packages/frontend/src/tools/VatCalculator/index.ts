/**
 * VatCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'vat-calculator',
    name: 'VAT / Sales Tax Calculator',
    description: 'Add or remove VAT and sales tax at configurable rates.',
    category: 'finance',
    icon: 'receipt',
    keywords: ['vat', 'sales', 'tax', 'gst', 'add', 'remove', 'net', 'gross'],
    dependencies: [],
  },
  () => import('./VatCalculator.vue'),
);

export { metadata };

export {
  useVatCalculator,
  parseNumber,
  calculateVat,
  formatCurrency,
  VAT_PRESETS,
} from './useVatCalculator';
export type {
  VatMode,
  VatResult,
  UseVatCalculatorReturn,
} from './useVatCalculator';

export default component;
