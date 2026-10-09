/**
 * useIbanValidatorParser - composable + pure logic for the IBAN validator and
 * parser tool.
 *
 * Validates an International Bank Account Number (IBAN) per ISO 13616 and
 * breaks it down into its constituent parts:
 *
 *   `CC KK BBAN`
 *
 * where `CC` is the 2-letter ISO 3166-1 country code, `KK` is the 2-digit
 * mod-97 check digit, and `BBAN` is the country-specific Basic Bank Account
 * Number (bank code, branch code, account number, optional national check
 * digits, …).
 *
 * The mod-97 checksum is computed with BigInt so that arbitrarily long IBANs
 * (up to the maximum registry length of 34 chars) are handled without
 * floating-point overflow.
 *
 * Pure helpers (`normalizeIban`, `rearrangeForMod97`, `mod97`, `validateIban`,
 * `parseIban`, `formatIban`, `letterValue`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The
 * `useIbanValidatorParser()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies - the country spec table and mod-97 algorithm are
 * hand-rolled.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Segment kind within a country's BBAN. */
export type IbanSegmentType = 'N' | 'A' | 'C';
/** Numeric / Alpha / Alphanumeric (per the IBAN registry). */

/** Named role of a segment within a BBAN. */
export type IbanSegmentRole =
  | 'bankCode'
  | 'branchCode'
  | 'accountNumber'
  | 'nationalCheckDigits'
  | 'accountType'
  | 'reserved'
  | 'identificationNumber'
  | 'currencyCode'
  | 'balanceAccountNumber'
  | 'ownerAccountNumber'
  | 'checkDigits';

/** A single segment of a country's BBAN structure. */
export interface IbanSegmentSpec {
  role: IbanSegmentRole;
  length: number;
  type: IbanSegmentType;
}

/** Country-specific IBAN specification. */
export interface IbanCountrySpec {
  /** ISO 3166-1 alpha-2 country code (lowercase key in the map). */
  country: string;
  /** Human-readable country name. */
  name: string;
  /** Total IBAN length (including the 4-character `CC` + `KK` header). */
  length: number;
  /** Ordered segments that make up the BBAN (the part after `CCKK`). */
  bban: IbanSegmentSpec[];
}

/**
 * IBAN country specifications.
 *
 * Sourced from the SWIFT IBAN Registry format descriptions. Each entry lists
 * the total IBAN length and the ordered BBAN segments with their role, length,
 * and character class (N = numeric, A = uppercase alpha, C = alphanumeric).
 *
 * Only the segments that map to a recognised role (bank code, branch code,
 * account number, national check digits, …) are listed; some countries have
 * additional reserved/proprietary segments that are folded into the last
 * account-number segment for display purposes.
 */
