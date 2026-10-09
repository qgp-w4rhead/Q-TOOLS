/**
 * AngleConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between angle units: degree, radian, gradian, turn, arcminute,
 * arcsecond.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'angle-converter',
    name: 'Angle converter',
    description: 'Convert between degrees, radians, gradians, turns, arcminutes, and arcseconds.',
    category: 'measurement',
    icon: 'compass',
    keywords: ['angle', 'degree', 'radian', 'gradian', 'turn', 'arcminute', 'arcsecond', 'geometry'],
    dependencies: [],
  },
  () => import('./AngleConverter.vue'),
);

export { metadata };

export {
  useAngleConverter,
  convertAngle,
  ANGLE_UNITS,
  formatAngle,
} from './useAngleConverter';
export type { UseAngleConverterReturn } from './useAngleConverter';

export default component;
