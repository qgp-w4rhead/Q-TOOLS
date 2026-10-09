/**
 * RailFenceCipher tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'rail-fence-cipher',
    name: 'Rail Fence Cipher',
    description: 'Transposition cipher with configurable rail count.',
    category: 'cipher',
    icon: 'key-round',
    keywords: ['rail', 'fence', 'zigzag', 'transposition', 'cipher', 'encrypt', 'decrypt'],
    dependencies: [],
  },
  () => import('./RailFenceCipher.vue'),
);

export { metadata };

export {
  useRailFenceCipher,
  railFenceEncrypt,
  railFenceDecrypt,
  DEFAULT_RAILS,
  MIN_RAILS,
  MAX_RAILS,
} from './useRailFenceCipher';
export type {
  RailFenceMode,
  UseRailFenceCipherReturn,
} from './useRailFenceCipher';

export default component;