export const IBAN_COUNTRY_SPECS: Readonly<Record<string, IbanCountrySpec>> = {
  ad: {
    country: 'AD',
    name: 'Andorra',
    length: 24,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 12, type: 'C' },
    ],
  },
  ae: {
    country: 'AE',
    name: 'United Arab Emirates',
    length: 23,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  al: {
    country: 'AL',
    name: 'Albania',
    length: 28,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'nationalCheckDigits', length: 1, type: 'N' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  at: {
    country: 'AT',
    name: 'Austria',
    length: 20,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 11, type: 'N' },
    ],
  },
  az: {
    country: 'AZ',
    name: 'Azerbaijan',
    length: 28,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 20, type: 'C' },
    ],
  },
  ba: {
    country: 'BA',
    name: 'Bosnia and Herzegovina',
    length: 20,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'branchCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 8, type: 'N' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  be: {
    country: 'BE',
    name: 'Belgium',
    length: 16,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 7, type: 'N' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  bg: {
    country: 'BG',
    name: 'Bulgaria',
    length: 22,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountType', length: 2, type: 'C' },
      { role: 'accountNumber', length: 8, type: 'C' },
    ],
  },
  bh: {
    country: 'BH',
    name: 'Bahrain',
    length: 22,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 14, type: 'C' },
    ],
  },
  br: {
    country: 'BR',
    name: 'Brazil',
    length: 29,
    bban: [
      { role: 'bankCode', length: 8, type: 'N' },
      { role: 'branchCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 10, type: 'C' },
      { role: 'accountType', length: 1, type: 'A' },
      { role: 'ownerAccountNumber', length: 1, type: 'C' },
    ],
  },
  by: {
    country: 'BY',
    name: 'Belarus',
    length: 28,
    bban: [
      { role: 'bankCode', length: 4, type: 'C' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  ch: {
    country: 'CH',
    name: 'Switzerland',
    length: 21,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 12, type: 'C' },
    ],
  },
  cr: {
    country: 'CR',
    name: 'Costa Rica',
    length: 22,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 14, type: 'N' },
    ],
  },
  cy: {
    country: 'CY',
    name: 'Cyprus',
    length: 28,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'branchCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  cz: {
    country: 'CZ',
    name: 'Czech Republic',
    length: 24,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 6, type: 'N' },
      { role: 'branchCode', length: 10, type: 'N' },
    ],
  },
  de: {
    country: 'DE',
    name: 'Germany',
    length: 22,
    bban: [
      { role: 'bankCode', length: 8, type: 'N' },
      { role: 'accountNumber', length: 10, type: 'N' },
    ],
  },
  dk: {
    country: 'DK',
    name: 'Denmark',
    length: 18,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 10, type: 'N' },
    ],
  },
  do: {
    country: 'DO',
    name: 'Dominican Republic',
    length: 28,
    bban: [
      { role: 'bankCode', length: 4, type: 'C' },
      { role: 'accountNumber', length: 20, type: 'C' },
    ],
  },
  ee: {
    country: 'EE',
    name: 'Estonia',
    length: 20,
    bban: [
      { role: 'bankCode', length: 2, type: 'N' },
      { role: 'branchCode', length: 2, type: 'N' },
      { role: 'accountNumber', length: 11, type: 'N' },
      { role: 'nationalCheckDigits', length: 1, type: 'N' },
    ],
  },
  eg: {
    country: 'EG',
    name: 'Egypt',
    length: 29,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 17, type: 'N' },
    ],
  },
  es: {
    country: 'ES',
    name: 'Spain',
    length: 24,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
      { role: 'accountNumber', length: 10, type: 'N' },
    ],
  },
  fi: {
    country: 'FI',
    name: 'Finland',
    length: 18,
    bban: [
      { role: 'bankCode', length: 6, type: 'N' },
      { role: 'accountNumber', length: 7, type: 'N' },
      { role: 'nationalCheckDigits', length: 1, type: 'N' },
    ],
  },
  fo: {
    country: 'FO',
    name: 'Faroe Islands',
    length: 18,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 9, type: 'N' },
      { role: 'nationalCheckDigits', length: 1, type: 'N' },
    ],
  },
  fr: {
    country: 'FR',
    name: 'France',
    length: 27,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'branchCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 11, type: 'C' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  gb: {
    country: 'GB',
    name: 'United Kingdom',
    length: 22,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 6, type: 'N' },
      { role: 'accountNumber', length: 8, type: 'N' },
    ],
  },
  ge: {
    country: 'GE',
    name: 'Georgia',
    length: 22,
    bban: [
      { role: 'bankCode', length: 2, type: 'A' },
      { role: 'accountNumber', length: 16, type: 'N' },
    ],
  },
  gi: {
    country: 'GI',
    name: 'Gibraltar',
    length: 23,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 15, type: 'C' },
    ],
  },
  gl: {
    country: 'GL',
    name: 'Greenland',
    length: 18,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 9, type: 'N' },
      { role: 'nationalCheckDigits', length: 1, type: 'N' },
    ],
  },
  gr: {
    country: 'GR',
    name: 'Greece',
    length: 27,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  gt: {
    country: 'GT',
    name: 'Guatemala',
    length: 28,
    bban: [
      { role: 'bankCode', length: 4, type: 'C' },
      { role: 'currencyCode', length: 2, type: 'C' },
      { role: 'accountType', length: 2, type: 'C' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  hr: {
    country: 'HR',
    name: 'Croatia',
    length: 21,
    bban: [
      { role: 'bankCode', length: 7, type: 'N' },
      { role: 'accountNumber', length: 10, type: 'N' },
    ],
  },
  hu: {
    country: 'HU',
    name: 'Hungary',
    length: 28,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 16, type: 'N' },
      { role: 'nationalCheckDigits', length: 1, type: 'N' },
    ],
  },
  ie: {
    country: 'IE',
    name: 'Ireland',
    length: 22,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 6, type: 'N' },
      { role: 'accountNumber', length: 8, type: 'C' },
    ],
  },
  il: {
    country: 'IL',
    name: 'Israel',
    length: 23,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'branchCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 13, type: 'N' },
    ],
  },
  iq: {
    country: 'IQ',
    name: 'Iraq',
    length: 23,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 12, type: 'N' },
    ],
  },
  is: {
    country: 'IS',
    name: 'Iceland',
    length: 26,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'branchCode', length: 2, type: 'N' },
      { role: 'accountNumber', length: 6, type: 'N' },
      { role: 'identificationNumber', length: 10, type: 'N' },
    ],
  },
  it: {
    country: 'IT',
    name: 'Italy',
    length: 27,
    bban: [
      { role: 'nationalCheckDigits', length: 1, type: 'A' },
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'branchCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 12, type: 'C' },
    ],
  },
  jo: {
    country: 'JO',
    name: 'Jordan',
    length: 30,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 18, type: 'C' },
    ],
  },
  kw: {
    country: 'KW',
    name: 'Kuwait',
    length: 30,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 22, type: 'C' },
    ],
  },
  kz: {
    country: 'KZ',
    name: 'Kazakhstan',
    length: 20,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 13, type: 'C' },
    ],
  },
  lb: {
    country: 'LB',
    name: 'Lebanon',
    length: 28,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 20, type: 'C' },
    ],
  },
  lc: {
    country: 'LC',
    name: 'Saint Lucia',
    length: 32,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 24, type: 'C' },
    ],
  },
  li: {
    country: 'LI',
    name: 'Liechtenstein',
    length: 21,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 12, type: 'C' },
    ],
  },
  lt: {
    country: 'LT',
    name: 'Lithuania',
    length: 20,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 11, type: 'N' },
    ],
  },
  lu: {
    country: 'LU',
    name: 'Luxembourg',
    length: 20,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 13, type: 'C' },
    ],
  },
  lv: {
    country: 'LV',
    name: 'Latvia',
    length: 21,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 13, type: 'C' },
    ],
  },
  ly: {
    country: 'LY',
    name: 'Libya',
    length: 25,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'branchCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 15, type: 'N' },
    ],
  },
  mc: {
    country: 'MC',
    name: 'Monaco',
    length: 27,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'branchCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 11, type: 'C' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  md: {
    country: 'MD',
    name: 'Moldova',
    length: 24,
    bban: [
      { role: 'bankCode', length: 2, type: 'C' },
      { role: 'accountNumber', length: 18, type: 'C' },
    ],
  },
  me: {
    country: 'ME',
    name: 'Montenegro',
    length: 22,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 13, type: 'N' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  mk: {
    country: 'MK',
    name: 'North Macedonia',
    length: 19,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 10, type: 'C' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  mr: {
    country: 'MR',
    name: 'Mauritania',
    length: 27,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'branchCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 11, type: 'N' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  mt: {
    country: 'MT',
    name: 'Malta',
    length: 31,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 18, type: 'C' },
    ],
  },
  mu: {
    country: 'MU',
    name: 'Mauritius',
    length: 30,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 2, type: 'N' },
      { role: 'accountNumber', length: 17, type: 'C' },
      { role: 'currencyCode', length: 3, type: 'A' },
    ],
  },
  nl: {
    country: 'NL',
    name: 'Netherlands',
    length: 18,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 10, type: 'N' },
    ],
  },
  no: {
    country: 'NO',
    name: 'Norway',
    length: 15,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 6, type: 'N' },
      { role: 'nationalCheckDigits', length: 1, type: 'N' },
    ],
  },
  pk: {
    country: 'PK',
    name: 'Pakistan',
    length: 24,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  pl: {
    country: 'PL',
    name: 'Poland',
    length: 28,
    bban: [
      { role: 'branchCode', length: 8, type: 'N' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
      { role: 'accountNumber', length: 14, type: 'N' },
    ],
  },
  ps: {
    country: 'PS',
    name: 'Palestine',
    length: 29,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 21, type: 'C' },
    ],
  },
  pt: {
    country: 'PT',
    name: 'Portugal',
    length: 25,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 11, type: 'N' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  qa: {
    country: 'QA',
    name: 'Qatar',
    length: 29,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 21, type: 'C' },
    ],
  },
  ro: {
    country: 'RO',
    name: 'Romania',
    length: 24,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  rs: {
    country: 'RS',
    name: 'Serbia',
    length: 22,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 13, type: 'N' },
      { role: 'nationalCheckDigits', length: 2, type: 'N' },
    ],
  },
  sa: {
    country: 'SA',
    name: 'Saudi Arabia',
    length: 24,
    bban: [
      { role: 'bankCode', length: 2, type: 'N' },
      { role: 'accountNumber', length: 18, type: 'C' },
    ],
  },
  sc: {
    country: 'SC',
    name: 'Seychelles',
    length: 31,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 16, type: 'N' },
      { role: 'accountNumber', length: 3, type: 'A' },
    ],
  },
  se: {
    country: 'SE',
    name: 'Sweden',
    length: 24,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 17, type: 'N' },
    ],
  },
  si: {
    country: 'SI',
    name: 'Slovenia',
    length: 19,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'branchCode', length: 2, type: 'N' },
      { role: 'accountNumber', length: 8, type: 'N' },
    ],
  },
  sk: {
    country: 'SK',
    name: 'Slovakia',
    length: 24,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 6, type: 'N' },
      { role: 'branchCode', length: 10, type: 'N' },
    ],
  },
  sm: {
    country: 'SM',
    name: 'San Marino',
    length: 27,
    bban: [
      { role: 'nationalCheckDigits', length: 1, type: 'A' },
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'branchCode', length: 5, type: 'N' },
      { role: 'accountNumber', length: 12, type: 'C' },
    ],
  },
  st: {
    country: 'ST',
    name: 'São Tomé and Príncipe',
    length: 25,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 13, type: 'N' },
    ],
  },
  sv: {
    country: 'SV',
    name: 'El Salvador',
    length: 28,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'branchCode', length: 4, type: 'N' },
      { role: 'accountNumber', length: 2, type: 'N' },
      { role: 'accountNumber', length: 14, type: 'C' },
    ],
  },
  tl: {
    country: 'TL',
    name: 'Timor-Leste',
    length: 23,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 16, type: 'N' },
    ],
  },
  tn: {
    country: 'TN',
    name: 'Tunisia',
    length: 24,
    bban: [
      { role: 'bankCode', length: 2, type: 'N' },
      { role: 'branchCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 15, type: 'C' },
    ],
  },
  tr: {
    country: 'TR',
    name: 'Turkey',
    length: 26,
    bban: [
      { role: 'bankCode', length: 5, type: 'N' },
      { role: 'reserved', length: 1, type: 'C' },
      { role: 'accountNumber', length: 16, type: 'C' },
    ],
  },
  ua: {
    country: 'UA',
    name: 'Ukraine',
    length: 29,
    bban: [
      { role: 'bankCode', length: 6, type: 'N' },
      { role: 'accountNumber', length: 19, type: 'N' },
    ],
  },
  va: {
    country: 'VA',
    name: 'Vatican City State',
    length: 22,
    bban: [
      { role: 'bankCode', length: 3, type: 'N' },
      { role: 'accountNumber', length: 15, type: 'N' },
    ],
  },
  vg: {
    country: 'VG',
    name: 'British Virgin Islands',
    length: 24,
    bban: [
      { role: 'bankCode', length: 4, type: 'A' },
      { role: 'accountNumber', length: 16, type: 'N' },
    ],
  },
  xk: {
    country: 'XK',
    name: 'Kosovo',
    length: 20,
    bban: [
      { role: 'bankCode', length: 4, type: 'N' },
      { role: 'branchCode', length: 2, type: 'N' },
      { role: 'accountNumber', length: 10, type: 'N' },
    ],
  },
};

