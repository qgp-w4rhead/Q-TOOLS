/**
 * CountryCodeLookup tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'country-code-lookup',
    name: 'Country Code Lookup',
    description:
      'ISO 3166-1 alpha-2 / alpha-3 / numeric code ↔ country name and flag emoji.',
    category: 'i18n',
    icon: 'globe',
    keywords: ['country', 'iso-3166', 'code', 'flag', 'alpha-2', 'alpha-3', 'i18n'],
    dependencies: [],
  },
  () => import('./CountryCodeLookup.vue'),
);

export { metadata };

export {
  useCountryCodeLookup,
  searchCountries,
  countryCodeToFlag,
  COUNTRIES,
} from './useCountryCodeLookup';
export type {
  CountryEntry,
  UseCountryCodeLookupReturn,
} from './useCountryCodeLookup';

export default component;
