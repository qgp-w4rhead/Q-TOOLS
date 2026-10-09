/**
 * RadiationConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between radiation units across four quantities: activity (Bq, Ci,
 * dpm), absorbed dose (Gy, rad), equivalent dose (Sv, rem), and exposure
 * (C/kg, R).
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'radiation-converter',
    name: 'Radiation converter',
    description: 'Convert between radiation units: activity (Bq, Ci), absorbed dose (Gy, rad), equivalent dose (Sv, rem), exposure (R).',
    category: 'measurement',
    icon: 'radiation',
    keywords: ['radiation', 'becquerel', 'curie', 'gray', 'sievert', 'rad', 'rem', 'roentgen', 'dose', 'activity', 'exposure'],
    dependencies: [],
  },
  () => import('./RadiationConverter.vue'),
);

export { metadata };

export {
  useRadiationConverter,
  RADIATION_UNITS,
  convertRadiation,
  formatRadiation,
} from './useRadiationConverter';
export type { UseRadiationConverterReturn } from './useRadiationConverter';

export default component;
