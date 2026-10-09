/**
 * VigenereCipher tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'vigenere-cipher',
    name: 'Vigenère Cipher',
    description: 'Polyalphabetic substitution cipher with a keyword.',
    category: 'cipher',
    icon: 'key-round',
    keywords: ['vigenere', 'polyalphabetic', 'keyword', 'cipher', 'encrypt', 'decrypt', 'substitution'],
    dependencies: [],
  },
  () => import('./VigenereCipher.vue'),
);

export { metadata };

export {
  useVigenereCipher,
  vigenereEncrypt,
  vigenereDecrypt,
  sanitizeKeyword,
} from './useVigenereCipher';
export type {
  VigenereMode,
  UseVigenereCipherReturn,
} from './useVigenereCipher';

export default component;
