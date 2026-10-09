/**
 * useAccelerationConverter - composable + unit definitions for the
 * acceleration converter.
 *
 * Converts between acceleration units using metre per second squared
 * (m/s²) as the base unit: m/s², ft/s², in/s², standard gravity (g),
 * galileo (Gal), km/h per second, and mph per second.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export {
  convertUnit as convertAcceleration,
  formatUnitValue as formatAcceleration,
} from '@/composables/useUnitConverter';

export type UseAccelerationConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const ACCELERATION_UNITS: UnitSet[] = [
  {
    id: 'acceleration',
    label: 'Acceleration',
    units: [
      { id: 'm_s2', label: 'Metre per second squared', symbol: 'm/s²', toBase: 1 },
      { id: 'cm_s2', label: 'Centimetre per second squared', symbol: 'cm/s²', toBase: 0.01 },
      { id: 'ft_s2', label: 'Foot per second squared', symbol: 'ft/s²', toBase: 0.3048 },
      { id: 'in_s2', label: 'Inch per second squared', symbol: 'in/s²', toBase: 0.0254 },
      { id: 'g', label: 'Standard gravity (g-force)', symbol: 'g', toBase: 9.80665 },
      { id: 'gal', label: 'Galileo', symbol: 'Gal', toBase: 0.01 },
      { id: 'mgal', label: 'Milligal', symbol: 'mGal', toBase: 1e-5 },
      { id: 'kmh_s', label: 'Kilometre per hour per second', symbol: 'km/h·s', toBase: 1 / 3.6 },
      { id: 'mph_s', label: 'Mile per hour per second', symbol: 'mph/s', toBase: 0.44704 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useAccelerationConverter(): UseAccelerationConverterReturn {
  return useUnitConverter({
    sets: ACCELERATION_UNITS,
    defaultUnitId: 'm_s2',
  });
}
