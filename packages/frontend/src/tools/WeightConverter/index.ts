/**
 * WeightConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between metric and imperial weight units: milligram, gram,
 * kilogram, metric ton, ounce, pound, stone, US ton, tonne.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'weight-converter',
    name: 'Weight converter',
    description: 'Convert between metric and imperial weight units (mg, g, kg, t, oz, lb, st, ton).',
    category: 'measurement',
    icon: 'scale',
    keywords: ['weight', 'mass', 'metric', 'imperial', 'milligram', 'gram', 'kilogram', 'ton', 'ounce', 'pound', 'stone'],
    dependencies: [],
  },
  () => import('./WeightConverter.vue'),
);

export { metadata };

export {
  useWeightConverter,
  convertWeight,
  WEIGHT_UNITS,
  formatWeight,
} from './useWeightConverter';
export type { UseWeightConverterReturn } from './useWeightConverter';

export default component;
