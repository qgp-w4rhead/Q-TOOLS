/**
 * usePowerConverter - composable + unit definitions for the power converter.
 *
 * Converts between power units using the watt (W) as the base unit:
 * watt, kilowatt, megawatt, milliwatt, mechanical/metric/electric
 * horsepower, BTU per hour, foot-pound per second, and ton of refrigeration.
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
  convertUnit as convertPower,
  formatUnitValue as formatPower,
} from '@/composables/useUnitConverter';

export type UsePowerConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const POWER_UNITS: UnitSet[] = [
  {
    id: 'power',
    label: 'Power',
    units: [
      { id: 'mw_', label: 'Milliwatt', symbol: 'mW', toBase: 1e-3 },
      { id: 'w', label: 'Watt', symbol: 'W', toBase: 1 },
      { id: 'kw', label: 'Kilowatt', symbol: 'kW', toBase: 1e3 },
      { id: 'mw', label: 'Megawatt', symbol: 'MW', toBase: 1e6 },
      { id: 'hp', label: 'Horsepower (mechanical)', symbol: 'hp', toBase: 745.69987158227022 },
      { id: 'hp_metric', label: 'Horsepower (metric)', symbol: 'PS', toBase: 735.49875 },
      { id: 'hp_electric', label: 'Horsepower (electric)', symbol: 'hp(E)', toBase: 746 },
      { id: 'btu_h', label: 'BTU per hour', symbol: 'BTU/h', toBase: 0.2930710701722222 },
      { id: 'ftlb_s', label: 'Foot-pound per second', symbol: 'ft·lb/s', toBase: 1.3558179483314004 },
      { id: 'ton_ref', label: 'Ton of refrigeration', symbol: 'TR', toBase: 3516.8528420667 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function usePowerConverter(): UsePowerConverterReturn {
  return useUnitConverter({
    sets: POWER_UNITS,
    defaultUnitId: 'w',
  });
}
