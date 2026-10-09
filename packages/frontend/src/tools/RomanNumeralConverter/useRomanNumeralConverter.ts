/**
 * useRomanNumeralConverter - composable + pure logic for the Roman numeral
 * converter.
 *
 * Bidirectional conversion between Roman numerals and integers in the
 * classic range 1-3999 (no overbar / vinculum notation - the largest value
 * representable is MMMCMXCIX = 3999).
 *
 * Pure helpers (`romanToInt`, `intToRoman`, `isValidRoman`, `isValidInt`,
 * `normalizeRoman`) have no Vue dependency and can be imported standalone
 * for unit testing or reuse. The `useRomanNumeralConverter()` composable
 * wraps them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Smallest convertible integer (Roman numerals have no zero). */
export const MIN_VALUE = 1;
/** Largest convertible integer (MMMCMXCIX) without vinculum notation. */
export const MAX_VALUE = 3999;

/** Conversion mode. */
export type RomanMode = 'roman-to-int' | 'int-to-roman';

/** Symbol → value table, ordered from largest to smallest. */
const ROMAN_TABLE: ReadonlyArray<readonly [string, number]> = [
  ['M', 1000],
  ['CM', 900],
  ['D', 500],
  ['CD', 400],
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1],
] as const;

/** Single-character symbol → value map (for parsing). */
const SYMBOL_VALUES: Readonly<Record<string, number>> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

/**
 * Normalise a Roman-numeral string: trim, uppercase, strip surrounding
 * whitespace. Does not validate - use {@link isValidRoman} for that.
 */
export function normalizeRoman(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * Validate `input` as a Roman numeral in canonical form (1-3999).
 *
 * Accepts only the standard subtractive combinations (IV, IX, XL, XC, CD,
 * CM) and rejects invalid patterns such as:
 *  - empty string
 *  - unknown characters
 *  - more than three consecutive identical I/X/C/M
 *  - more than one V/L/D in a row (or anywhere when they would violate
 *    canonical form)
 *  - illegal subtractive pairs (e.g. IL, IC, IM, VX, XD, XM, LC, DM)
 *  - out-of-order symbols (e.g. IC, IL, IM)
 *
 * Returns `null` when valid, or a human-readable error message.
 */
export function validateRoman(input: string): string | null {
  const s = normalizeRoman(input);
  if (!s) return 'Roman numeral is empty.';
  if (!/^[IVXLCDM]+$/.test(s)) {
    return 'Roman numeral may only contain I, V, X, L, C, D, M.';
  }
  // Reject runs of 4+ identical symbols for I, X, C, M (e.g. IIII, XXXX).
  if (/(I{4,}|X{4,}|C{4,}|M{4,})/.test(s)) {
    return 'Too many repeated symbols (max 3 in a row for I, X, C, M).';
  }
  // V, L, D may never repeat.
  if (/(V{2,}|L{2,}|D{2,})/.test(s)) {
    return 'V, L and D may not be repeated.';
  }
  // Reject illegal subtractive combinations. Allowed subtractive pairs:
  // IV, IX, XL, XC, CD, CM. Anything else ending in a smaller-before-larger
  // pattern is invalid.
  const illegalSubtractive: RegExp =
    /I[LCDM]|V[XLCDM]|X[DM]|L[CDM]|DM/;
  if (illegalSubtractive.test(s)) {
    return 'Invalid subtractive combination. Allowed: IV, IX, XL, XC, CD, CM.';
  }
  // Reject symbols out of descending order except for the allowed
  // subtractive pairs. We do this by walking the string and ensuring each
  // symbol is <= the previous one OR forms a valid two-symbol subtractive
  // pair with the next symbol.
  const chars = [...s];
  let prev = Infinity;
  for (let i = 0; i < chars.length; i++) {
    const cur = SYMBOL_VALUES[chars[i]!]!;
    const next = i + 1 < chars.length ? SYMBOL_VALUES[chars[i + 1]!]! : 0;
    if (cur < next) {
      // Subtractive pair: cur must be a power of 10 (I, X, C) and the pair
      // must be one of the allowed combinations.
      const pair = chars[i]! + chars[i + 1]!;
      const allowedPairs = new Set(['IV', 'IX', 'XL', 'XC', 'CD', 'CM']);
      if (!allowedPairs.has(pair)) {
        return `Invalid subtractive pair "${pair}". Allowed: IV, IX, XL, XC, CD, CM.`;
      }
      // After a subtractive pair, the next symbol must be strictly smaller
      // than `cur` (e.g. IX is followed by nothing or by V/I - but actually
      // IXV is invalid; the rule is the value after the pair must be <= cur
      // and < next, and also cannot repeat the subtracted symbol).
      if (next > prev) {
        return 'Symbols must be in descending order.';
      }
      i++; // consume the second char of the pair
      prev = cur;
    } else {
      if (cur > prev) {
        return 'Symbols must be in descending order.';
      }
      prev = cur;
    }
  }
  // Final sanity: round-trip and compare. If the canonical re-rendering
  // differs, the input was non-canonical (e.g. VIIII instead of IX).
  const value = parseRoman(s);
  if (value === null) return 'Invalid Roman numeral.';
  const canonical = intToRoman(value);
  if (canonical !== s) {
    return `Non-canonical form. Canonical: ${canonical}.`;
  }
  return null;
}

/** `true` when `input` is a valid Roman numeral in canonical form. */
export function isValidRoman(input: string): boolean {
  return validateRoman(input) === null;
}

/**
 * Parse a Roman-numeral string into an integer. Returns `null` for empty
 * input or any character outside `IVXLCDM`. Does NOT enforce canonical
 * form - use {@link validateRoman} for that. This is a lenient parser that
 * sums symbols left-to-right, subtracting when a smaller symbol precedes a
 * larger one.
 */
export function parseRoman(input: string): number | null {
  const s = normalizeRoman(input);
  if (!s) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = SYMBOL_VALUES[s[i]!];
    if (cur === undefined) return null;
    const next = i + 1 < s.length ? SYMBOL_VALUES[s[i + 1]!] ?? 0 : 0;
    if (cur < next) {
      total -= cur;
    } else {
      total += cur;
    }
  }
  return total;
}

