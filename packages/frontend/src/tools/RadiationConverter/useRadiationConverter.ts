/**
 * useRadiationConverter - composable + unit definitions for the radiation
 * converter.
 *
 * Four quantity modes:
 *  - Activity, base unit becquerel (Bq): Bq, kBq, MBq, GBq, TBq, Ci, mCi,
 *    µCi, dpm.
 *  - Absorbed dose, base unit gray (Gy): Gy, mGy, µGy, rad, mrad.
 *  - Equivalent dose, base unit sievert (Sv): Sv, mSv, µSv, rem, mrem.
 *  - Exposure, base unit coulomb per kilogram (C/kg): C/kg, mC/kg, R, mR.
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
  convertUnit as convertRadiation,
  formatUnitValue as formatRadiation,
} from '@/composables/useUnitConverter';

export type UseRadiationConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const RADIATION_UNITS: UnitSet[] = [
  {
    id: 'activity',
    label: 'Activity',
    units: [
      { id: 'bq', label: 'Becquerel', symbol: 'Bq', toBase: 1 },
      { id: 'kbq', label: 'Kilobecquerel', symbol: 'kBq', toBase: 1e3 },
      { id: 'mbq', label: 'Megabecquerel', symbol: 'MBq', toBase: 1e6 },
      { id: 'gbq', label: 'Gigabecquerel', symbol: 'GBq', toBase: 1e9 },
      { id: 'tbq', label: 'Terabecquerel', symbol: 'TBq', toBase: 1e12 },
      { id: 'ci', label: 'Curie', symbol: 'Ci', toBase: 3.7e10 },
      { id: 'mci', label: 'Millicurie', symbol: 'mCi', toBase: 3.7e7 },
      { id: 'uci', label: 'Microcurie', symbol: 'µCi', toBase: 3.7e4 },
      { id: 'dpm', label: 'Disintegrations per minute', symbol: 'dpm', toBase: 1 / 60 },
    ],
  },
  {
    id: 'absorbed',
    label: 'Absorbed dose',
    units: [
      { id: 'gy', label: 'Gray', symbol: 'Gy', toBase: 1 },
      { id: 'mgy', label: 'Milligray', symbol: 'mGy', toBase: 1e-3 },
      { id: 'ugy', label: 'Microgray', symbol: 'µGy', toBase: 1e-6 },
      { id: 'rad', label: 'Rad', symbol: 'rad', toBase: 0.01 },
      { id: 'mrad', label: 'Millirad', symbol: 'mrad', toBase: 1e-5 },
    ],
  },
  {
    id: 'equivalent',
    label: 'Equivalent dose',
    units: [
      { id: 'sv', label: 'Sievert', symbol: 'Sv', toBase: 1 },
      { id: 'msv', label: 'Millisievert', symbol: 'mSv', toBase: 1e-3 },
      { id: 'usv', label: 'Microsievert', symbol: 'µSv', toBase: 1e-6 },
      { id: 'rem', label: 'Rem', symbol: 'rem', toBase: 0.01 },
      { id: 'mrem', label: 'Millirem', symbol: 'mrem', toBase: 1e-5 },
    ],
  },
  {
    id: 'exposure',
    label: 'Exposure',
    units: [
      { id: 'c_kg', label: 'Coulomb per kilogram', symbol: 'C/kg', toBase: 1 },
      { id: 'mc_kg', label: 'Millicoulomb per kilogram', symbol: 'mC/kg', toBase: 1e-3 },
      { id: 'r', label: 'Roentgen', symbol: 'R', toBase: 2.58e-4 },
      { id: 'mr', label: 'Milliroentgen', symbol: 'mR', toBase: 2.58e-7 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useRadiationConverter(): UseRadiationConverterReturn {
  return useUnitConverter({
    sets: RADIATION_UNITS,
    defaultSetId: 'activity',
    defaultUnitId: 'bq',
  });
}
