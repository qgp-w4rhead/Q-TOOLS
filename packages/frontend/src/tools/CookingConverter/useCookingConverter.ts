/**
 * useCookingConverter - composable + unit definitions for the cooking
 * measures converter.
 *
 * Converts between cooking volume units using the millilitre (mL) as the
 * base unit: US/metric/imperial teaspoons, tablespoons and cups, fluid
 * ounces, sticks of butter, dash, pinch, and drop.
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
  convertUnit as convertCooking,
  formatUnitValue as formatCooking,
} from '@/composables/useUnitConverter';

export type UseCookingConverterReturn = UseUnitConverterReturn;

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const COOKING_UNITS: UnitSet[] = [
  {
    id: 'cooking',
    label: 'Cooking measures',
    units: [
      { id: 'ml', label: 'Millilitre', symbol: 'mL', toBase: 1 },
      { id: 'l', label: 'Litre', symbol: 'L', toBase: 1000 },
      { id: 'tsp_us', label: 'Teaspoon (US)', symbol: 'tsp US', toBase: 4.92892159375 },
      { id: 'tsp_metric', label: 'Teaspoon (metric)', symbol: 'tsp', toBase: 5 },
      { id: 'tsp_uk', label: 'Teaspoon (UK)', symbol: 'tsp UK', toBase: 5.919388020833333 },
      { id: 'tbsp_us', label: 'Tablespoon (US)', symbol: 'tbsp US', toBase: 14.78676478125 },
      { id: 'tbsp_metric', label: 'Tablespoon (metric)', symbol: 'tbsp', toBase: 15 },
      { id: 'tbsp_uk', label: 'Tablespoon (UK)', symbol: 'tbsp UK', toBase: 17.7581640625 },
      { id: 'cup_us', label: 'Cup (US)', symbol: 'cup US', toBase: 236.5882365 },
      { id: 'cup_metric', label: 'Cup (metric)', symbol: 'cup', toBase: 250 },
      { id: 'cup_uk', label: 'Cup (UK)', symbol: 'cup UK', toBase: 284.130625 },
      { id: 'floz_us', label: 'Fluid ounce (US)', symbol: 'fl oz US', toBase: 29.5735295625 },
      { id: 'floz_uk', label: 'Fluid ounce (UK)', symbol: 'fl oz UK', toBase: 28.4130625 },
      { id: 'stick', label: 'Stick of butter (US)', symbol: 'stick', toBase: 118.29411825 },
      { id: 'dash', label: 'Dash', symbol: 'dash', toBase: 0.61611519921875 },
      { id: 'pinch', label: 'Pinch', symbol: 'pinch', toBase: 0.308057599609375 },
      { id: 'drop', label: 'Drop', symbol: 'drop', toBase: 0.05 },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useCookingConverter(): UseCookingConverterReturn {
  return useUnitConverter({
    sets: COOKING_UNITS,
    defaultUnitId: 'ml',
  });
}
