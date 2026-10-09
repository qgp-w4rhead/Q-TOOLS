/**
 * GeohashEncoder tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'geohash-encoder',
    name: 'Geohash Encoder / Decoder',
    description: 'Encode and decode lat/lon coordinates to geohash strings with configurable precision.',
    category: 'geo',
    icon: 'hash',
    keywords: ['geohash', 'encode', 'decode', 'lat', 'lon', 'precision', 'base32', 'geocode'],
    dependencies: [],
  },
  () => import('./GeohashEncoder.vue'),
);

export { metadata };

export {
  useGeohashEncoder,
  encodeGeohash,
  decodeGeohash,
  isValidGeohash,
  computeGeohash,
} from './useGeohashEncoder';
export type {
  GeohashResult,
  UseGeohashEncoderReturn,
} from './useGeohashEncoder';

export default component;
