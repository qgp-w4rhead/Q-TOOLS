/**
 * CurrencyConverter tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'currency-converter',
    name: 'Currency Converter',
    description: 'Convert between currencies using static rates or live API-fed exchange rates.',
    category: 'finance',
    icon: 'banknote',
    keywords: ['currency', 'convert', 'exchange', 'rate', 'forex', 'money'],
    dependencies: [],
  },
  () => import('./CurrencyConverter.vue'),
);

export { metadata };

export {
  useCurrencyConverter,
  parseNumber,
  convertCurrency,
  buildRateTable,
  formatCurrency,
  DEFAULT_RATES,
} from './useCurrencyConverter';
export type {
  CurrencyRate,
  ConversionResult,
  RateTableRow,
  UseCurrencyConverterReturn,
} from './useCurrencyConverter';

export default component;
