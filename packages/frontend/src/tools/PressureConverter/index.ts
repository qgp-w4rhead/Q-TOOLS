/**
 * PressureConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between common pressure units: pascal, kilopascal, megapascal,
 * bar, atmosphere, psi, mmHg, torr.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'pressure-converter',
    name: 'Pressure converter',
    description: 'Convert between Pa, kPa, MPa, bar, atm, psi, mmHg, and torr.',
    category: 'measurement',
    icon: 'gauge',
    keywords: ['pressure', 'pascal', 'bar', 'atmosphere', 'psi', 'mmhg', 'torr', 'kilopascal', 'megapascal'],
    dependencies: [],
  },
  () => import('./PressureConverter.vue'),
);

export { metadata };

export {
  usePressureConverter,
  convertPressure,
  PRESSURE_UNITS,
  formatPressure,
} from './usePressureConverter';
export type { UsePressureConverterReturn } from './usePressureConverter';

export default component;
