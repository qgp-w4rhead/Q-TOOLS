/**
 * VolumeConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between metric and imperial volume units: millilitre, litre,
 * cubic metre, cubic centimetre, gallon (US/UK), quart, pint, cup, fluid ounce.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'volume-converter',
    name: 'Volume converter',
    description: 'Convert between metric and imperial volume units (mL, L, m³, cm³, gal, qt, pt, cup, fl oz).',
    category: 'measurement',
    icon: 'flask-conical',
    keywords: ['volume', 'capacity', 'metric', 'imperial', 'millilitre', 'litre', 'cubic metre', 'gallon', 'quart', 'pint', 'cup', 'fluid ounce'],
    dependencies: [],
  },
  () => import('./VolumeConverter.vue'),
);

export { metadata };

export {
  useVolumeConverter,
  convertVolume,
  VOLUME_UNITS,
  formatVolume,
} from './useVolumeConverter';
export type { UseVolumeConverterReturn } from './useVolumeConverter';

export default component;
