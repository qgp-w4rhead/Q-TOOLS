/**
 * useFlowRateConverter - composable + unit definitions for the volumetric
 * flow rate converter.
 *
 * Converts between flow rate units using litre per second (L/s) as the
 * base unit: L/s, L/min, L/h, m³/s, m³/h, US and UK gallons per minute,
 * cubic feet per minute (cfm), and cubic feet per second.
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
  convertUnit as convertFlowRate,
  formatUnitValue as formatFlowRate,
} from '@/composables/useUnitConverter';

export type UseFlowRateConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const FLOW_RATE_UNITS: UnitSet[] = [
  {
    id: 'flow',
    label: 'Flow rate',
    units: [
      { id: 'l_s', label: 'Litre per second', symbol: 'L/s', toBase: 1 },
      { id: 'l_min', label: 'Litre per minute', symbol: 'L/min', toBase: 1 / 60 },
      { id: 'l_h', label: 'Litre per hour', symbol: 'L/h', toBase: 1 / 3600 },
      { id: 'ml_s', label: 'Millilitre per second', symbol: 'mL/s', toBase: 1e-3 },
      { id: 'm3_s', label: 'Cubic metre per second', symbol: 'm³/s', toBase: 1000 },
      { id: 'm3_h', label: 'Cubic metre per hour', symbol: 'm³/h', toBase: 1000 / 3600 },
      { id: 'gpm_us', label: 'Gallon per minute (US)', symbol: 'gpm US', toBase: 3.785411784 / 60 },
      { id: 'gpm_uk', label: 'Gallon per minute (UK)', symbol: 'gpm UK', toBase: 4.54609 / 60 },
      { id: 'cfm', label: 'Cubic foot per minute', symbol: 'cfm', toBase: 28.316846592 / 60 },
      { id: 'ft3_s', label: 'Cubic foot per second', symbol: 'ft³/s', toBase: 28.316846592 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useFlowRateConverter(): UseFlowRateConverterReturn {
  return useUnitConverter({
    sets: FLOW_RATE_UNITS,
    defaultUnitId: 'l_s',
  });
}
