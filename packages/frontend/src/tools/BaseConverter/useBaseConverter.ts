/**
 * useBaseConverter - composable + pure logic for the integer base converter.
 *
 * Converts integers between bases 2-36 using only the built-in `BigInt` type
 * and `BigInt.prototype.toString(radix)`. No external dependencies.
 *
 * Inputs:
 *  - A string of digits in any base from 2 to 36 (case-insensitive letters).
 *  - Optional `-` / `+` sign prefix.
 *
 * Outputs:
 *  - Binary (base 2), octal (base 8), decimal (base 10), hex (base 16), and a
 *    user-selected custom base (2-36).
 *
 * Signed / unsigned interpretation:
 *  - When a bit width is selected (8/16/32/64/128), the raw parsed value is
 *    masked to that width (two's complement for negatives).
 *  - In signed mode the sign bit (top bit of the width) is interpreted as a
 *    sign, yielding a value in `[-2^(w-1), 2^(w-1) - 1]`.
 *  - In unsigned mode the masked value is always non-negative, in
 *    `[0, 2^w - 1]`.
 *  - With no bit width (unbounded), the raw parsed BigInt is used directly;
 *    in unsigned mode a negative input is an error.
 *
 * The pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useBaseConverter()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies - uses only `BigInt` + `BigInt.prototype.toString`.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Lowest supported base (binary). */
export const MIN_BASE = 2;
/** Highest supported base (base-36, 0-9 + a-z). */
export const MAX_BASE = 36;

/** Digit character table - index `i` maps to the digit for value `i`. */
export const DIGIT_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Standard output bases with friendly labels. */
export const STANDARD_BASES: { base: number; label: string; short: string }[] = [
  { base: 2, label: 'Binary', short: 'bin' },
  { base: 8, label: 'Octal', short: 'oct' },
  { base: 10, label: 'Decimal', short: 'dec' },
  { base: 16, label: 'Hexadecimal', short: 'hex' },
];

/** Selectable bit widths. `0` means unbounded (no masking). */
export const BIT_WIDTHS: { width: number; label: string }[] = [
  { width: 0, label: 'Unbounded' },
  { width: 8, label: '8-bit' },
  { width: 16, label: '16-bit' },
  { width: 32, label: '32-bit' },
  { width: 64, label: '64-bit' },
  { width: 128, label: '128-bit' },
];

/** Default custom output base (base-36 shows the widest digit range). */
export const DEFAULT_OUTPUT_BASE = 36;
/** Default input base (decimal is the most intuitive default). */
export const DEFAULT_INPUT_BASE = 10;

/** `true` when `base` is an integer in `[MIN_BASE, MAX_BASE]`. */
export function isValidBase(base: number): boolean {
  return Number.isInteger(base) && base >= MIN_BASE && base <= MAX_BASE;
}

/**
 * Parse `text` as an integer written in `base`. Returns the parsed `BigInt`
 * value, or `null` when the input is empty or contains an invalid digit.
 *
 * Accepts an optional leading `-` or `+` sign. Digits are case-insensitive
 * (`a` and `A` both mean 10). Surrounding whitespace is trimmed.
 */
export function parseBigInt(text: string, base: number): bigint | null {
  if (!isValidBase(base)) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  let sign = 1n;
  let digits = trimmed;
  const first = digits[0];
  if (first === '-') {
    sign = -1n;
    digits = digits.slice(1);
  } else if (first === '+') {
    digits = digits.slice(1);
  }
  if (!digits) return null;

  const table = DIGIT_CHARS.slice(0, base);
  const baseBig = BigInt(base);
  let value = 0n;
  for (const rawChar of digits.toLowerCase()) {
    const idx = table.indexOf(rawChar);
    if (idx === -1) return null;
    value = value * baseBig + BigInt(idx);
  }
  return sign * value;
}

/**
 * Format `value` as a string in `base` (2-36). Negative values are rendered
 * with a leading `-`. Returns `''` for an invalid base. Uses
 * `BigInt.prototype.toString(radix)` which produces lowercase letters.
 */
