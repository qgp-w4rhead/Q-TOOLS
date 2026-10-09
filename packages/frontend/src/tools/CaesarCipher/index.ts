/**
 * CaesarCipher tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'caesar-cipher',
    name: 'Caesar / ROT Cipher',
    description: 'Bidirectional shift cipher with configurable rotation (ROT13 default).',
    category: 'cipher',
    icon: 'key-round',
    keywords: ['caesar', 'rot', 'rot13', 'shift', 'cipher', 'encrypt', 'decrypt', 'substitution'],
    dependencies: [],
  },
  () => import('./CaesarCipher.vue'),
);

export { metadata };

export {
  useCaesarCipher,
  caesarShiftChar,
  caesarShift,
  caesarEncrypt,
  caesarDecrypt,
  caesarBruteForce,
  DEFAULT_SHIFT,
  MIN_SHIFT,
  MAX_SHIFT,
} from './useCaesarCipher';
export type {
  CaesarMode,
  BruteForceRow,
  UseCaesarCipherReturn,
} from './useCaesarCipher';

export default component;
