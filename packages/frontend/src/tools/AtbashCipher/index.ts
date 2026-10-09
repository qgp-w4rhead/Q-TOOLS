/**
 * AtbashCipher tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'atbash-cipher',
    name: 'Atbash Cipher',
    description: 'Reverse-alphabet substitution cipher (A↔Z, B↔Y, …). Self-inverse.',
    category: 'cipher',
    icon: 'key-round',
    keywords: ['atbash', 'reverse', 'alphabet', 'cipher', 'substitution', 'hebrew'],
    dependencies: [],
  },
  () => import('./AtbashCipher.vue'),
);

export { metadata };

export { useAtbashCipher, atbash } from './useAtbashCipher';
export type { UseAtbashCipherReturn } from './useAtbashCipher';

export default component;
