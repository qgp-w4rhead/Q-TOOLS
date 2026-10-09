/**
 * useIsbnValidator - composable + pure logic for the ISBN validator tool.
 *
 * Validates ISBN-10 and ISBN-13 numbers with checksum verification.
 * ISBN-10 uses a weighted sum with weights 10 down to 1, modulo 11.
 * ISBN-13 uses a weighted sum with alternating weights 1 and 3, modulo 10.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type IsbnType = 'isbn10' | 'isbn13' | 'unknown';

export interface UseIsbnValidatorReturn {
  input: Ref<string>;
  type: Ref<IsbnType>;
  isValid: Ref<boolean | null>;
  formatted: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Strip hyphens and spaces from an ISBN string. */
export function sanitizeIsbn(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Detect whether an ISBN string is ISBN-10 or ISBN-13.
 * Returns 'unknown' if the length doesn't match either format.
 */
export function detectIsbnType(input: string): IsbnType {
  const digits = sanitizeIsbn(input);
  if (digits.length === 10) return 'isbn10';
  if (digits.length === 13) return 'isbn13';
  return 'unknown';
}

/**
 * Validate an ISBN-10 number.
 * The check digit can be 0-9 or X (representing 10).
 * Weighted sum: d1*10 + d2*9 + ... + d10*1, must be divisible by 11.
 */
export function validateIsbn10(input: string): boolean {
  const digits = sanitizeIsbn(input);
  if (digits.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = digits[i] ?? '0';
    let d: number;
    if (ch === 'X') {
      if (i !== 9) return false; // X only valid as check digit
      d = 10;
    } else {
      d = parseInt(ch, 10);
      if (isNaN(d)) return false;
    }
    sum += d * (10 - i);
  }

  return sum % 11 === 0;
}

/**
 * Validate an ISBN-13 number.
 * Weighted sum: d1*1 + d2*3 + d3*1 + d4*3 + ... (alternating 1 and 3),
 * must be divisible by 10.
 */
export function validateIsbn13(input: string): boolean {
  const digits = sanitizeIsbn(input);
  if (digits.length !== 13) return false;

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = parseInt(digits[i] ?? '0', 10);
    if (isNaN(d)) return false;
    sum += d * (i % 2 === 0 ? 1 : 3);
  }

  return sum % 10 === 0;
}

/** Format an ISBN with hyphens for display. */
export function formatIsbn(input: string): string {
  const digits = sanitizeIsbn(input);
  if (digits.length === 10) {
    return `${digits.slice(0, 1)}-${digits.slice(1, 4)}-${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 13) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4, 9)}-${digits.slice(9, 12)}-${digits.slice(12)}`;
  }
  return digits;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useIsbnValidator(): UseIsbnValidatorReturn {
  const input = ref<string>('');
  const type = ref<IsbnType>('unknown');
  const isValid = ref<boolean | null>(null);
  const formatted = ref<string>('');

  function recompute(): void {
    const digits = sanitizeIsbn(input.value);
    if (digits.length === 0) {
      type.value = 'unknown';
      isValid.value = null;
      formatted.value = '';
      return;
    }

    type.value = detectIsbnType(digits);
    formatted.value = formatIsbn(digits);

    if (type.value === 'isbn10') {
      isValid.value = validateIsbn10(digits);
    } else if (type.value === 'isbn13') {
      isValid.value = validateIsbn13(digits);
    } else {
      isValid.value = false;
    }
  }

  function reset(): void {
    input.value = '';
    recompute();
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

  watch([isValid, type], () => {
    if (isEmbed.value) {
      sendOutput({
        valid: isValid.value,
        type: type.value,
        formatted: formatted.value,
      });
    }
  });

  return {
    input,
    type,
    isValid,
    formatted,
    isEmbed,
    embedInput,
    reset,
  };
}
