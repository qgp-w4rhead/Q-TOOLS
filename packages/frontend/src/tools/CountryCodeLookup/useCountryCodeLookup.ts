/**
 * useCountryCodeLookup - composable + data for ISO 3166-1 country code lookup.
 *
 * Provides bidirectional search between ISO 3166-1 alpha-2, alpha-3, numeric
 * codes and country names with flag emojis.
 *
 * No external dependencies.
 */
import { ref, computed, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface CountryEntry {
  alpha2: string;
  alpha3: string;
  numeric: string;
  name: string;
  flag: string;
}

export interface UseCountryCodeLookupReturn {
  query: Ref<string>;
  results: Ref<CountryEntry[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

/** Convert a 2-letter country code to a flag emoji. */
export function countryCodeToFlag(alpha2: string): string {
  if (alpha2.length !== 2) return '';
  const A = 0x1f1e6;
  const chars = alpha2.toUpperCase().split('').map((c) => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...chars);
}

/* -------------------------------------------------------------------------- */
/* Data - ISO 3166-1 country codes                                            */
/* -------------------------------------------------------------------------- */

function ce(alpha2: string, alpha3: string, numeric: string, name: string): CountryEntry {
  return { alpha2, alpha3, numeric, name, flag: countryCodeToFlag(alpha2) };
}

export const COUNTRIES: CountryEntry[] = [
  ce('AD', 'AND', '020', 'Andorra'), ce('AE', 'ARE', '784', 'United Arab Emirates'),
  ce('AF', 'AFG', '004', 'Afghanistan'), ce('AG', 'ATG', '028', 'Antigua and Barbuda'),
  ce('AI', 'AIA', '660', 'Anguilla'), ce('AL', 'ALB', '008', 'Albania'),
  ce('AM', 'ARM', '051', 'Armenia'), ce('AO', 'AGO', '024', 'Angola'),
  ce('AR', 'ARG', '032', 'Argentina'), ce('AT', 'AUT', '040', 'Austria'),
  ce('AU', 'AUS', '036', 'Australia'), ce('AW', 'ABW', '533', 'Aruba'),
  ce('AZ', 'AZE', '031', 'Azerbaijan'), ce('BA', 'BIH', '070', 'Bosnia and Herzegovina'),
  ce('BB', 'BRB', '052', 'Barbados'), ce('BD', 'BGD', '050', 'Bangladesh'),
  ce('BE', 'BEL', '056', 'Belgium'), ce('BF', 'BFA', '854', 'Burkina Faso'),
  ce('BG', 'BGR', '100', 'Bulgaria'), ce('BH', 'BHR', '048', 'Bahrain'),
  ce('BI', 'BDI', '108', 'Burundi'), ce('BJ', 'BEN', '204', 'Benin'),
  ce('BN', 'BRN', '096', 'Brunei Darussalam'), ce('BO', 'BOL', '068', 'Bolivia'),
  ce('BR', 'BRA', '076', 'Brazil'), ce('BS', 'BHS', '044', 'Bahamas'),
  ce('BT', 'BTN', '064', 'Bhutan'), ce('BW', 'BWA', '072', 'Botswana'),
  ce('BY', 'BLR', '112', 'Belarus'), ce('BZ', 'BLZ', '084', 'Belize'),
  ce('CA', 'CAN', '124', 'Canada'), ce('CD', 'COD', '180', 'DR of the Congo'),
  ce('CF', 'CAF', '140', 'Central African Republic'), ce('CG', 'COG', '178', 'Congo'),
  ce('CH', 'CHE', '756', 'Switzerland'), ce('CI', 'CIV', '384', 'Côte d\'Ivoire'),
  ce('CL', 'CHL', '152', 'Chile'), ce('CM', 'CMR', '120', 'Cameroon'),
  ce('CN', 'CHN', '156', 'China'), ce('CO', 'COL', '170', 'Colombia'),
  ce('CR', 'CRI', '188', 'Costa Rica'), ce('CU', 'CUB', '192', 'Cuba'),
  ce('CV', 'CPV', '132', 'Cabo Verde'), ce('CY', 'CYP', '196', 'Cyprus'),
  ce('CZ', 'CZE', '203', 'Czechia'), ce('DE', 'DEU', '276', 'Germany'),
  ce('DJ', 'DJI', '262', 'Djibouti'), ce('DK', 'DNK', '208', 'Denmark'),
  ce('DM', 'DMA', '212', 'Dominica'), ce('DO', 'DOM', '214', 'Dominican Republic'),
  ce('DZ', 'DZA', '012', 'Algeria'), ce('EC', 'ECU', '218', 'Ecuador'),
  ce('EE', 'EST', '233', 'Estonia'), ce('EG', 'EGY', '818', 'Egypt'),
  ce('ER', 'ERI', '232', 'Eritrea'), ce('ES', 'ESP', '724', 'Spain'),
  ce('ET', 'ETH', '231', 'Ethiopia'), ce('FI', 'FIN', '246', 'Finland'),
  ce('FJ', 'FJI', '242', 'Fiji'), ce('FR', 'FRA', '250', 'France'),
  ce('GA', 'GAB', '266', 'Gabon'), ce('GB', 'GBR', '826', 'United Kingdom'),
  ce('GD', 'GRD', '308', 'Grenada'), ce('GE', 'GEO', '268', 'Georgia'),
  ce('GH', 'GHA', '288', 'Ghana'), ce('GM', 'GMB', '270', 'Gambia'),
  ce('GN', 'GIN', '324', 'Guinea'), ce('GQ', 'GNQ', '226', 'Equatorial Guinea'),
  ce('GR', 'GRC', '300', 'Greece'), ce('GT', 'GTM', '320', 'Guatemala'),
  ce('GW', 'GNB', '624', 'Guinea-Bissau'), ce('GY', 'GUY', '328', 'Guyana'),
  ce('HK', 'HKG', '344', 'Hong Kong'), ce('HN', 'HND', '340', 'Honduras'),
  ce('HR', 'HRV', '191', 'Croatia'), ce('HT', 'HTI', '332', 'Haiti'),
  ce('HU', 'HUN', '348', 'Hungary'), ce('ID', 'IDN', '360', 'Indonesia'),
  ce('IE', 'IRL', '372', 'Ireland'), ce('IL', 'ISR', '376', 'Israel'),
  ce('IN', 'IND', '356', 'India'), ce('IQ', 'IRQ', '368', 'Iraq'),
  ce('IR', 'IRN', '364', 'Iran'), ce('IS', 'ISL', '352', 'Iceland'),
  ce('IT', 'ITA', '380', 'Italy'), ce('JM', 'JAM', '388', 'Jamaica'),
  ce('JO', 'JOR', '400', 'Jordan'), ce('JP', 'JPN', '392', 'Japan'),
  ce('KE', 'KEN', '404', 'Kenya'), ce('KG', 'KGZ', '417', 'Kyrgyzstan'),
  ce('KH', 'KHM', '116', 'Cambodia'), ce('KI', 'KIR', '296', 'Kiribati'),
  ce('KM', 'COM', '174', 'Comoros'), ce('KN', 'KNA', '659', 'Saint Kitts and Nevis'),
  ce('KP', 'PRK', '408', 'North Korea'), ce('KR', 'KOR', '410', 'South Korea'),
  ce('KW', 'KWT', '414', 'Kuwait'), ce('KZ', 'KAZ', '398', 'Kazakhstan'),
  ce('LA', 'LAO', '418', 'Laos'), ce('LB', 'LBN', '422', 'Lebanon'),
  ce('LC', 'LCA', '662', 'Saint Lucia'), ce('LI', 'LIE', '438', 'Liechtenstein'),
  ce('LK', 'LKA', '144', 'Sri Lanka'), ce('LR', 'LBR', '430', 'Liberia'),
  ce('LS', 'LSO', '426', 'Lesotho'), ce('LT', 'LTU', '440', 'Lithuania'),
  ce('LU', 'LUX', '442', 'Luxembourg'), ce('LV', 'LVA', '428', 'Latvia'),
  ce('LY', 'LBY', '434', 'Libya'), ce('MA', 'MAR', '504', 'Morocco'),
  ce('MC', 'MCO', '492', 'Monaco'), ce('MD', 'MDA', '498', 'Moldova'),
  ce('ME', 'MNE', '499', 'Montenegro'), ce('MG', 'MDG', '450', 'Madagascar'),
  ce('MK', 'MKD', '807', 'North Macedonia'), ce('ML', 'MLI', '466', 'Mali'),
  ce('MM', 'MMR', '104', 'Myanmar'), ce('MN', 'MNG', '496', 'Mongolia'),
  ce('MR', 'MRT', '478', 'Mauritania'), ce('MT', 'MLT', '470', 'Malta'),
  ce('MU', 'MUS', '480', 'Mauritius'), ce('MV', 'MDV', '462', 'Maldives'),
  ce('MW', 'MWI', '454', 'Malawi'), ce('MX', 'MEX', '484', 'Mexico'),
  ce('MY', 'MYS', '458', 'Malaysia'), ce('MZ', 'MOZ', '508', 'Mozambique'),
  ce('NA', 'NAM', '516', 'Namibia'), ce('NE', 'NER', '562', 'Niger'),
  ce('NG', 'NGA', '566', 'Nigeria'), ce('NI', 'NIC', '558', 'Nicaragua'),
  ce('NL', 'NLD', '528', 'Netherlands'), ce('NO', 'NOR', '578', 'Norway'),
  ce('NP', 'NPL', '524', 'Nepal'), ce('NZ', 'NZL', '554', 'New Zealand'),
  ce('OM', 'OMN', '512', 'Oman'), ce('PA', 'PAN', '591', 'Panama'),
  ce('PE', 'PER', '604', 'Peru'), ce('PG', 'PNG', '598', 'Papua New Guinea'),
  ce('PH', 'PHL', '608', 'Philippines'), ce('PK', 'PAK', '586', 'Pakistan'),
  ce('PL', 'POL', '616', 'Poland'), ce('PT', 'PRT', '620', 'Portugal'),
  ce('PY', 'PRY', '600', 'Paraguay'), ce('QA', 'QAT', '634', 'Qatar'),
  ce('RO', 'ROU', '642', 'Romania'), ce('RS', 'SRB', '688', 'Serbia'),
  ce('RU', 'RUS', '643', 'Russia'), ce('RW', 'RWA', '646', 'Rwanda'),
  ce('SA', 'SAU', '682', 'Saudi Arabia'), ce('SB', 'SLB', '090', 'Solomon Islands'),
  ce('SC', 'SYC', '690', 'Seychelles'), ce('SD', 'SDN', '729', 'Sudan'),
  ce('SE', 'SWE', '752', 'Sweden'), ce('SG', 'SGP', '702', 'Singapore'),
  ce('SI', 'SVN', '705', 'Slovenia'), ce('SK', 'SVK', '703', 'Slovakia'),
  ce('SL', 'SLE', '694', 'Sierra Leone'), ce('SM', 'SMR', '674', 'San Marino'),
  ce('SN', 'SEN', '686', 'Senegal'), ce('SO', 'SOM', '706', 'Somalia'),
  ce('SR', 'SUR', '740', 'Suriname'), ce('SS', 'SSD', '728', 'South Sudan'),
  ce('ST', 'STP', '678', 'São Tomé and Príncipe'), ce('SV', 'SLV', '222', 'El Salvador'),
  ce('SY', 'SYR', '760', 'Syria'), ce('SZ', 'SWZ', '748', 'Eswatini'),
  ce('TD', 'TCD', '144', 'Chad'), ce('TG', 'TGO', '768', 'Togo'),
  ce('TH', 'THA', '764', 'Thailand'), ce('TJ', 'TJK', '762', 'Tajikistan'),
  ce('TL', 'TLS', '626', 'Timor-Leste'), ce('TM', 'TKM', '795', 'Turkmenistan'),
  ce('TN', 'TUN', '788', 'Tunisia'), ce('TO', 'TON', '776', 'Tonga'),
  ce('TR', 'TUR', '792', 'Turkey'), ce('TT', 'TTO', '780', 'Trinidad and Tobago'),
  ce('TV', 'TUV', '798', 'Tuvalu'), ce('TW', 'TWN', '158', 'Taiwan'),
  ce('TZ', 'TZA', '834', 'Tanzania'), ce('UA', 'UKR', '804', 'Ukraine'),
  ce('UG', 'UGA', '800', 'Uganda'), ce('US', 'USA', '840', 'United States'),
  ce('UY', 'URY', '858', 'Uruguay'), ce('UZ', 'UZB', '860', 'Uzbekistan'),
  ce('VC', 'VCT', '670', 'Saint Vincent and the Grenadines'), ce('VE', 'VEN', '862', 'Venezuela'),
  ce('VN', 'VNM', '704', 'Vietnam'), ce('VU', 'VUT', '548', 'Vanuatu'),
  ce('WS', 'WSM', '882', 'Samoa'), ce('YE', 'YEM', '887', 'Yemen'),
  ce('ZA', 'ZAF', '710', 'South Africa'), ce('ZM', 'ZMB', '894', 'Zambia'),
  ce('ZW', 'ZWE', '716', 'Zimbabwe'),
];

/** Search countries by code or name (case-insensitive). */
export function searchCountries(query: string): CountryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter((c) => {
    return (
      c.alpha2.toLowerCase().includes(q) ||
      c.alpha3.toLowerCase().includes(q) ||
      c.numeric.includes(q) ||
      c.name.toLowerCase().includes(q)
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useCountryCodeLookup(): UseCountryCodeLookupReturn {
  const query = ref<string>('');
  const results = computed(() => searchCountries(query.value)) as unknown as Ref<CountryEntry[]>;

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
