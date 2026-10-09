/**
 * AccelerationConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between acceleration units: m/s², cm/s², ft/s², in/s², standard
 * gravity (g), galileo (Gal), km/h per second, and mph per second.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'acceleration-converter',
    name: 'Acceleration converter',
    description: 'Convert between acceleration units (m/s², ft/s², in/s², g-force, Gal, km/h·s, mph/s).',
    category: 'measurement',
    icon: 'trending-up',
    keywords: ['acceleration', 'metre per second squared', 'g-force', 'gravity', 'galileo', 'gal', 'ft/s2'],
    dependencies: [],
  },
  () => import('./AccelerationConverter.vue'),
);

export { metadata };

export {
  useAccelerationConverter,
  ACCELERATION_UNITS,
  convertAcceleration,
  formatAcceleration,
} from './useAccelerationConverter';
export type { UseAccelerationConverterReturn } from './useAccelerationConverter';

export default component;
