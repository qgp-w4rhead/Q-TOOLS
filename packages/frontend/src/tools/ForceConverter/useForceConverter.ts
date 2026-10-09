/**
 * useForceConverter - composable + unit definitions for the force converter.
 *
 * Converts between force units using the newton (N) as the base unit:
 * newton, kilonewton, meganewton, dyne, pound-force, kilogram-force,
 * poundal, and kip.
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
  convertUnit as convertForce,
  formatUnitValue as formatForce,
} from '@/composables/useUnitConverter';

export type UseForceConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const FORCE_UNITS: UnitSet[] = [
  {
    id: 'force',
    label: 'Force',
    units: [
      { id: 'n', label: 'Newton', symbol: 'N', toBase: 1 },
      { id: 'kn', label: 'Kilonewton', symbol: 'kN', toBase: 1e3 },
      { id: 'mn', label: 'Meganewton', symbol: 'MN', toBase: 1e6 },
      { id: 'dyn', label: 'Dyne', symbol: 'dyn', toBase: 1e-5 },
      { id: 'lbf', label: 'Pound-force', symbol: 'lbf', toBase: 4.4482216152605 },
      { id: 'kgf', label: 'Kilogram-force', symbol: 'kgf', toBase: 9.80665 },
      { id: 'pdl', label: 'Poundal', symbol: 'pdl', toBase: 0.138254954376 },
      { id: 'kip', label: 'Kip', symbol: 'kip', toBase: 4448.2216152605 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useForceConverter(): UseForceConverterReturn {
  return useUnitConverter({
    sets: FORCE_UNITS,
    defaultUnitId: 'n',
  });
}
