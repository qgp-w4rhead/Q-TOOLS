/**
 * ViscosityConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between dynamic viscosity units (Pa·s, mPa·s, poise, centipoise,
 * lb/(ft·s), lbf·s/ft², reyn) and kinematic viscosity units (m²/s, mm²/s,
 * stokes, centistokes, ft²/s, in²/s, m²/h).
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'viscosity-converter',
    name: 'Viscosity converter',
    description: 'Convert between dynamic (Pa·s, poise, cP) and kinematic (St, cSt, ft²/s) viscosity units.',
    category: 'measurement',
    icon: 'droplets',
    keywords: ['viscosity', 'dynamic', 'kinematic', 'pascal second', 'poise', 'centipoise', 'stokes', 'centistokes', 'cst'],
    dependencies: [],
  },
  () => import('./ViscosityConverter.vue'),
);

export { metadata };

export {
  useViscosityConverter,
  VISCOSITY_UNITS,
  convertViscosity,
  formatViscosity,
} from './useViscosityConverter';
export type { UseViscosityConverterReturn } from './useViscosityConverter';

export default component;
