/**
 * usePressureConverter - composable + unit definitions for the pressure
 * converter.
 *
 * Converts between common pressure units using pascals as the base unit.
 * Supports: Pa, kPa, MPa, bar, atm, psi, mmHg, torr.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertPressure } from '@/composables/useUnitConverter';

export type UsePressureConverterReturn = UseUnitConverterReturn;

export const PRESSURE_UNITS: UnitSet[] = [
  {
    id: 'pressure',
    label: 'Pressure',
    units: [
      { id: 'Pa', label: 'Pascal', symbol: 'Pa', toBase: 1 },
      { id: 'kPa', label: 'Kilopascal', symbol: 'kPa', toBase: 1000 },
      { id: 'MPa', label: 'Megapascal', symbol: 'MPa', toBase: 1_000_000 },
      { id: 'bar', label: 'Bar', symbol: 'bar', toBase: 100000 },
      { id: 'atm', label: 'Atmosphere', symbol: 'atm', toBase: 101325 },
      { id: 'psi', label: 'Pound per square inch', symbol: 'psi', toBase: 6894.757293168 },
      { id: 'mmHg', label: 'Millimetre of mercury', symbol: 'mmHg', toBase: 133.322387415 },
      { id: 'torr', label: 'Torr', symbol: 'torr', toBase: 133.322368421 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatPressure(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function usePressureConverter(): UsePressureConverterReturn {
  return useUnitConverter({
    sets: PRESSURE_UNITS,
    defaultUnitId: 'atm',
    format: formatPressure,
  });
}
