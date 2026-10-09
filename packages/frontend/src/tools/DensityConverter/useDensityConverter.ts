/**
 * useDensityConverter - composable + unit definitions for the density
 * converter.
 *
 * Converts between density units using kilogram per cubic metre (kg/m³) as
 * the base unit: kg/m³, g/cm³, g/mL, g/L, lb/ft³, lb/in³, lb/gal (US and
 * UK), and oz/in³.
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
  convertUnit as convertDensity,
  formatUnitValue as formatDensity,
} from '@/composables/useUnitConverter';

export type UseDensityConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const DENSITY_UNITS: UnitSet[] = [
  {
    id: 'density',
    label: 'Density',
    units: [
      { id: 'kg_m3', label: 'Kilogram per cubic metre', symbol: 'kg/m³', toBase: 1 },
      { id: 'g_cm3', label: 'Gram per cubic centimetre', symbol: 'g/cm³', toBase: 1000 },
      { id: 'g_ml', label: 'Gram per millilitre', symbol: 'g/mL', toBase: 1000 },
      { id: 'g_l', label: 'Gram per litre', symbol: 'g/L', toBase: 1 },
      { id: 'lb_ft3', label: 'Pound per cubic foot', symbol: 'lb/ft³', toBase: 16.01846337396014 },
      { id: 'lb_in3', label: 'Pound per cubic inch', symbol: 'lb/in³', toBase: 27679.90471019142 },
      { id: 'lb_gal_us', label: 'Pound per gallon (US)', symbol: 'lb/gal US', toBase: 119.82642731689664 },
      { id: 'lb_gal_uk', label: 'Pound per gallon (UK)', symbol: 'lb/gal UK', toBase: 99.7763726631017 },
      { id: 'oz_in3', label: 'Ounce per cubic inch', symbol: 'oz/in³', toBase: 1729.9940443869638 },
      { id: 'oz_gal_us', label: 'Ounce per gallon (US)', symbol: 'oz/gal US', toBase: 7.48915170730604 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useDensityConverter(): UseDensityConverterReturn {
  return useUnitConverter({
    sets: DENSITY_UNITS,
    defaultUnitId: 'kg_m3',
  });
}