/**
 * Convenience: parse a Roman numeral and return the integer, or `null` if
 * the input is not a valid canonical Roman numeral in range 1-3999.
 */
export function romanToInt(input: string): number | null {
  const err = validateRoman(input);
  if (err) return null;
  return parseRoman(input);
}

/**
 * Validate `input` as an integer in the convertible range (1-3999).
 * Returns `null` when valid, or a human-readable error message.
 *
 * Accepts an optional leading `+` sign and surrounding whitespace. Rejects
 * empty input, non-numeric characters, decimals, and out-of-range values.
 */
export function validateInt(input: string): string | null {
  const s = input.trim();
  if (!s) return 'Integer is empty.';
  if (!/^[+]?[0-9]+$/.test(s)) {
    return 'Integer must be a whole number (no decimals or letters).';
  }
  const n = Number(s);
  if (!Number.isSafeInteger(n)) {
    return 'Integer is too large to represent safely.';
  }
  if (n < MIN_VALUE) {
    return `Integer must be at least ${MIN_VALUE} (Roman numerals have no zero).`;
  }
  if (n > MAX_VALUE) {
    return `Integer must be at most ${MAX_VALUE} (MMMCMXCIX) - vinculum notation is not supported.`;
  }
  return null;
}

/** `true` when `input` is a valid integer in the convertible range. */
export function isValidInt(input: string): boolean {
  return validateInt(input) === null;
}

/**
 * Convert an integer (1-3999) to its canonical Roman-numeral representation.
 * Returns `null` when `value` is out of range or not an integer.
 */
export function intToRoman(value: number): string | null {
  if (!Number.isInteger(value) || value < MIN_VALUE || value > MAX_VALUE) {
    return null;
  }
  let remaining = value;
  let out = '';
  for (const [symbol, amount] of ROMAN_TABLE) {
    while (remaining >= amount) {
      out += symbol;
      remaining -= amount;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface RomanNumeralConverterOutputs {
  /** The converted value (Roman or integer, depending on mode). */
  output: string;
  /** Numeric value when in roman→int mode, else null. */
  intValue: number | null;
  /** Roman string when in int→roman mode, else null. */
  romanValue: string | null;
}

export const DEFAULT_MODE: RomanMode = 'roman-to-int';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseRomanNumeralConverterReturn {
  input: Ref<string>;
  mode: Ref<RomanMode>;
  outputs: Ref<RomanNumeralConverterOutputs | null>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: RomanMode) => void;
  swap: () => void;
}

export function useRomanNumeralConverter(): UseRomanNumeralConverterReturn {
  const input = ref<string>('');
  const mode = ref<RomanMode>(DEFAULT_MODE);
  const outputs = ref<RomanNumeralConverterOutputs | null>(null);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (!text.trim()) {
      outputs.value = null;
      error.value = '';
      return;
    }
    if (mode.value === 'roman-to-int') {
      const err = validateRoman(text);
      if (err) {
        outputs.value = null;
        error.value = err;
        return;
      }
      const n = parseRoman(text)!;
      outputs.value = {
        output: String(n),
        intValue: n,
        romanValue: null,
      };
      error.value = '';
    } else {
      const err = validateInt(text);
      if (err) {
        outputs.value = null;
        error.value = err;
        return;
      }
      const n = Number(text.trim());
      const roman = intToRoman(n)!;
      outputs.value = {
        output: roman,
        intValue: null,
        romanValue: roman,
      };
      error.value = '';
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    run();
  }

  function setMode(m: RomanMode): void {
    mode.value = m;
  }

  /** Swap direction and feed the current output back as the new input. */
  function swap(): void {
    if (outputs.value) {
      input.value = outputs.value.output;
    }
    mode.value = mode.value === 'roman-to-int' ? 'int-to-roman' : 'roman-to-int';
  }

  watch(input, scheduleRun);
  watch(mode, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (
        typeof p.mode === 'string' &&
        (p.mode === 'roman-to-int' || p.mode === 'int-to-roman')
      ) {
        mode.value = p.mode;
      }
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    mode,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setMode,
    swap,
  };
}
