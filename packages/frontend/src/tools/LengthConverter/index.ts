/**
 * LengthConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between metric and imperial length units: millimetre, centimetre,
 * metre, kilometre, inch, foot, yard, mile, nautical mile.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'length-converter',
    name: 'Length converter',
    description: 'Convert between metric and imperial length units (mm, cm, m, km, in, ft, yd, mi, nmi).',
    category: 'measurement',
    icon: 'ruler',
    keywords: ['length', 'distance', 'metric', 'imperial', 'millimetre', 'centimetre', 'metre', 'kilometre', 'inch', 'foot', 'yard', 'mile', 'nautical'],
    dependencies: [],
  },
  () => import('./LengthConverter.vue'),
);

export { metadata };

export {
  useLengthConverter,
  convertLength,
  LENGTH_UNITS,
  formatLength,
} from './useLengthConverter';
export type { UseLengthConverterReturn } from './useLengthConverter';

export default component;
