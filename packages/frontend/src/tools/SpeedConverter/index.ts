/**
 * SpeedConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between speed units: metres per second, kilometres per hour,
 * miles per hour, knots, feet per second, mach.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'speed-converter',
    name: 'Speed converter',
    description: 'Convert between m/s, km/h, mph, knots, ft/s, and Mach.',
    category: 'measurement',
    icon: 'gauge',
    keywords: ['speed', 'velocity', 'metres per second', 'kilometres per hour', 'miles per hour', 'knots', 'feet per second', 'mach'],
    dependencies: [],
  },
  () => import('./SpeedConverter.vue'),
);

export { metadata };

export {
  useSpeedConverter,
  convertSpeed,
  SPEED_UNITS,
  formatSpeed,
} from './useSpeedConverter';
export type { UseSpeedConverterReturn } from './useSpeedConverter';

export default component;
