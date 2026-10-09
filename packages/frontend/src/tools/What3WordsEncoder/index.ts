/**
 * What3WordsEncoder tool module.
 *
 * Requires a what3words API key from the user.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'what3words-encoder',
    name: 'What3Words Encoder',
    description: 'Convert lat/lon coordinates to and from three-word addresses using the what3words API.',
    category: 'geo',
    icon: 'map-pin',
    keywords: ['what3words', 'w3w', 'three', 'word', 'address', 'lat', 'lon', 'geocode', 'api'],
    dependencies: [],
  },
  () => import('./What3WordsEncoder.vue'),
);

export { metadata };

export {
  useWhat3WordsEncoder,
  isValid3WA,
} from './useWhat3WordsEncoder';
export type {
  W3WMode,
  W3WResult,
  UseWhat3WordsEncoderReturn,
} from './useWhat3WordsEncoder';

export default component;
