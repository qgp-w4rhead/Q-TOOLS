/**
 * MacNormalizer tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript over byte arrays.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'mac-normalizer',
  name: 'MAC address normalizer',
  description:
    'Convert between colon/hyphen/dot/Cisco MAC formats; detect locally-administered and multicast bits.',
  category: 'network',
  icon: 'repeat',
  keywords: ['mac', 'normalize', 'format', 'cisco', 'colon', 'hyphen', 'oui', 'eui48'],
  dependencies: [],
};

export {
  useMacNormalizer,
  parseMac,
  formatMac,
  macToInt,
  macToBinary,
  isMulticast,
  isLocallyAdministered,
  isBroadcast,
  normalizeMacInput,
} from './useMacNormalizer';
export type {
  MacOctets,
  MacSeparator,
  MacNormalizeResult,
  UseMacNormalizerReturn,
} from './useMacNormalizer';

const MacNormalizer = defineAsyncComponent(
  () => import('./MacNormalizer.vue'),
);

export default MacNormalizer;
