/**
 * BoundingBoxCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'bounding-box-calculator',
    name: 'Bounding Box Calculator',
    description: 'Calculate a bounding box (min/max lat/lon) from a center point and radius for spatial queries.',
    category: 'geo',
    icon: 'square',
    keywords: ['bounding', 'box', 'bbox', 'center', 'radius', 'lat', 'lon', 'spatial', 'query', 'geo'],
    dependencies: [],
  },
  () => import('./BoundingBoxCalculator.vue'),
);

export { metadata };

export {
  useBoundingBoxCalculator,
  calculateBoundingBox,
  formatBBox,
  formatGeoJSONBBox,
  UNIT_LABELS,
} from './useBoundingBoxCalculator';
export type {
  BBoxUnit,
  BoundingBoxResult,
  UseBoundingBoxCalculatorReturn,
} from './useBoundingBoxCalculator';

export default component;
