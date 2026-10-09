/**
 * XorCipher tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'xor-cipher',
    name: 'XOR Cipher',
    description: 'Simple XOR encryption/decryption with a key string.',
    category: 'cipher',
    icon: 'binary',
    keywords: ['xor', 'cipher', 'encrypt', 'decrypt', 'key', 'hex', 'binary'],
    dependencies: [],
  },
  () => import('./XorCipher.vue'),
);

export { metadata };

export {
  useXorCipher,
  xorBytes,
  xorEncrypt,
  xorDecrypt,
  bytesToHex,
  hexToBytes,
} from './useXorCipher';
export type {
  XorInputFormat,
  UseXorCipherReturn,
} from './useXorCipher';

export default component;
