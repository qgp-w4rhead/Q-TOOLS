/**
 * useVinDecoder - composable + pure logic for the VIN decoder tool.
 *
 * Decodes a 17-character Vehicle Identification Number into its structural
 * components (WMI, VDS, VIS), validates the check digit (position 9), and
 * resolves the model year code (position 10).
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface VinDecodeResult {
  valid: boolean;
  wmi: string;
  vds: string;
  vis: string;
  checkDigit: string;
  computedCheckDigit: string;
  checkDigitValid: boolean;
  modelYear: number | null;
  modelYearCode: string;
  serialNumber: string;
  errors: string[];
}

export interface UseVinDecoderReturn {
  input: Ref<string>;
  result: Ref<VinDecodeResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Characters not allowed in a VIN. */
const FORBIDDEN = new Set(['I', 'O', 'Q']);

/** Transliteration values for VIN characters (A=1 … Z=9, excluding I,O,Q). */
const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

/** Position weights for the check-digit calculation (positions 1-17). */
const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Model year codes (position 10). */
const YEAR_CODES: Record<string, number> = {
  A: 1980, B: 1981, C: 1982, D: 1983, E: 1984, F: 1985, G: 1986, H: 1987,
  J: 1988, K: 1989, L: 1990, M: 1991, N: 1992, P: 1993, R: 1994, S: 1995,
  T: 1996, V: 1997, W: 1998, X: 1999, Y: 2000,
  '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005, '6': 2006,
  '7': 2007, '8': 2008, '9': 2009,
};

/** Sanitize a VIN string: uppercase, strip non-alphanumeric, keep I/O/Q for error reporting. */
export function sanitizeVin(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Compute the VIN check digit for a 17-char VIN (position 9 is ignored). */
export function computeCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = vin[i] ?? '';
    const translit = TRANSLITERATION[ch];
    if (translit === undefined) return '?';
    sum += translit * (POSITION_WEIGHTS[i] ?? 0);
  }
  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/** Resolve a model year from the position-10 character. */
export function resolveModelYear(code: string): number | null {
  const base = YEAR_CODES[code];
  if (base === undefined) return null;
  // Codes repeat every 30 years. A=1980 also means A=2010, 2040, etc.
  // We return the most recent plausible year.
  const now = new Date().getFullYear();
  let year = base;
  while (year + 30 <= now) {
    year += 30;
  }
  return year;
}

/** Decode a VIN string into its structural components. */
export function decodeVin(rawInput: string): VinDecodeResult {
  const vin = sanitizeVin(rawInput);
  const errors: string[] = [];

  if (vin.length === 0) {
    return {
      valid: false,
      wmi: '',
      vds: '',
      vis: '',
      checkDigit: '',
      computedCheckDigit: '',
      checkDigitValid: false,
      modelYear: null,
      modelYearCode: '',
      serialNumber: '',
      errors: [],
    };
  }

  if (vin.length !== 17) {
    errors.push(`VIN must be exactly 17 characters (got ${vin.length}).`);
  }

  // Check for forbidden characters.
  for (let i = 0; i < vin.length; i++) {
    if (FORBIDDEN.has(vin[i]!)) {
      errors.push(`Invalid character "${vin[i]}" at position ${i + 1} (I, O, Q are not allowed in VINs).`);
    }
  }

  const wmi = vin.slice(0, 3);
  const vds = vin.slice(3, 8);
  const checkDigit = vin[8] ?? '';
  const vis = vin.slice(9, 17);
  const modelYearCode = vin[9] ?? '';
  const serialNumber = vin.slice(11, 17);

  const computedCheckDigit = vin.length === 17 ? computeCheckDigit(vin) : '?';
  const checkDigitValid = vin.length === 17 && computedCheckDigit !== '?' && checkDigit === computedCheckDigit;

  if (vin.length === 17 && !checkDigitValid) {
    errors.push(`Check digit mismatch: expected "${computedCheckDigit}", got "${checkDigit}".`);
  }

  const modelYear = modelYearCode ? resolveModelYear(modelYearCode) : null;

  return {
    valid: errors.length === 0,
    wmi,
    vds,
    vis,
    checkDigit,
    computedCheckDigit,
    checkDigitValid,
    modelYear,
    modelYearCode,
    serialNumber,
    errors,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useVinDecoder(): UseVinDecoderReturn {
  const input = ref<string>('');
  const result = ref<VinDecodeResult | null>(null);

  function recompute(): void {
    const decoded = decodeVin(input.value);
    if (decoded.wmi === '' && decoded.errors.length === 0) {
      result.value = null;
      return;
    }
    result.value = decoded;
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
