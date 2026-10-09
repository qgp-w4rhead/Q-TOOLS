/**
 * DensityConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between density units: kg/m³, g/cm³, g/mL, g/L, lb/ft³, lb/in³,
 * lb/gal (US/UK), oz/in³, and oz/gal (US).
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'density-converter',
    name: 'Density converter',
    description: 'Convert between density units (kg/m³, g/cm³, g/mL, lb/ft³, lb/in³, lb/gal, oz/in³).',
    category: 'measurement',
    icon: 'flask-conical',
    keywords: ['density', 'kg/m3', 'g/cm3', 'specific gravity', 'pound per cubic foot', 'pound per gallon', 'mass per volume'],
    dependencies: [],
  },
  () => import('./DensityConverter.vue'),
);

export { metadata };

export { useDensityConverter, DENSITY_UNITS, convertDensity, formatDensity } from './useDensityConverter';
export type { UseDensityConverterReturn } from './useDensityConverter';

export default component;
