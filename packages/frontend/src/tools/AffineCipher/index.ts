/**
 * AffineCipher tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'affine-cipher',
    name: 'Affine Cipher',
    description: 'Mathematical substitution cipher (ax + b mod 26).',
    category: 'cipher',
    icon: 'function-square',
    keywords: ['affine', 'math', 'substitution', 'cipher', 'modular', 'encrypt', 'decrypt'],
    dependencies: [],
  },
  () => import('./AffineCipher.vue'),
);

export { metadata };

export {
  useAffineCipher,
  affineEncrypt,
  affineDecrypt,
  gcd,
  modInverse,
  isValidA,
  VALID_A_VALUES,
  DEFAULT_A,
  DEFAULT_B,
} from './useAffineCipher';
export type {
  AffineMode,
  UseAffineCipherReturn,
} from './useAffineCipher';

export default component;
