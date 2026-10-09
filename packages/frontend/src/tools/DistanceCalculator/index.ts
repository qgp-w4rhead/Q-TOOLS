/**
 * DistanceCalculator tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'distance-calculator',
    name: 'Distance Calculator',
    description: 'Calculate great-circle distance between two coordinate pairs using Haversine or Vincenty formula.',
    category: 'geo',
    icon: 'ruler',
    keywords: ['distance', 'haversine', 'vincenty', 'great-circle', 'coordinates', 'lat', 'lon', 'km', 'mile'],
    dependencies: [],
  },
  () => import('./DistanceCalculator.vue'),
);

export { metadata };

export {
  useDistanceCalculator,
  haversineDistance,
  vincentyDistance,
  calculateBearing,
  calculateDistance,
  formatDistance,
  formatBearing,
} from './useDistanceCalculator';
export type {
  DistanceFormula,
  DistanceUnit,
  DistanceResult,
  UseDistanceCalculatorReturn,
} from './useDistanceCalculator';

export default component;
