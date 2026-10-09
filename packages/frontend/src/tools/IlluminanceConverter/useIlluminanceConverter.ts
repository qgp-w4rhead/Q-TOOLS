/**
 * useIlluminanceConverter - composable + unit definitions for the
 * illuminance converter.
 *
 * Converts between illuminance units using the lux (lx) as the base unit:
 * lux, kilolux, foot-candle, lumen per square metre, lumen per square foot,
 * phot, and nox.
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
  convertUnit as convertIlluminance,
  formatUnitValue as formatIlluminance,
} from '@/composables/useUnitConverter';

export type UseIlluminanceConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const ILLUMINANCE_UNITS: UnitSet[] = [
  {
    id: 'illuminance',
    label: 'Illuminance',
    units: [
      { id: 'lx', label: 'Lux', symbol: 'lx', toBase: 1 },
      { id: 'klx', label: 'Kilolux', symbol: 'klx', toBase: 1e3 },
      { id: 'mlx', label: 'Millilux', symbol: 'mlx', toBase: 1e-3 },
      { id: 'fc', label: 'Foot-candle', symbol: 'fc', toBase: 10.763910416709722 },
      { id: 'lm_m2', label: 'Lumen per square metre', symbol: 'lm/m²', toBase: 1 },
      { id: 'lm_ft2', label: 'Lumen per square foot', symbol: 'lm/ft²', toBase: 10.763910416709722 },
      { id: 'ph', label: 'Phot', symbol: 'ph', toBase: 1e4 },
      { id: 'nx', label: 'Nox', symbol: 'nx', toBase: 1e-3 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useIlluminanceConverter(): UseIlluminanceConverterReturn {
  return useUnitConverter({
    sets: ILLUMINANCE_UNITS,
    defaultUnitId: 'lx',
  });
}