export function formatBigInt(value: bigint, base: number): string {
  if (!isValidBase(base)) return '';
  if (value === 0n) return '0';
  return value.toString(base);
}

/** Mask `value` to `bitWidth` bits via two's complement (negatives wrap). */
export function maskToWidth(value: bigint, bitWidth: number): bigint {
  if (bitWidth <= 0) return value;
  const mask = (1n << BigInt(bitWidth)) - 1n;
  // BigInt bitwise AND with a negative operand behaves as two's complement at
  // an infinite width; masking yields the low `bitWidth` bits as a positive.
  return value & mask;
}

/**
 * Interpret a raw parsed `BigInt` according to `signed` and `bitWidth`.
 *
 *  - `bitWidth <= 0` (unbounded):
 *    - signed: return `value` unchanged.
 *    - unsigned: a negative `value` is invalid → returns `null`.
 *  - `bitWidth > 0`:
 *    - The value is masked to `bitWidth` bits (two's complement for negatives).
 *    - signed: if the sign bit (bit `bitWidth - 1`) is set, subtract
 *      `2^bitWidth` to yield a negative value.
 *    - unsigned: return the masked (always non-negative) value.
 */
export function interpretValue(
  value: bigint,
  signed: boolean,
  bitWidth: number,
): bigint | null {
  if (bitWidth <= 0) {
    if (!signed && value < 0n) return null;
    return value;
  }
  const masked = maskToWidth(value, bitWidth);
  if (signed) {
    const signBit = 1n << BigInt(bitWidth - 1);
    if (masked & signBit) {
      return masked - (1n << BigInt(bitWidth));
    }
    return masked;
  }
  return masked;
}

/**
 * Validate that `value` is representable in the given `signed` / `bitWidth`
 * configuration. Returns `null` when valid, or an error message string.
 *
 *  - Unbounded + unsigned: any non-negative value is valid; negatives are not.
 *  - Bounded + signed: value must fit in `[-2^(w-1), 2^(w-1) - 1]`.
 *  - Bounded + unsigned: value must fit in `[0, 2^w - 1]`.
 *
 * Note: `interpretValue` already masks out-of-range values, so this is only
 * used to surface a warning when the input does not fit the selected width.
 */
export function validateRange(
  value: bigint,
  signed: boolean,
  bitWidth: number,
): string | null {
  if (bitWidth <= 0) {
    if (!signed && value < 0n) {
      return 'Negative values cannot be represented as unsigned without a bit width.';
    }
    return null;
  }
  if (signed) {
    const max = (1n << BigInt(bitWidth - 1)) - 1n;
    const min = -(1n << BigInt(bitWidth - 1));
    if (value > max || value < min) {
      return `Value out of range for signed ${bitWidth}-bit (${min}..${max}).`;
    }
  } else {
    const max = (1n << BigInt(bitWidth)) - 1n;
    if (value < 0n || value > max) {
      return `Value out of range for unsigned ${bitWidth}-bit (0..${max}).`;
    }
  }
  return null;
}

/** The full set of computed base-conversion outputs. */
export interface BaseConverterOutputs {
  binary: string;
  octal: string;
  decimal: string;
  hex: string;
  custom: string;
  /** The interpreted integer value (after signed/unsigned + width). */
  value: string;
}

/**
 * Compute all base-conversion outputs for an interpreted `value` and a
 * `customBase` (2-36). Negative values render with a leading `-` in every
 * base. Returns `null` when `value` is `null` (invalid input).
 */
