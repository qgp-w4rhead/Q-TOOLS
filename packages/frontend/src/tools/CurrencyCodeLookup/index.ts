/**
 * CurrencyCodeLookup tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'currency-code-lookup',
    name: 'Currency Code Lookup',
    description:
      'ISO 4217 code ↔ currency name, symbol, decimal places, and search.',
    category: 'i18n',
    icon: 'banknote',
    keywords: ['currency', 'iso-4217', 'code', 'symbol', 'lookup', 'i18n'],
    dependencies: [],
  },
  () => import('./CurrencyCodeLookup.vue'),
);

export { metadata };

export {
  useCurrencyCodeLookup,
  searchCurrencies,
  CURRENCIES,
} from './useCurrencyCodeLookup';
export type {
  CurrencyEntry,
  UseCurrencyCodeLookupReturn,
} from './useCurrencyCodeLookup';

export default component;
