/**
 * useCreditCardValidator - composable + pure logic for the credit card
 * validator tool.
 *
 * Validates credit card numbers using the Luhn algorithm and identifies
 * the card brand based on the IIN (Issuer Identification Number) prefix
 * and number length.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'diners'
  | 'jcb'
  | 'unionpay'
  | 'unknown';

export interface UseCreditCardValidatorReturn {
  input: Ref<string>;
  isValid: Ref<boolean | null>;
  brand: Ref<CardBrand>;
  formattedNumber: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Strip all non-digit characters from a card number string. */
export function sanitizeCardNumber(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Run the Luhn checksum algorithm on a digit string.
 * Returns true if the number passes the Luhn check.
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = sanitizeCardNumber(cardNumber);
  if (digits.length < 2) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i] ?? '0', 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Detect the card brand from the IIN prefix and number length.
 * Returns 'unknown' if no brand matches.
 */
export function detectCardBrand(cardNumber: string): CardBrand {
  const digits = sanitizeCardNumber(cardNumber);
  if (digits.length === 0) return 'unknown';

  // Visa: starts with 4, length 13-19
  if (/^4\d{12,18}$/.test(digits)) return 'visa';

  // Mastercard: starts 51-55 or 2221-2720, length 16
  if (/^(5[1-5]|2[2-7])\d{14}$/.test(digits)) return 'mastercard';

  // Amex: starts 34 or 37, length 15
  if (/^3[47]\d{13}$/.test(digits)) return 'amex';

  // Discover: starts 6011, 622126-622925, 644-649, 65, length 16-19
  if (/^(6011|65|64[4-9])\d{12,15}$/.test(digits)) return 'discover';
  if (/^6221(2[6-9]|[3-9]\d)\d{10,13}$/.test(digits)) return 'discover';

  // Diners Club: starts 300-305, 36, 38, length 14-19
  if (/^(30[0-5]|36|38)\d{11,16}$/.test(digits)) return 'diners';

  // JCB: starts 3528-3589, length 16-19
  if (/^35(2[89]|[3-8]\d)\d{12,15}$/.test(digits)) return 'jcb';

  // UnionPay: starts 62, length 16-19
  if (/^62\d{14,17}$/.test(digits)) return 'unionpay';

  return 'unknown';
}

/** Format a card number with spaces every 4 digits (Amex: 4-6-5). */
export function formatCardNumber(cardNumber: string): string {
  const digits = sanitizeCardNumber(cardNumber);
  if (digits.length === 0) return '';

  const brand = detectCardBrand(digits);
  if (brand === 'amex') {
    // Amex format: 4-6-5
    const groups = [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(
      (g) => g.length > 0,
    );
    return groups.join(' ');
  }

  // Default: groups of 4
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    groups.push(digits.slice(i, i + 4));
  }
  return groups.join(' ');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useCreditCardValidator(): UseCreditCardValidatorReturn {
  const input = ref<string>('');
  const isValid = ref<boolean | null>(null);
  const brand = ref<CardBrand>('unknown');
  const formattedNumber = ref<string>('');

  function recompute(): void {
    const digits = sanitizeCardNumber(input.value);
    if (digits.length === 0) {
      isValid.value = null;
      brand.value = 'unknown';
      formattedNumber.value = '';
      return;
    }
    brand.value = detectCardBrand(digits);
    formattedNumber.value = formatCardNumber(digits);
    isValid.value = luhnCheck(digits);
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

  watch([isValid, brand], () => {
    if (isEmbed.value) {
      sendOutput({
        valid: isValid.value,
        brand: brand.value,
        formatted: formattedNumber.value,
      });
    }
  });

  return {
    input,
    isValid,
    brand,
    formattedNumber,
    isEmbed,
    embedInput,
    reset,
  };
}
