/**
 * HashText tool module — exports the lazy-loaded component plus its metadata
 * and composable so the tool can be registered in the registry and routed
 * dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'hash-text',
  name: 'Hash text',
  description: 'Hash text with MD5, SHA-1/256/384/512, SHA3, Blake3.',
  category: 'crypto',
  icon: 'hash',
  keywords: ['md5', 'sha1', 'sha256', 'sha512', 'sha3', 'blake3', 'digest'],
  dependencies: ['hash-wasm'],
};

export {
  useHashText,
  computeHash,
  computeHashes,
  hashWithWebCrypto,
  hashWithWasm,
  toHex,
  encodeUtf8,
  ALGORITHMS,
  ALGORITHM_MAP,
  DEFAULT_ALGORITHMS,
  DEFAULT_CONFIG,
} from './useHashText';
export type {
  HashAlgorithm,
  AlgorithmInfo,
  HashResult,
  HashTextConfig,
  UseHashTextReturn,
} from './useHashText';

const HashText = defineAsyncComponent(() => import('./HashText.vue'));

export default HashText;
