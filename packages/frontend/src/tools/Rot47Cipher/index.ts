/**
 * Rot47Cipher tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'rot47-cipher',
    name: 'ROT47',
    description: 'ROT47 variant for ASCII printable characters (33–126). Self-inverse.',
    category: 'cipher',
    icon: 'key-round',
    keywords: ['rot47', 'rot', 'ascii', 'printable', 'cipher', 'shift', 'self-inverse'],
    dependencies: [],
  },
  () => import('./Rot47Cipher.vue'),
);

export { metadata };

export { useRot47Cipher, rot47 } from './useRot47Cipher';
export type { UseRot47CipherReturn } from './useRot47Cipher';

export default component;
