/**
 * useEnergyConverter - composable + unit definitions for the energy converter.
 *
 * Converts between common energy units using joules as the base unit.
 * Supports: J, kJ, cal, kcal, Wh, kWh, BTU, ft·lb.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertEnergy } from '@/composables/useUnitConverter';

export type UseEnergyConverterReturn = UseUnitConverterReturn;

export const ENERGY_UNITS: UnitSet[] = [
  {
    id: 'energy',
    label: 'Energy',
    units: [
      { id: 'J', label: 'Joule', symbol: 'J', toBase: 1 },
      { id: 'kJ', label: 'Kilojoule', symbol: 'kJ', toBase: 1000 },
      { id: 'cal', label: 'Calorie', symbol: 'cal', toBase: 4.184 },
      { id: 'kcal', label: 'Kilocalorie', symbol: 'kcal', toBase: 4184 },
      { id: 'Wh', label: 'Watt-hour', symbol: 'Wh', toBase: 3600 },
      { id: 'kWh', label: 'Kilowatt-hour', symbol: 'kWh', toBase: 3_600_000 },
      { id: 'BTU', label: 'British thermal unit', symbol: 'BTU', toBase: 1055.05585262 },
      { id: 'ftlb', label: 'Foot-pound', symbol: 'ftlb', toBase: 1.3558179483314 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatEnergy(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function useEnergyConverter(): UseEnergyConverterReturn {
  return useUnitConverter({
    sets: ENERGY_UNITS,
    defaultUnitId: 'J',
    format: formatEnergy,
  });
}
