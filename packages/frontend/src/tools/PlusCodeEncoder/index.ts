/**
 * PlusCodeEncoder tool module.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'plus-code-encoder',
    name: 'Plus Code Encoder / Decoder',
    description: 'Encode and decode lat/lon coordinates to Open Location Code (Plus Code) format.',
    category: 'geo',
    icon: 'map-pin',
    keywords: ['plus', 'code', 'open', 'location', 'olc', 'encode', 'decode', 'lat', 'lon', 'google'],
    dependencies: [],
  },
  () => import('./PlusCodeEncoder.vue'),
);

export { metadata };

export {
  usePlusCodeEncoder,
  encodePlusCode,
  decodePlusCode,
  isValidPlusCode,
  computePlusCode,
} from './usePlusCodeEncoder';
export type {
  PlusCodeResult,
  UsePlusCodeEncoderReturn,
} from './usePlusCodeEncoder';

export default component;
