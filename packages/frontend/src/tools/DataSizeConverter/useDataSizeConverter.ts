/**
 * useDataSizeConverter - composable + pure logic for the data size converter tool.
 *
 * Converts between digital data size units using either binary (1024-based)
 * or decimal (1000-based) conventions. Supports bytes, KB, MB, GB, TB, PB.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type DataSizeUnit = 'B' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB';
export type DataSizeConvention = 'binary' | 'decimal';

export interface UseDataSizeConverterReturn {
  inputValue: Ref<string>;
  inputUnit: Ref<DataSizeUnit>;
  convention: Ref<DataSizeConvention>;
  results: Ref<Record<DataSizeUnit, string>>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const DATA_SIZE_UNITS: DataSizeUnit[] = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

const UNIT_LABELS: Record<DataSizeUnit, string> = {
  B: 'Bytes',
  KB: 'Kilobytes',
  MB: 'Megabytes',
  GB: 'Gigabytes',
  TB: 'Terabytes',
  PB: 'Petabytes',
};

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Get the base multiplier for the given convention. */
function getBase(convention: DataSizeConvention): number {
  return convention === 'binary' ? 1024 : 1000;
}

/** Get the exponent of a unit relative to bytes (B = 0, KB = 1, ...). */
function unitExponent(unit: DataSizeUnit): number {
  return DATA_SIZE_UNITS.indexOf(unit);
}

/**
 * Convert a value from one data size unit to another.
 * Returns `null` if the input is not a finite number.
 */
export function convertDataSize(
  value: number,
  from: DataSizeUnit,
  to: DataSizeUnit,
  convention: DataSizeConvention,
): number | null {
  if (!Number.isFinite(value)) return null;
  const base = getBase(convention);
  const fromExp = unitExponent(from);
  const toExp = unitExponent(to);
  const inBytes = value * Math.pow(base, fromExp);
  return inBytes / Math.pow(base, toExp);
}

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatDataSize(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1) {
    const fixed = n.toFixed(6);
    return fixed.replace(/\.?0+$/, '');
  }
  // For very small numbers, use more precision.
  const fixed = n.toFixed(12);
  return fixed.replace(/\.?0+$/, '');
}

/** Get the human-readable label for a unit. */
export function getUnitLabel(unit: DataSizeUnit): string {
  return UNIT_LABELS[unit];
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useDataSizeConverter(): UseDataSizeConverterReturn {
  const inputValue = ref<string>('1');
  const inputUnit = ref<DataSizeUnit>('MB');
  const convention = ref<DataSizeConvention>('binary');
  const results = ref<Record<DataSizeUnit, string>>({} as Record<DataSizeUnit, string>);

  function recompute(): void {
    const num = Number(inputValue.value);
    const out: Record<DataSizeUnit, string> = {} as Record<DataSizeUnit, string>;
    for (const unit of DATA_SIZE_UNITS) {
      const converted = convertDataSize(num, inputUnit.value, unit, convention.value);
      out[unit] = converted === null ? '-' : formatDataSize(converted);
    }
    results.value = out;
  }

  function reset(): void {
    inputValue.value = '1';
    inputUnit.value = 'MB';
    convention.value = 'binary';
    recompute();
  }

  watch([inputValue, inputUnit, convention], () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        inputValue.value = String(p.value);
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        inputValue.value = String(p.input);
      }
      if (typeof p.unit === 'string' && DATA_SIZE_UNITS.includes(p.unit as DataSizeUnit)) {
        inputUnit.value = p.unit as DataSizeUnit;
      }
      if (typeof p.convention === 'string' && (p.convention === 'binary' || p.convention === 'decimal')) {
        convention.value = p.convention as DataSizeConvention;
      }
    },
    output: results,
    toOutput: () => ({
      results: results.value,
      inputValue: inputValue.value,
      inputUnit: inputUnit.value,
      convention: convention.value,
    }),
  });

  return {
    inputValue,
    inputUnit,
    convention,
    results,
    isEmbed,
    embedInput,
    reset,
  };
}
