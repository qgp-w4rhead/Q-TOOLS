/**
 * useSsnValidator - composable + pure logic for the SSN validator tool.
 *
 * Validates US Social Security Numbers (SSN) with format, area, group,
 * and serial number rules. Detects ITINs and invalid/reserved ranges.
 *
 * All computations are pure - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type SsnType = 'unknown' | 'ssn' | 'itin' | 'invalid';

export interface SsnParseResult {
  valid: boolean;
  area: string;
  group: string;
  serial: string;
  formatted: string;
  type: SsnType;
  errors: string[];
}

export interface UseSsnValidatorReturn {
  input: Ref<string>;
  result: Ref<SsnParseResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Sanitize an SSN string: strip non-digits. */
export function sanitizeSsn(input: string): string {
  return input.replace(/\D/g, '');
}

/** Validate and parse a US SSN. */
export function validateSsn(rawInput: string): SsnParseResult {
  const digits = sanitizeSsn(rawInput);
  const errors: string[] = [];

  if (digits.length === 0) {
    return {
      valid: false,
      area: '',
      group: '',
      serial: '',
      formatted: '',
      type: 'unknown',
      errors: [],
    };
  }

  if (digits.length !== 9) {
    errors.push(`SSN must be 9 digits (got ${digits.length}).`);
  }

  const area = digits.slice(0, 3);
  const group = digits.slice(3, 5);
  const serial = digits.slice(5, 9);
  const formatted = digits.length === 9 ? `${area}-${group}-${serial}` : '';

  let type: SsnType = 'ssn';

  if (digits.length === 9) {
    // Area number rules
    const areaNum = parseInt(area, 10);

    // 000, 666, 900-999 are invalid area numbers
    if (areaNum === 0) {
      errors.push('Area number cannot be 000.');
    }
    if (areaNum === 666) {
      errors.push('Area number 666 is invalid.');
    }
    if (areaNum >= 900) {
      // 900-999 could be ITIN (900-xx-9999 with specific middle digits) or invalid
      // ITINs have middle digits 70-88 (900-70-0000 through 999-88-9999)
      const groupNum = parseInt(group, 10);
      if (areaNum >= 900 && areaNum <= 999 && groupNum >= 70 && groupNum <= 88) {
        type = 'itin';
      } else {
        errors.push('Area number 900-999 is invalid for SSN.');
        type = 'invalid';
      }
    }

    // Group number rules
    const groupNum = parseInt(group, 10);
    if (groupNum === 0) {
      errors.push('Group number cannot be 00.');
    }

    // Serial number rules
    const serialNum = parseInt(serial, 10);
    if (serialNum === 0) {
      errors.push('Serial number cannot be 0000.');
    }

    // Known invalid SSNs
    if (digits === '078051120') {
      errors.push('This is a known invalid SSN (promotional).');
    }
    if (digits === '219099999') {
      errors.push('This is a known invalid SSN (promotional).');
    }
  }

  return {
    valid: errors.length === 0,
    area,
    group,
    serial,
    formatted,
    type: errors.length > 0 && type === 'ssn' ? 'invalid' : type,
    errors,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useSsnValidator(): UseSsnValidatorReturn {
  const input = ref<string>('');
  const result = ref<SsnParseResult | null>(null);

  function recompute(): void {
    const parsed = validateSsn(input.value);
    if (parsed.area === '' && parsed.errors.length === 0) {
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
