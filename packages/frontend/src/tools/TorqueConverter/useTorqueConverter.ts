/**
 * useTorqueConverter - composable + unit definitions for the torque converter.
 *
 * Converts between torque units using the newton-metre (N·m) as the base
 * unit: newton-metre, pound-foot, pound-inch, ounce-inch, kilogram-force
 * metre, and dyne-centimetre.
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
  convertUnit as convertTorque,
  formatUnitValue as formatTorque,
} from '@/composables/useUnitConverter';

export type UseTorqueConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const TORQUE_UNITS: UnitSet[] = [
  {
    id: 'torque',
    label: 'Torque',
    units: [
      { id: 'nm', label: 'Newton-metre', symbol: 'N·m', toBase: 1 },
      { id: 'knm', label: 'Kilonewton-metre', symbol: 'kN·m', toBase: 1e3 },
      { id: 'lbft', label: 'Pound-foot', symbol: 'lb·ft', toBase: 1.3558179483314004 },
      { id: 'lbin', label: 'Pound-inch', symbol: 'lb·in', toBase: 0.1129848290276167 },
      { id: 'ozin', label: 'Ounce-inch', symbol: 'oz·in', toBase: 0.007061551814226043 },
      { id: 'kgfm', label: 'Kilogram-force metre', symbol: 'kgf·m', toBase: 9.80665 },
      { id: 'kgfcm', label: 'Kilogram-force centimetre', symbol: 'kgf·cm', toBase: 0.0980665 },
      { id: 'dyncm', label: 'Dyne-centimetre', symbol: 'dyn·cm', toBase: 1e-7 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useTorqueConverter(): UseTorqueConverterReturn {
  return useUnitConverter({
    sets: TORQUE_UNITS,
    defaultUnitId: 'nm',
  });
}
