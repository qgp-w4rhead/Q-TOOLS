/**
 * ClothingSizeConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Clothing and shoe size conversion tables: men's/women's/kids' shoes
 * (US/UK/EU/JP) and men's/women's tops (US/UK/EU/Intl).
 *
 * No external dependencies - bundled tables only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'clothing-size-converter',
    name: 'Clothing & shoe size converter',
    description: 'Convert clothing and shoe sizes between US, UK, EU, and JP systems (men, women, kids).',
    category: 'measurement',
    icon: 'shirt',
    keywords: ['clothing', 'shoe', 'size', 'us', 'uk', 'eu', 'jp', 'men', 'women', 'kids', 'apparel'],
    dependencies: [],
  },
  () => import('./ClothingSizeConverter.vue'),
);

export { metadata };

export {
  useClothingSizeConverter,
  SIZE_TABLES,
} from './useClothingSizeConverter';
export type { SizeTable, UseClothingSizeConverterReturn } from './useClothingSizeConverter';

export default component;
