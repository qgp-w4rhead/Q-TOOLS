/**
 * CookingConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between cooking volume measures: US/metric/imperial teaspoons,
 * tablespoons and cups, fluid ounces, sticks of butter, dash, pinch, drop.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'cooking-converter',
    name: 'Cooking measures converter',
    description: 'Convert between cooking measures (tsp, tbsp, cup US/UK/metric, fl oz, stick, dash, pinch, drop).',
    category: 'measurement',
    icon: 'chef-hat',
    keywords: ['cooking', 'baking', 'teaspoon', 'tablespoon', 'cup', 'fluid ounce', 'stick', 'dash', 'pinch', 'drop', 'recipe'],
    dependencies: [],
  },
  () => import('./CookingConverter.vue'),
);

export { metadata };

export { useCookingConverter, COOKING_UNITS, convertCooking, formatCooking } from './useCookingConverter';
export type { UseCookingConverterReturn } from './useCookingConverter';

export default component;
