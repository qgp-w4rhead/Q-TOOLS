/**
 * useFuelEconomyConverter - composable + pure logic for the fuel economy
 * converter tool.
 *
 * Converts between fuel economy units. Supports: mpg_us, mpg_uk, L/100km,
 * km/L.
 *
 * Note: mpg (distance per volume) and L/100km (volume per distance) are
 * inversely related, so conversion requires reciprocals.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type FuelEconomyUnit = 'mpg_us' | 'mpg_uk' | 'L100km' | 'kmL';

export interface UseFuelEconomyConverterReturn {
  inputValue: Ref<string>;
  inputUnit: Ref<FuelEconomyUnit>;
  results: Ref<Record<FuelEconomyUnit, string>>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const FUEL_ECONOMY_UNITS: FuelEconomyUnit[] = ['mpg_us', 'mpg_uk', 'L100km', 'kmL'];

const UNIT_LABELS: Record<FuelEconomyUnit, string> = {
  mpg_us: 'Miles per gallon (US)',
  mpg_uk: 'Miles per gallon (UK)',
  L100km: 'Litres per 100 km',
  kmL: 'Kilometres per litre',
};

/**
 * Convert to a common base: km per litre (km/L).
 *
 * mpg_us → km/L: 1 mpg_us = 0.4251437075 km/L
 * mpg_uk → km/L: 1 mpg_uk = 0.3540061899 km/L
 * L/100km → km/L: 1 / (L/100km / 100) = 100 / (L/100km)
 * km/L → km/L: 1
 */
const TO_KML: Record<FuelEconomyUnit, (value: number) => number> = {
  mpg_us: (v) => v * 0.4251437075,
  mpg_uk: (v) => v * 0.3540061899,
  L100km: (v) => (v === 0 ? 0 : 100 / v),
  kmL: (v) => v,
};

const FROM_KML: Record<FuelEconomyUnit, (kml: number) => number> = {
  mpg_us: (kml) => kml / 0.4251437075,
  mpg_uk: (kml) => kml / 0.3540061899,
  L100km: (kml) => (kml === 0 ? 0 : 100 / kml),
  kmL: (kml) => kml,
};

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Convert a value from one fuel economy unit to another.
 * Returns `null` if the input is not a finite number.
 */
export function convertFuelEconomy(
  value: number,
  from: FuelEconomyUnit,
  to: FuelEconomyUnit,
): number | null {
  if (!Number.isFinite(value)) return null;
  const kml = TO_KML[from](value);
  return FROM_KML[to](kml);
}

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatFuelEconomy(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

/** Get the human-readable label for a unit. */
export function getFuelEconomyUnitLabel(unit: FuelEconomyUnit): string {
  return UNIT_LABELS[unit];
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useFuelEconomyConverter(): UseFuelEconomyConverterReturn {
  const inputValue = ref<string>('30');
  const inputUnit = ref<FuelEconomyUnit>('mpg_us');
  const results = ref<Record<FuelEconomyUnit, string>>({} as Record<FuelEconomyUnit, string>);

  function recompute(): void {
    const num = Number(inputValue.value);
    const out: Record<FuelEconomyUnit, string> = {} as Record<FuelEconomyUnit, string>;
    for (const unit of FUEL_ECONOMY_UNITS) {
      const converted = convertFuelEconomy(num, inputUnit.value, unit);
      out[unit] = converted === null ? '-' : formatFuelEconomy(converted);
    }
    results.value = out;
  }

  function reset(): void {
    inputValue.value = '30';
    inputUnit.value = 'mpg_us';
    recompute();
  }

  watch([inputValue, inputUnit], () => {
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
      if (typeof p.unit === 'string' && FUEL_ECONOMY_UNITS.includes(p.unit as FuelEconomyUnit)) {
        inputUnit.value = p.unit as FuelEconomyUnit;
      }
    },
    output: results,
    toOutput: () => ({
      results: results.value,
      inputValue: inputValue.value,
      inputUnit: inputUnit.value,
    }),
  });

  return {
    inputValue,
    inputUnit,
    results,
    isEmbed,
    embedInput,
    reset,
  };
}
