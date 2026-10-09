/**
 * HmacGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'hmac-generator',
  name: 'HMAC generator',
  description: 'Generate HMAC signatures (SHA-1/256/384/512).',
  category: 'crypto',
  icon: 'shield-check',
  keywords: ['hmac', 'signature', 'sha', 'mac'],
  dependencies: [],
};

export {
  useHmacGenerator,
  computeHmac,
  computeHmacBytes,
  toHex,
  toBase64,
  encodeUtf8,
  ALGORITHMS,
  ALGORITHM_MAP,
  DEFAULT_ALGORITHM,
  DEFAULT_CONFIG,
} from './useHmacGenerator';
export type {
  HmacAlgorithm,
  HmacAlgorithmInfo,
  HmacResult,
  HmacGeneratorConfig,
  UseHmacGeneratorReturn,
} from './useHmacGenerator';

const HmacGenerator = defineAsyncComponent(() => import('./HmacGenerator.vue'));

export default HmacGenerator;
