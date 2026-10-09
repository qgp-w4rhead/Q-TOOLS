/**
 * FuelEconomyConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between fuel economy units: mpg (US), mpg (UK), L/100km, km/L.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'fuel-economy-converter',
    name: 'Fuel economy converter',
    description: 'Convert between mpg (US), mpg (UK), L/100km, and km/L.',
    category: 'measurement',
    icon: 'fuel',
    keywords: ['fuel', 'economy', 'mpg', 'miles per gallon', 'litres per 100km', 'kilometres per litre', 'consumption'],
    dependencies: [],
  },
  () => import('./FuelEconomyConverter.vue'),
);

export { metadata };

export {
  useFuelEconomyConverter,
  convertFuelEconomy,
  FUEL_ECONOMY_UNITS,
  getFuelEconomyUnitLabel,
} from './useFuelEconomyConverter';
export type {
  FuelEconomyUnit,
  UseFuelEconomyConverterReturn,
} from './useFuelEconomyConverter';

export default component;
