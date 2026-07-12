/**
 * RsaKeyPair tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'rsa-key-pair-generator',
  name: 'RSA key pair generator',
  description: 'Generate RSA key pairs and export as PEM.',
  category: 'crypto',
  icon: 'key',
  keywords: ['rsa', 'keypair', 'pem', 'public', 'private'],
  dependencies: ['node-forge'],
};

export {
  useRsaKeyPair,
  generateRsaKeyPair,
  derToPem,
  bytesToBinaryString,
  ensureForgeModule,
  KEY_SIZES,
  KEY_SIZE_INFOS,
  KEY_SIZE_MAP,
  DEFAULT_KEY_SIZE,
} from './useRsaKeyPair';
export type {
  KeySize,
  KeySizeInfo,
  RsaKeyPairResult,
  UseRsaKeyPairReturn,
} from './useRsaKeyPair';

const RsaKeyPair = defineAsyncComponent(() => import('./RsaKeyPair.vue'));

export default RsaKeyPair;
