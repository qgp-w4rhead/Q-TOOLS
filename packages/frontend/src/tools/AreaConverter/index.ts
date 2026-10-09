/**
 * AreaConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between metric and imperial area units: square millimetre,
 * square centimetre, square metre, hectare, square kilometre, square inch,
 * square foot, square yard, acre, square mile.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'area-converter',
    name: 'Area converter',
    description: 'Convert between metric and imperial area units (mm², cm², m², ha, km², in², ft², yd², ac, mi²).',
    category: 'measurement',
    icon: 'square',
    keywords: ['area', 'surface', 'metric', 'imperial', 'square metre', 'hectare', 'acre', 'square foot', 'square mile'],
    dependencies: [],
  },
  () => import('./AreaConverter.vue'),
);

export { metadata };

export {
  useAreaConverter,
  convertArea,
  AREA_UNITS,
  formatArea,
} from './useAreaConverter';
export type { UseAreaConverterReturn } from './useAreaConverter';

export default component;
