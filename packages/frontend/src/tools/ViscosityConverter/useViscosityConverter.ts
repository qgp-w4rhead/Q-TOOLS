/**
 * useViscosityConverter - composable + unit definitions for the viscosity
 * converter.
 *
 * Two quantity modes:
 *  - Dynamic (absolute) viscosity, base unit pascal-second (Pa·s):
 *    Pa·s, mPa·s, poise, centipoise, kg/(m·s), lb/(ft·s), lbf·s/ft².
 *  - Kinematic viscosity, base unit square metre per second (m²/s):
 *    m²/s, mm²/s, stokes, centistokes, ft²/s, in²/s, m²/h.
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
  convertUnit as convertViscosity,
  formatUnitValue as formatViscosity,
} from '@/composables/useUnitConverter';

export type UseViscosityConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const VISCOSITY_UNITS: UnitSet[] = [
  {
    id: 'dynamic',
    label: 'Dynamic',
    units: [
      { id: 'pa_s', label: 'Pascal-second', symbol: 'Pa·s', toBase: 1 },
      { id: 'mpa_s', label: 'Millipascal-second', symbol: 'mPa·s', toBase: 1e-3 },
      { id: 'p', label: 'Poise', symbol: 'P', toBase: 0.1 },
      { id: 'cp', label: 'Centipoise', symbol: 'cP', toBase: 1e-3 },
      { id: 'kg_ms', label: 'Kilogram per metre-second', symbol: 'kg/(m·s)', toBase: 1 },
      { id: 'lb_fts', label: 'Pound per foot-second', symbol: 'lb/(ft·s)', toBase: 1.4881639435695542 },
      { id: 'lbf_s_ft2', label: 'Pound-force second per square foot', symbol: 'lbf·s/ft²', toBase: 47.88025898033584 },
      { id: 'reyn', label: 'Reyn (lbf·s/in²)', symbol: 'reyn', toBase: 6894.757293168361 },
    ],
  },
  {
    id: 'kinematic',
    label: 'Kinematic',
    units: [
      { id: 'm2_s', label: 'Square metre per second', symbol: 'm²/s', toBase: 1 },
      { id: 'mm2_s', label: 'Square millimetre per second', symbol: 'mm²/s', toBase: 1e-6 },
      { id: 'st', label: 'Stokes', symbol: 'St', toBase: 1e-4 },
      { id: 'cst', label: 'Centistokes', symbol: 'cSt', toBase: 1e-6 },
      { id: 'ft2_s', label: 'Square foot per second', symbol: 'ft²/s', toBase: 0.09290304 },
      { id: 'in2_s', label: 'Square inch per second', symbol: 'in²/s', toBase: 6.4516e-4 },
      { id: 'm2_h', label: 'Square metre per hour', symbol: 'm²/h', toBase: 1 / 3600 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useViscosityConverter(): UseViscosityConverterReturn {
  return useUnitConverter({
    sets: VISCOSITY_UNITS,
    defaultSetId: 'dynamic',
    defaultUnitId: 'pa_s',
  });
}
