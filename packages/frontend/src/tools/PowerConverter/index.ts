/**
 * PowerConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between power units: watt, kilowatt, megawatt, mechanical/metric/
 * electric horsepower, BTU per hour, foot-pound per second, and ton of
 * refrigeration.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'power-converter',
    name: 'Power converter',
    description: 'Convert between power units (W, kW, MW, hp, PS, BTU/h, ft·lb/s, ton of refrigeration).',
    category: 'measurement',
    icon: 'zap',
    keywords: ['power', 'watt', 'kilowatt', 'megawatt', 'horsepower', 'hp', 'btu', 'foot-pound', 'ton of refrigeration'],
    dependencies: [],
  },
  () => import('./PowerConverter.vue'),
);

export { metadata };

export { usePowerConverter, POWER_UNITS, convertPower, formatPower } from './usePowerConverter';
export type { UsePowerConverterReturn } from './usePowerConverter';

export default component;
