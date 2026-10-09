/**
 * InvoiceGenerator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'invoice-generator',
    name: 'Invoice Generator',
    description: 'Create formatted invoices from line items with totals, tax, and discounts.',
    category: 'finance',
    icon: 'file-text',
    keywords: ['invoice', 'bill', 'receipt', 'line-item', 'subtotal', 'tax', 'discount'],
    dependencies: [],
  },
  () => import('./InvoiceGenerator.vue'),
);

export { metadata };

export {
  useInvoiceGenerator,
  parseNumber,
  calculateTotals,
  generateInvoiceHTML,
  formatCurrency,
} from './useInvoiceGenerator';
export type {
  InvoiceLineItem,
  InvoiceData,
  InvoiceTotals,
  UseInvoiceGeneratorReturn,
} from './useInvoiceGenerator';

export default component;