/** Maximum IBAN length across all known country specs. */
export const MAX_IBAN_LENGTH = 34;

/** Regex for the basic IBAN envelope: 2 letters + 2 digits + alphanumeric. */
const IBAN_ENVELOPE_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/;

/**
 * Normalise raw user input into a canonical IBAN form: strip all whitespace,
 * remove common separators (dashes, dots), and uppercase.
 *
 * Returns the empty string when the input is blank.
 */
export function normalizeIban(input: string): string {
  return input
    .replace(/[\s\-_.]+/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Map a single uppercase letter to its IBAN numeric value (A=10, B=11, …,
 * Z=35). Returns the empty string for non-letter characters (digits pass
 * through unchanged).
 */
export function letterValue(ch: string): string {
  if (ch >= 'A' && ch <= 'Z') {
    return String(ch.charCodeAt(0) - 'A'.charCodeAt(0) + 10);
  }
  return ch;
}

/**
 * Rearrange an IBAN for the mod-97 check: move the first 4 characters (country
 * code + check digits) to the end, then expand every letter to its numeric
 * value (A=10 … Z=35).
 *
 * Returns a string of decimal digits suitable for `mod97`.
 */
export function rearrangeForMod97(iban: string): string {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let out = '';
  for (let i = 0; i < rearranged.length; i++) {
    out += letterValue(rearranged[i]!);
  }
  return out;
}

/**
 * Compute `numericString mod 97` using BigInt so that arbitrarily long IBANs
 * (up to ~140 digits after letter expansion) are handled without
 * floating-point overflow.
 *
 * Returns `-1` when the input is empty or contains non-digit characters.
 */
export function mod97(numericString: string): number {
  if (numericString.length === 0 || !/^[0-9]+$/.test(numericString)) {
    return -1;
  }
  return Number(BigInt(numericString) % 97n);
}

/** Look up the country spec for a 2-letter country code (case-insensitive). */
export function getCountrySpec(countryCode: string): IbanCountrySpec | null {
  const key = countryCode.toLowerCase();
  return IBAN_COUNTRY_SPECS[key] ?? null;
}

/**
 * Validate a character against a segment's character class.
 *   - `N` numeric (0-9)
 *   - `A` alpha (A-Z)
 *   - `C` alphanumeric (A-Z0-9)
 */
function charMatchesType(ch: string, type: IbanSegmentType): boolean {
  if (type === 'N') return ch >= '0' && ch <= '9';
  if (type === 'A') return ch >= 'A' && ch <= 'Z';
  return (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z');
}

/** Result of `validateIban`. */
export interface IbanValidation {
  /** Whether the IBAN is structurally valid and passes the mod-97 check. */
  valid: boolean;
  /** Validation error message when `valid` is false. */
  error: string | null;
}

/**
 * Validate an IBAN string.
 *
 * Steps:
 *   1. Normalise (strip whitespace, uppercase).
 *   2. Reject empty / too-short / too-long input.
 *   3. Reject unknown country codes.
 *   4. Reject wrong total length for the country.
 *   5. Reject invalid characters in the BBAN per the country's segment specs.
 *   6. Verify the mod-97 checksum (rearrange + expand letters + mod 97 = 1).
 *
 * The input may be raw (with spaces) - it is normalised internally.
 */
export function validateIban(input: string): IbanValidation {
  const iban = normalizeIban(input);
  if (iban.length === 0) {
    return { valid: false, error: 'IBAN is empty.' };
  }
  if (iban.length < 5) {
    return { valid: false, error: 'IBAN is too short (minimum 5 characters).' };
  }
  if (iban.length > MAX_IBAN_LENGTH) {
    return {
      valid: false,
      error: `IBAN is longer than ${MAX_IBAN_LENGTH} characters.`,
    };
  }
  if (!IBAN_ENVELOPE_RE.test(iban)) {
    return {
      valid: false,
      error: 'IBAN must start with 2 letters and 2 digits, followed by alphanumeric characters.',
    };
  }

  const countryCode = iban.slice(0, 2);
  const spec = getCountrySpec(countryCode);
  if (!spec) {
    return {
      valid: false,
      error: `Unknown IBAN country code "${countryCode}".`,
    };
  }
  if (iban.length !== spec.length) {
    return {
      valid: false,
      error: `IBAN for ${spec.name} must be ${spec.length} characters long (got ${iban.length}).`,
    };
  }

  // Validate BBAN character classes segment by segment.
  const bban = iban.slice(4);
  let cursor = 0;
  for (const seg of spec.bban) {
    for (let i = 0; i < seg.length; i++) {
      const ch = bban[cursor + i];
      if (ch === undefined || !charMatchesType(ch, seg.type)) {
        return {
          valid: false,
          error: `Invalid character "${ch ?? ''}" in ${spec.name} IBAN at position ${cursor + i + 5}.`,
        };
      }
    }
    cursor += seg.length;
  }

  // Mod-97 checksum.
  const rearranged = rearrangeForMod97(iban);
  const rem = mod97(rearranged);
  if (rem !== 1) {
    return {
      valid: false,
      error: `IBAN checksum failed (mod 97 = ${rem}, expected 1).`,
    };
  }

  return { valid: true, error: null };
}

/** Result of `parseIban` - the full structural breakdown. */
export interface IbanParseResult {
  /** Original input (trimmed, not normalised). */
  raw: string;
  /** Normalised IBAN (no spaces, uppercase). */
  iban: string;
  /** Pretty-printed IBAN (4-char groups separated by single spaces). */
  formatted: string;
  /** Whether the IBAN is valid. */
  valid: boolean;
  /** Validation error message when `valid` is false. */
  error: string | null;
  /** 2-letter ISO country code (uppercase), or `null` when not determinable. */
  country: string | null;
  /** Human-readable country name, or `null` when the country is unknown. */
  countryName: string | null;
  /** 2-digit mod-97 check digits (positions 3-4), or `null` when too short. */
  checksum: string | null;
  /** Bank code segment, or `null` when the country spec has no bank code. */
  bankCode: string | null;
  /** Branch/sort code segment, or `null` when the country spec has none. */
  branchCode: string | null;
  /** Account number segment(s), or `null` when not parseable. */
  accountNumber: string | null;
  /** National check digits segment, or `null` when the country spec has none. */
  nationalCheckDigits: string | null;
}

/**
 * Parse an IBAN into its constituent parts.
 *
 * Always returns an `IbanParseResult` - even for invalid input - so the UI can
 * display whatever breakdown is recoverable alongside the validation error.
 * For invalid input, the segment fields are populated best-effort from the
 * country spec when the country code is recognised and the length matches.
 */
export function parseIban(input: string): IbanParseResult {
  const raw = input.trim();
  const iban = normalizeIban(input);
  const base: IbanParseResult = {
    raw,
    iban,
    formatted: formatIban(iban),
    valid: false,
    error: null,
    country: null,
    countryName: null,
    checksum: null,
    bankCode: null,
    branchCode: null,
    accountNumber: null,
    nationalCheckDigits: null,
  };

  if (iban.length < 4) {
    base.error = iban.length === 0 ? 'IBAN is empty.' : 'IBAN is too short.';
    return base;
  }

  const countryCode = iban.slice(0, 2);
  const checksum = iban.slice(2, 4);
  base.country = countryCode;
  base.checksum = checksum;

  const spec = getCountrySpec(countryCode);
  if (spec) {
    base.countryName = spec.name;
  }

  // Run full validation.
  const validation = validateIban(iban);
  base.valid = validation.valid;
  base.error = validation.error;

  // Best-effort segment extraction when the country is known and the length
  // matches (even if the checksum failed, the breakdown is still useful).
  if (spec && iban.length === spec.length) {
    const bban = iban.slice(4);
    let cursor = 0;
    let bankCode = '';
    let branchCode = '';
    let accountNumber = '';
    let nationalCheckDigits = '';
    for (const seg of spec.bban) {
      const value = bban.slice(cursor, cursor + seg.length);
      cursor += seg.length;
      switch (seg.role) {
        case 'bankCode':
          bankCode = bankCode ? bankCode + value : value;
          break;
        case 'branchCode':
          branchCode = branchCode ? branchCode + value : value;
          break;
        case 'accountNumber':
        case 'ownerAccountNumber':
          accountNumber = accountNumber ? accountNumber + value : value;
          break;
        case 'nationalCheckDigits':
        case 'checkDigits':
          nationalCheckDigits = nationalCheckDigits
            ? nationalCheckDigits + value
            : value;
          break;
        // Other roles (accountType, currencyCode, identificationNumber,
        // reserved, balanceAccountNumber) are folded into the account number
        // for display purposes.
        default:
          accountNumber = accountNumber ? accountNumber + value : value;
          break;
      }
    }
    base.bankCode = bankCode || null;
    base.branchCode = branchCode || null;
    base.accountNumber = accountNumber || null;
    base.nationalCheckDigits = nationalCheckDigits || null;
  }

  return base;
}

/**
 * Pretty-print an IBAN as 4-character groups separated by single spaces
 * (e.g. `GB82 WEST 1234 5698 7654 32`). Returns the empty string for input
 * shorter than 4 characters.
 */
export function formatIban(iban: string): string {
  const clean = normalizeIban(iban);
  if (clean.length < 4) return clean;
  return clean.replace(/(.{4})(?=.)/g, '$1 ').trim();
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseIbanValidatorParserReturn {
  input: Ref<string>;
  result: Ref<IbanParseResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useIbanValidatorParser(): UseIbanValidatorParserReturn {
  const input = ref<string>('');
  const result = ref<IbanParseResult | null>(null);

  function recompute(): void {
    const text = input.value.trim();
    if (text.length === 0) {
      result.value = null;
      return;
    }
    result.value = parseIban(input.value);
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.iban === 'string') {
        input.value = p.iban;
      } else if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      } else if (typeof p.account === 'string') {
        input.value = p.account;
      } else if (typeof p.text === 'string') {
        input.value = p.text;
      } else if (typeof p.content === 'string') {
        input.value = p.content;
      }
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          iban: r.iban,
          formatted: r.formatted,
          valid: r.valid,
          country: r.country,
          countryName: r.countryName,
          checksum: r.checksum,
          bankCode: r.bankCode,
          branchCode: r.branchCode,
          accountNumber: r.accountNumber,
          nationalCheckDigits: r.nationalCheckDigits,
          error: r.error,
        });
      } else {
        sendOutput({});
      }
    }
  });

  return { input, result, isEmbed, embedInput, recompute };
}