export function computeOutputs(
  value: bigint | null,
  customBase: number,
): BaseConverterOutputs | null {
  if (value === null) return null;
  return {
    binary: formatBigInt(value, 2),
    octal: formatBigInt(value, 8),
    decimal: formatBigInt(value, 10),
    hex: formatBigInt(value, 16),
    custom: formatBigInt(value, customBase),
    value: value.toString(10),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface BaseConverterConfig {
  input: string;
  inputBase: number;
  outputBase: number;
  signed: boolean;
  bitWidth: number;
}

export const DEFAULT_CONFIG: BaseConverterConfig = {
  input: '',
  inputBase: DEFAULT_INPUT_BASE,
  outputBase: DEFAULT_OUTPUT_BASE,
  signed: false,
  bitWidth: 0,
};

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseBaseConverterReturn {
  input: Ref<string>;
  inputBase: Ref<number>;
  outputBase: Ref<number>;
  signed: Ref<boolean>;
  bitWidth: Ref<number>;
  value: Ref<bigint | null>;
  outputs: Ref<BaseConverterOutputs | null>;
  error: Ref<string>;
  warning: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setInputBase: (b: number) => void;
  setOutputBase: (b: number) => void;
  setBitWidth: (w: number) => void;
  setSigned: (s: boolean) => void;
  swap: () => void;
}

export function useBaseConverter(): UseBaseConverterReturn {
  const input = ref<string>('');
  const inputBase = ref<number>(DEFAULT_INPUT_BASE);
  const outputBase = ref<number>(DEFAULT_OUTPUT_BASE);
  const signed = ref<boolean>(false);
  const bitWidth = ref<number>(0);
  const value = ref<bigint | null>(null);
  const outputs = ref<BaseConverterOutputs | null>(null);
  const error = ref<string>('');
  const warning = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (!text.trim()) {
      value.value = null;
      outputs.value = null;
      error.value = '';
      warning.value = '';
      return;
    }
    const parsed = parseBigInt(text, inputBase.value);
    if (parsed === null) {
      value.value = null;
      outputs.value = null;
      error.value = `Invalid input for base ${inputBase.value}.`;
      warning.value = '';
      return;
    }
    const interpreted = interpretValue(parsed, signed.value, bitWidth.value);
    if (interpreted === null) {
      value.value = null;
      outputs.value = null;
      error.value = 'Negative values cannot be represented as unsigned without a bit width.';
      warning.value = '';
      return;
    }
    value.value = interpreted;
    error.value = '';
    // Surface a range warning when the raw parsed value does not fit the
    // selected width (the interpreted value is still computed via masking).
    warning.value = validateRange(parsed, signed.value, bitWidth.value) ?? '';
    outputs.value = computeOutputs(interpreted, outputBase.value);
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

  function setInputBase(b: number): void {
    if (isValidBase(b)) inputBase.value = b;
  }

  function setOutputBase(b: number): void {
    if (isValidBase(b)) outputBase.value = b;
  }

  function setBitWidth(w: number): void {
    bitWidth.value = w;
  }

  function setSigned(s: boolean): void {
    signed.value = s;
  }

  /** Swap the input base with the custom output base (and feed the current
   * decimal value back as the new input). Handy for round-tripping a value. */
  function swap(): void {
    if (!outputs.value) return;
    const newInput = outputs.value.custom;
    const oldInputBase = inputBase.value;
    inputBase.value = outputBase.value;
    outputBase.value = oldInputBase;
    input.value = newInput;
  }

  // Recompute (debounced) whenever any input changes.
  watch(input, scheduleRun);
  watch(inputBase, scheduleRun);
  watch(outputBase, scheduleRun);
  watch(signed, scheduleRun);
  watch(bitWidth, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.inputBase === 'number' && isValidBase(p.inputBase)) {
        inputBase.value = p.inputBase;
      }
      if (typeof p.outputBase === 'number' && isValidBase(p.outputBase)) {
        outputBase.value = p.outputBase;
      }
      if (typeof p.signed === 'boolean') signed.value = p.signed;
      if (typeof p.bitWidth === 'number') bitWidth.value = p.bitWidth;
    },
  });

  // Relay output to the parent whenever the result changes (embed mode only).
  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    inputBase,
    outputBase,
    signed,
    bitWidth,
    value,
    outputs,
    error,
    warning,
    isEmbed,
    embedInput,
    recompute,
    setInputBase,
    setOutputBase,
    setBitWidth,
    setSigned,
    swap,
  };
}
