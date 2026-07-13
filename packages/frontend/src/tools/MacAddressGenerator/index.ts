/**
 * MacAddressGenerator tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external npm dependencies — randomness comes from the Web Crypto API
 * (`crypto.getRandomValues()`).
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'mac-address-generator',
  name: 'MAC address generator',
  description:
    'Generate cryptographically secure random MAC-48 addresses with configurable case, separator, and IEEE 802 U/L + multicast bits.',
  category: 'network',
  icon: 'network',
  keywords: ['mac', 'generate', 'random', 'oui', 'locally-administered', 'multicast'],
  dependencies: [],
};

export {
  useMacAddressGenerator,
  randomOctets,
  applyMacBits,
  formatMacOctets,
  generateMac,
  generateMacs,
  clampQuantity,
  DEFAULT_MAC_OPTIONS,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useMacAddressGenerator';
export type {
  MacOctets,
  MacSeparator,
  MacCase,
  MacGeneratorOptions,
  UseMacAddressGeneratorReturn,
} from './useMacAddressGenerator';

const MacAddressGenerator = defineAsyncComponent(
  () => import('./MacAddressGenerator.vue'),
);

export default MacAddressGenerator;
