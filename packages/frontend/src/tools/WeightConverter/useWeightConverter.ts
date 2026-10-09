/**
 * useWeightConverter - composable + unit definitions for the weight converter.
 *
 * Converts between metric and imperial weight/mass units using grams as the
 * base unit. Supports: mg, g, kg, t, oz, lb, st, ton (US), tonne (metric).
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertWeight } from '@/composables/useUnitConverter';

export type UseWeightConverterReturn = UseUnitConverterReturn;

export const WEIGHT_UNITS: UnitSet[] = [
  {
    id: 'weight',
    label: 'Weight',
    units: [
      { id: 'mg', label: 'Milligram', symbol: 'mg', toBase: 0.001 },
      { id: 'g', label: 'Gram', symbol: 'g', toBase: 1 },
      { id: 'kg', label: 'Kilogram', symbol: 'kg', toBase: 1000 },
      { id: 't', label: 'Metric ton', symbol: 't', toBase: 1_000_000 },
      { id: 'oz', label: 'Ounce', symbol: 'oz', toBase: 28.349523125 },
      { id: 'lb', label: 'Pound', symbol: 'lb', toBase: 453.59237 },
      { id: 'st', label: 'Stone', symbol: 'st', toBase: 6350.29318 },
      { id: 'ton_us', label: 'US ton', symbol: 'ton_us', toBase: 907184.74 },
      { id: 'tonne', label: 'Tonne (metric)', symbol: 'tonne', toBase: 1_000_000 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatWeight(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function useWeightConverter(): UseWeightConverterReturn {
  return useUnitConverter({
    sets: WEIGHT_UNITS,
    defaultUnitId: 'kg',
    format: formatWeight,
  });
}
