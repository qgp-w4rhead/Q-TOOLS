/**
 * IlluminanceConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between illuminance units: lux, kilolux, millilux, foot-candle,
 * lumen per square metre/foot, phot, and nox.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'illuminance-converter',
    name: 'Illuminance converter',
    description: 'Convert between illuminance units (lux, foot-candle, lm/m², lm/ft², phot, nox).',
    category: 'measurement',
    icon: 'sun',
    keywords: ['illuminance', 'lux', 'foot-candle', 'lumen', 'phot', 'nox', 'light', 'brightness'],
    dependencies: [],
  },
  () => import('./IlluminanceConverter.vue'),
);

export { metadata };

export {
  useIlluminanceConverter,
  ILLUMINANCE_UNITS,
  convertIlluminance,
  formatIlluminance,
} from './useIlluminanceConverter';
export type { UseIlluminanceConverterReturn } from './useIlluminanceConverter';

export default component;
