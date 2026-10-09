/**
 * useCurrencyCodeLookup - composable + data for ISO 4217 currency code lookup.
 *
 * Provides bidirectional search between ISO 4217 currency codes and currency
 * names, symbols, and decimal places.
 *
 * No external dependencies - uses a bundled subset of the ISO 4217 standard.
 */
import { ref, computed, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface CurrencyEntry {
  code: string;
  number: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export interface UseCurrencyCodeLookupReturn {
  query: Ref<string>;
  results: Ref<CurrencyEntry[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Data - ISO 4217 currency codes                                             */
/* -------------------------------------------------------------------------- */

export const CURRENCIES: CurrencyEntry[] = [
  { code: 'AED', number: '784', name: 'UAE Dirham', symbol: 'د.إ', decimalPlaces: 2 },
  { code: 'AFN', number: '971', name: 'Afghan Afghani', symbol: '؋', decimalPlaces: 2 },
  { code: 'ALL', number: '008', name: 'Albanian Lek', symbol: 'L', decimalPlaces: 2 },
  { code: 'AMD', number: '051', name: 'Armenian Dram', symbol: '֏', decimalPlaces: 2 },
  { code: 'ANG', number: '532', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', decimalPlaces: 2 },
  { code: 'AOA', number: '973', name: 'Angolan Kwanza', symbol: 'Kz', decimalPlaces: 2 },
  { code: 'ARS', number: '032', name: 'Argentine Peso', symbol: '$', decimalPlaces: 2 },
  { code: 'AUD', number: '036', name: 'Australian Dollar', symbol: 'A$', decimalPlaces: 2 },
  { code: 'AWG', number: '533', name: 'Aruban Florin', symbol: 'ƒ', decimalPlaces: 2 },
  { code: 'AZN', number: '944', name: 'Azerbaijani Manat', symbol: '₼', decimalPlaces: 2 },
  { code: 'BAM', number: '977', name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM', decimalPlaces: 2 },
  { code: 'BBD', number: '052', name: 'Barbadian Dollar', symbol: 'Bds$', decimalPlaces: 2 },
  { code: 'BDT', number: '050', name: 'Bangladeshi Taka', symbol: '৳', decimalPlaces: 2 },
  { code: 'BGN', number: '975', name: 'Bulgarian Lev', symbol: 'лв', decimalPlaces: 2 },
  { code: 'BHD', number: '048', name: 'Bahraini Dinar', symbol: 'د.ب', decimalPlaces: 3 },
  { code: 'BIF', number: '108', name: 'Burundian Franc', symbol: 'FBu', decimalPlaces: 0 },
  { code: 'BMD', number: '060', name: 'Bermudian Dollar', symbol: 'BD$', decimalPlaces: 2 },
  { code: 'BND', number: '096', name: 'Brunei Dollar', symbol: 'B$', decimalPlaces: 2 },
  { code: 'BOB', number: '068', name: 'Bolivian Boliviano', symbol: 'Bs', decimalPlaces: 2 },
  { code: 'BRL', number: '986', name: 'Brazilian Real', symbol: 'R$', decimalPlaces: 2 },
  { code: 'BSD', number: '044', name: 'Bahamian Dollar', symbol: 'B$', decimalPlaces: 2 },
  { code: 'BTN', number: '064', name: 'Bhutanese Ngultrum', symbol: 'Nu', decimalPlaces: 2 },
  { code: 'BWP', number: '072', name: 'Botswana Pula', symbol: 'P', decimalPlaces: 2 },
  { code: 'BYN', number: '933', name: 'Belarusian Ruble', symbol: 'Br', decimalPlaces: 2 },
  { code: 'BZD', number: '084', name: 'Belize Dollar', symbol: 'BZ$', decimalPlaces: 2 },
  { code: 'CAD', number: '124', name: 'Canadian Dollar', symbol: 'C$', decimalPlaces: 2 },
  { code: 'CDF', number: '976', name: 'Congolese Franc', symbol: 'FC', decimalPlaces: 2 },
  { code: 'CHF', number: '756', name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2 },
  { code: 'CLF', number: '990', name: 'Unidad de Fomento', symbol: 'UF', decimalPlaces: 4 },
  { code: 'CLP', number: '152', name: 'Chilean Peso', symbol: 'CLP$', decimalPlaces: 0 },
  { code: 'CNY', number: '156', name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2 },
  { code: 'COP', number: '170', name: 'Colombian Peso', symbol: 'CO$', decimalPlaces: 2 },
  { code: 'CRC', number: '188', name: 'Costa Rican Colón', symbol: '₡', decimalPlaces: 2 },
  { code: 'CUP', number: '192', name: 'Cuban Peso', symbol: '₱', decimalPlaces: 2 },
  { code: 'CVE', number: '132', name: 'Cape Verdean Escudo', symbol: '$', decimalPlaces: 2 },
  { code: 'CZK', number: '203', name: 'Czech Koruna', symbol: 'Kč', decimalPlaces: 2 },
  { code: 'DJF', number: '262', name: 'Djiboutian Franc', symbol: 'Fdj', decimalPlaces: 0 },
  { code: 'DKK', number: '208', name: 'Danish Krone', symbol: 'kr', decimalPlaces: 2 },
  { code: 'DOP', number: '214', name: 'Dominican Peso', symbol: 'RD$', decimalPlaces: 2 },
  { code: 'DZD', number: '012', name: 'Algerian Dinar', symbol: 'دج', decimalPlaces: 2 },
  { code: 'EGP', number: '818', name: 'Egyptian Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'ERN', number: '232', name: 'Eritrean Nakfa', symbol: 'Nfk', decimalPlaces: 2 },
  { code: 'ETB', number: '230', name: 'Ethiopian Birr', symbol: 'Br', decimalPlaces: 2 },
  { code: 'EUR', number: '978', name: 'Euro', symbol: '€', decimalPlaces: 2 },
  { code: 'FJD', number: '242', name: 'Fijian Dollar', symbol: 'FJ$', decimalPlaces: 2 },
  { code: 'FKP', number: '238', name: 'Falkland Islands Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'GBP', number: '826', name: 'Pound Sterling', symbol: '£', decimalPlaces: 2 },
  { code: 'GEL', number: '981', name: 'Georgian Lari', symbol: '₾', decimalPlaces: 2 },
  { code: 'GHS', number: '936', name: 'Ghanaian Cedi', symbol: '₵', decimalPlaces: 2 },
  { code: 'GIP', number: '292', name: 'Gibraltar Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'GMD', number: '270', name: 'Gambian Dalasi', symbol: 'D', decimalPlaces: 2 },
  { code: 'GNF', number: '324', name: 'Guinean Franc', symbol: 'FG', decimalPlaces: 0 },
  { code: 'GTQ', number: '320', name: 'Guatemalan Quetzal', symbol: 'Q', decimalPlaces: 2 },
  { code: 'GYD', number: '328', name: 'Guyanese Dollar', symbol: 'G$', decimalPlaces: 2 },
  { code: 'HKD', number: '344', name: 'Hong Kong Dollar', symbol: 'HK$', decimalPlaces: 2 },
  { code: 'HNL', number: '340', name: 'Honduran Lempira', symbol: 'L', decimalPlaces: 2 },
  { code: 'HRK', number: '191', name: 'Croatian Kuna', symbol: 'kn', decimalPlaces: 2 },
  { code: 'HTG', number: '332', name: 'Haitian Gourde', symbol: 'G', decimalPlaces: 2 },
  { code: 'HUF', number: '348', name: 'Hungarian Forint', symbol: 'Ft', decimalPlaces: 2 },
  { code: 'IDR', number: '360', name: 'Indonesian Rupiah', symbol: 'Rp', decimalPlaces: 2 },
  { code: 'ILS', number: '376', name: 'Israeli New Shekel', symbol: '₪', decimalPlaces: 2 },
  { code: 'INR', number: '356', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
  { code: 'IQD', number: '368', name: 'Iraqi Dinar', symbol: 'ع.د', decimalPlaces: 3 },
  { code: 'IRR', number: '364', name: 'Iranian Rial', symbol: '﷼', decimalPlaces: 2 },
  { code: 'ISK', number: '352', name: 'Icelandic Króna', symbol: 'kr', decimalPlaces: 0 },
  { code: 'JMD', number: '388', name: 'Jamaican Dollar', symbol: 'J$', decimalPlaces: 2 },
  { code: 'JOD', number: '400', name: 'Jordanian Dinar', symbol: 'د.ا', decimalPlaces: 3 },
  { code: 'JPY', number: '392', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
  { code: 'KES', number: '404', name: 'Kenyan Shilling', symbol: 'KSh', decimalPlaces: 2 },
  { code: 'KGS', number: '417', name: 'Kyrgyzstani Som', symbol: 'с', decimalPlaces: 2 },
  { code: 'KHR', number: '116', name: 'Cambodian Riel', symbol: '៛', decimalPlaces: 2 },
  { code: 'KMF', number: '174', name: 'Comorian Franc', symbol: 'CF', decimalPlaces: 0 },
  { code: 'KPW', number: '408', name: 'North Korean Won', symbol: '₩', decimalPlaces: 2 },
  { code: 'KRW', number: '410', name: 'South Korean Won', symbol: '₩', decimalPlaces: 0 },
  { code: 'KWD', number: '414', name: 'Kuwaiti Dinar', symbol: 'د.ك', decimalPlaces: 3 },
  { code: 'KYD', number: '136', name: 'Cayman Islands Dollar', symbol: 'KY$', decimalPlaces: 2 },
  { code: 'KZT', number: '398', name: 'Kazakhstani Tenge', symbol: '₸', decimalPlaces: 2 },
  { code: 'LAK', number: '418', name: 'Lao Kip', symbol: '₭', decimalPlaces: 2 },
  { code: 'LBP', number: '422', name: 'Lebanese Pound', symbol: 'ل.ل', decimalPlaces: 2 },
  { code: 'LKR', number: '144', name: 'Sri Lankan Rupee', symbol: 'Rs', decimalPlaces: 2 },
  { code: 'LRD', number: '430', name: 'Liberian Dollar', symbol: 'L$', decimalPlaces: 2 },
  { code: 'LSL', number: '426', name: 'Lesotho Loti', symbol: 'M', decimalPlaces: 2 },
  { code: 'LYD', number: '434', name: 'Libyan Dinar', symbol: 'ل.د', decimalPlaces: 3 },
  { code: 'MAD', number: '504', name: 'Moroccan Dirham', symbol: 'د.م', decimalPlaces: 2 },
  { code: 'MDL', number: '498', name: 'Moldovan Leu', symbol: 'L', decimalPlaces: 2 },
  { code: 'MGA', number: '969', name: 'Malagasy Ariary', symbol: 'Ar', decimalPlaces: 2 },
  { code: 'MKD', number: '807', name: 'Macedonian Denar', symbol: 'ден', decimalPlaces: 2 },
  { code: 'MMK', number: '104', name: 'Burmese Kyat', symbol: 'K', decimalPlaces: 2 },
  { code: 'MNT', number: '496', name: 'Mongolian Tögrög', symbol: '₮', decimalPlaces: 2 },
  { code: 'MOP', number: '446', name: 'Macanese Pataca', symbol: 'MOP$', decimalPlaces: 2 },
  { code: 'MRU', number: '929', name: 'Mauritanian Ouguiya', symbol: 'UM', decimalPlaces: 2 },
  { code: 'MUR', number: '480', name: 'Mauritian Rupee', symbol: '₨', decimalPlaces: 2 },
  { code: 'MVR', number: '462', name: 'Maldivian Rufiyaa', symbol: 'Rf', decimalPlaces: 2 },
  { code: 'MWK', number: '454', name: 'Malawian Kwacha', symbol: 'MK', decimalPlaces: 2 },
  { code: 'MXN', number: '484', name: 'Mexican Peso', symbol: 'MX$', decimalPlaces: 2 },
  { code: 'MYR', number: '458', name: 'Malaysian Ringgit', symbol: 'RM', decimalPlaces: 2 },
  { code: 'MZN', number: '943', name: 'Mozambican Metical', symbol: 'MT', decimalPlaces: 2 },
  { code: 'NAD', number: '516', name: 'Namibian Dollar', symbol: 'N$', decimalPlaces: 2 },
  { code: 'NGN', number: '566', name: 'Nigerian Naira', symbol: '₦', decimalPlaces: 2 },
  { code: 'NIO', number: '558', name: 'Nicaraguan Córdoba', symbol: 'C$', decimalPlaces: 2 },
  { code: 'NOK', number: '578', name: 'Norwegian Krone', symbol: 'kr', decimalPlaces: 2 },
  { code: 'NPR', number: '524', name: 'Nepalese Rupee', symbol: '₨', decimalPlaces: 2 },
  { code: 'NZD', number: '554', name: 'New Zealand Dollar', symbol: 'NZ$', decimalPlaces: 2 },
  { code: 'OMR', number: '512', name: 'Omani Rial', symbol: 'ر.ع', decimalPlaces: 3 },
  { code: 'PAB', number: '590', name: 'Panamanian Balboa', symbol: 'B/.', decimalPlaces: 2 },
  { code: 'PEN', number: '604', name: 'Peruvian Sol', symbol: 'S/', decimalPlaces: 2 },
  { code: 'PGK', number: '598', name: 'Papua New Guinean Kina', symbol: 'K', decimalPlaces: 2 },
  { code: 'PHP', number: '608', name: 'Philippine Peso', symbol: '₱', decimalPlaces: 2 },
  { code: 'PKR', number: '586', name: 'Pakistani Rupee', symbol: '₨', decimalPlaces: 2 },
  { code: 'PLN', number: '985', name: 'Polish Złoty', symbol: 'zł', decimalPlaces: 2 },
  { code: 'PYG', number: '600', name: 'Paraguayan Guaraní', symbol: '₲', decimalPlaces: 0 },
  { code: 'QAR', number: '634', name: 'Qatari Riyal', symbol: 'ر.ق', decimalPlaces: 2 },
  { code: 'RON', number: '946', name: 'Romanian Leu', symbol: 'lei', decimalPlaces: 2 },
  { code: 'RSD', number: '941', name: 'Serbian Dinar', symbol: 'дин', decimalPlaces: 2 },
  { code: 'RUB', number: '643', name: 'Russian Ruble', symbol: '₽', decimalPlaces: 2 },
  { code: 'RWF', number: '646', name: 'Rwandan Franc', symbol: 'FRw', decimalPlaces: 0 },
  { code: 'SAR', number: '682', name: 'Saudi Riyal', symbol: '﷼', decimalPlaces: 2 },
  { code: 'SBD', number: '090', name: 'Solomon Islands Dollar', symbol: 'SI$', decimalPlaces: 2 },
  { code: 'SCR', number: '690', name: 'Seychellois Rupee', symbol: '₨', decimalPlaces: 2 },
  { code: 'SDG', number: '938', name: 'Sudanese Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'SEK', number: '752', name: 'Swedish Krona', symbol: 'kr', decimalPlaces: 2 },
  { code: 'SGD', number: '702', name: 'Singapore Dollar', symbol: 'S$', decimalPlaces: 2 },
  { code: 'SHP', number: '654', name: 'Saint Helena Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'SLL', number: '694', name: 'Sierra Leonean Leone', symbol: 'Le', decimalPlaces: 2 },
  { code: 'SOS', number: '706', name: 'Somali Shilling', symbol: 'Sh', decimalPlaces: 2 },
  { code: 'SRD', number: '968', name: 'Surinamese Dollar', symbol: 'Sr$', decimalPlaces: 2 },
  { code: 'SSP', number: '728', name: 'South Sudanese Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'STN', number: '930', name: 'São Tomé and Príncipe Dobra', symbol: 'Db', decimalPlaces: 2 },
  { code: 'SVC', number: '222', name: 'Salvadoran Colón', symbol: '₡', decimalPlaces: 2 },
  { code: 'SYP', number: '760', name: 'Syrian Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'SZL', number: '748', name: 'Eswatini Lilangeni', symbol: 'E', decimalPlaces: 2 },
  { code: 'THB', number: '764', name: 'Thai Baht', symbol: '฿', decimalPlaces: 2 },
  { code: 'TJS', number: '972', name: 'Tajikistani Somoni', symbol: 'ЅМ', decimalPlaces: 2 },
  { code: 'TMT', number: '934', name: 'Turkmenistani Manat', symbol: 'm', decimalPlaces: 2 },
  { code: 'TND', number: '788', name: 'Tunisian Dinar', symbol: 'د.ت', decimalPlaces: 3 },
  { code: 'TOP', number: '776', name: 'Tongan Paʻanga', symbol: 'T$', decimalPlaces: 2 },
  { code: 'TRY', number: '949', name: 'Turkish Lira', symbol: '₺', decimalPlaces: 2 },
  { code: 'TTD', number: '780', name: 'Trinidad and Tobago Dollar', symbol: 'TT$', decimalPlaces: 2 },
  { code: 'TWD', number: '901', name: 'New Taiwan Dollar', symbol: 'NT$', decimalPlaces: 2 },
  { code: 'TZS', number: '834', name: 'Tanzanian Shilling', symbol: 'TSh', decimalPlaces: 2 },
  { code: 'UAH', number: '980', name: 'Ukrainian Hryvnia', symbol: '₴', decimalPlaces: 2 },
  { code: 'UGX', number: '800', name: 'Ugandan Shilling', symbol: 'USh', decimalPlaces: 0 },
  { code: 'USD', number: '840', name: 'United States Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'UYU', number: '858', name: 'Uruguayan Peso', symbol: '$U', decimalPlaces: 2 },
  { code: 'UZS', number: '860', name: 'Uzbekistani Som', symbol: 'сўм', decimalPlaces: 2 },
  { code: 'VES', number: '928', name: 'Venezuelan Bolívar', symbol: 'Bs', decimalPlaces: 2 },
  { code: 'VND', number: '704', name: 'Vietnamese Đồng', symbol: '₫', decimalPlaces: 0 },
  { code: 'VUV', number: '548', name: 'Vanuatu Vatu', symbol: 'VT', decimalPlaces: 0 },
  { code: 'WST', number: '882', name: 'Samoan Tala', symbol: 'WS$', decimalPlaces: 2 },
  { code: 'XAF', number: '950', name: 'Central African CFA Franc', symbol: 'FCFA', decimalPlaces: 0 },
  { code: 'XCD', number: '951', name: 'East Caribbean Dollar', symbol: 'EC$', decimalPlaces: 2 },
  { code: 'XOF', number: '952', name: 'West African CFA Franc', symbol: 'CFA', decimalPlaces: 0 },
  { code: 'XPF', number: '953', name: 'CFP Franc', symbol: '₣', decimalPlaces: 0 },
  { code: 'YER', number: '886', name: 'Yemeni Rial', symbol: '﷼', decimalPlaces: 2 },
  { code: 'ZAR', number: '710', name: 'South African Rand', symbol: 'R', decimalPlaces: 2 },
  { code: 'ZMW', number: '967', name: 'Zambian Kwacha', symbol: 'ZK', decimalPlaces: 2 },
  { code: 'ZWL', number: '932', name: 'Zimbabwean Dollar', symbol: 'Z$', decimalPlaces: 2 },
];

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

/** Search currencies by code, number, or name (case-insensitive). */
export function searchCurrencies(query: string): CurrencyEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return CURRENCIES;
  return CURRENCIES.filter((c) => {
    return (
      c.code.toLowerCase().includes(q) ||
      c.number.includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useCurrencyCodeLookup(): UseCurrencyCodeLookupReturn {
  const query = ref<string>('');
  const results = computed(() => searchCurrencies(query.value)) as unknown as Ref<CurrencyEntry[]>;

  function reset(): void {
    query.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
    },
    output: results,
    toOutput: () => ({ results: results.value }),
  });

  return {
    query,
    results,
    isEmbed,
    embedInput,
    reset,
  };
}
