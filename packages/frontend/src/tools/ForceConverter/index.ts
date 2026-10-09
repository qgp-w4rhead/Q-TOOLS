/**
 * ForceConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between force units: newton, kilonewton, meganewton, dyne,
 * pound-force, kilogram-force, poundal, and kip.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'force-converter',
    name: 'Force converter',
    description: 'Convert between force units (N, kN, MN, dyn, lbf, kgf, pdl, kip).',
    category: 'measurement',
    icon: 'move-horizontal',
    keywords: ['force', 'newton', 'kilonewton', 'dyne', 'pound-force', 'lbf', 'kilogram-force', 'kgf', 'poundal', 'kip'],
    dependencies: [],
  },
  () => import('./ForceConverter.vue'),
);

export { metadata };

export { useForceConverter, FORCE_UNITS, convertForce, formatForce } from './useForceConverter';
export type { UseForceConverterReturn } from './useForceConverter';

export default component;
