/**
 * EnergyConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between common energy units: joule, kilojoule, calorie, kilocalorie,
 * watt-hour, kilowatt-hour, BTU, foot-pound.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'energy-converter',
    name: 'Energy converter',
    description: 'Convert between J, kJ, cal, kcal, Wh, kWh, BTU, and ft·lb.',
    category: 'measurement',
    icon: 'zap',
    keywords: ['energy', 'joule', 'kilojoule', 'calorie', 'kilocalorie', 'watt-hour', 'kilowatt-hour', 'btu', 'foot-pound'],
    dependencies: [],
  },
  () => import('./EnergyConverter.vue'),
);

export { metadata };

export {
  useEnergyConverter,
  convertEnergy,
  ENERGY_UNITS,
  formatEnergy,
} from './useEnergyConverter';
export type { UseEnergyConverterReturn } from './useEnergyConverter';

export default component;
