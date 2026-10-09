/**
 * BaconCipher tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'bacon-cipher',
    name: 'Bacon Cipher',
    description: 'Binary steganography using a/b patterns (5-bit encoding).',
    category: 'cipher',
    icon: 'key-round',
    keywords: ['bacon', 'binary', 'steganography', 'cipher', '5-bit', 'encode', 'decode'],
    dependencies: [],
  },
  () => import('./BaconCipher.vue'),
);

export { metadata };

export {
  useBaconCipher,
  baconEncrypt,
  baconDecrypt,
  BACON_MAP_26,
  DEFAULT_SEPARATOR,
} from './useBaconCipher';
export type { BaconMode, UseBaconCipherReturn } from './useBaconCipher';

export default component;
