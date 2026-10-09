/**
 * CoordinateNormalizer tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'coordinate-normalizer',
    name: 'Coordinate Format Normalizer',
    description: 'Parse and normalize various coordinate input formats to standard decimal degrees.',
    category: 'geo',
    icon: 'map-pin',
    keywords: ['coordinate', 'normalize', 'parse', 'dms', 'decimal', 'degrees', 'format', 'lat', 'lon'],
    dependencies: [],
  },
  () => import('./CoordinateNormalizer.vue'),
);

export { metadata };

export {
  useCoordinateNormalizer,
  normalizeCoordinates,
  formatDecimal,
  formatDMS,
} from './useCoordinateNormalizer';
export type {
  NormalizedCoordinate,
  NormalizeResult,
  UseCoordinateNormalizerReturn,
} from './useCoordinateNormalizer';

export default component;
