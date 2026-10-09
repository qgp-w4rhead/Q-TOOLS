/**
 * useSwiftBicValidator - composable + pure logic for the SWIFT/BIC validator.
 *
 * Validates SWIFT/BIC codes (8 or 11 characters) and parses into bank code,
 * country code, location code, and branch code. Validates the ISO 3166
 * country code and checks the structure.
 *
 * All computations are pure - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type BicType = 'unknown' | 'live' | 'test' | 'passive';

export interface SwiftBicParseResult {
  valid: boolean;
  bankCode: string;
  countryCode: string;
  locationCode: string;
  branchCode: string;
  type: BicType;
  errors: string[];
}

export interface UseSwiftBicValidatorReturn {
  input: Ref<string>;
  result: Ref<SwiftBicParseResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** ISO 3166-1 alpha-2 country codes (subset - all 249 official codes). */
const COUNTRY_CODES = new Set([
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS',
  'BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN',
  'CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE',
  'EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF',
  'GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM',
  'HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM',
  'JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC',
  'LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK',
  'ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA',
  'NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG',
  'PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS',
  'ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO',
  'TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI',
  'VN','VU','WF','WS','YE','YT','ZA','ZM','ZW',
]);

/** Sanitize a BIC string: uppercase, strip non-alphanumeric. */
export function sanitizeBic(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Determine BIC type from location code. */
export function detectBicType(locationCode: string): BicType {
  if (locationCode.length < 2) return 'unknown';
  const second = locationCode[1] ?? '';
  if (second === '0') return 'test';
  if (second === '1') return 'passive';
  return 'live';
}

/** Validate and parse a SWIFT/BIC code. */
export function validateSwiftBic(rawInput: string): SwiftBicParseResult {
  const bic = sanitizeBic(rawInput);
  const errors: string[] = [];

  if (bic.length === 0) {
    return {
      valid: false,
      bankCode: '',
      countryCode: '',
      locationCode: '',
      branchCode: '',
      type: 'unknown',
      errors: [],
    };
  }

  if (bic.length !== 8 && bic.length !== 11) {
    errors.push(`BIC must be 8 or 11 characters (got ${bic.length}).`);
  }

  // Bank code: positions 1-4 (letters only)
  const bankCode = bic.slice(0, 4);
  if (bankCode.length === 4 && !/^[A-Z]{4}$/.test(bankCode)) {
    errors.push('Bank code (positions 1-4) must be 4 letters.');
  }

  // Country code: positions 5-6 (letters only)
  const countryCode = bic.slice(4, 6);
  if (countryCode.length === 2) {
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      errors.push('Country code (positions 5-6) must be 2 letters.');
    } else if (!COUNTRY_CODES.has(countryCode)) {
      errors.push(`Unknown ISO 3166 country code "${countryCode}".`);
    }
  }

  // Location code: positions 7-8 (alphanumeric)
  const locationCode = bic.slice(6, 8);

  // Branch code: positions 9-11 (alphanumeric, optional)
  const branchCode = bic.length === 11 ? bic.slice(8, 11) : '';

  const type = locationCode.length === 2 ? detectBicType(locationCode) : 'unknown';

  return {
    valid: errors.length === 0,
    bankCode,
    countryCode,
    locationCode,
    branchCode,
    type,
    errors,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useSwiftBicValidator(): UseSwiftBicValidatorReturn {
  const input = ref<string>('');
  const result = ref<SwiftBicParseResult | null>(null);

  function recompute(): void {
    const parsed = validateSwiftBic(input.value);
    if (parsed.bankCode === '' && parsed.errors.length === 0) {
      result.value = null;
      return;
    }
    result.value = parsed;
  }

  function reset(): void {
    input.value = '';
    result.value = null;
  }

  watch(input, () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      }
    },
  });

  watch(result, () => {
    if (isEmbed.value && result.value) {
      sendOutput(result.value);
    }
  });

  return {
    input,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
