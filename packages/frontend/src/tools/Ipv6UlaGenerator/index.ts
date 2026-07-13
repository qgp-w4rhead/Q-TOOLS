/**
 * Ipv6UlaGenerator tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external npm dependencies — randomness comes from the Web Crypto API
 * (`crypto.getRandomValues()`). IPv6 compression follows RFC 5952.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ipv6-ula-generator',
  name: 'IPv6 ULA generator',
  description:
    'Generate IPv6 Unique Local Addresses (RFC 4193) with a random 40-bit Global ID and 16-bit Subnet ID via the Web Crypto API.',
  category: 'network',
  icon: 'network',
  keywords: ['ipv6', 'ula', 'local', 'generate', 'rfc4193', 'fd00', 'prefix'],
  dependencies: [],
};

export {
  useIpv6UlaGenerator,
  randomBytes,
  bytesToHex,
  generateGlobalId,
  generateSubnetId,
  parsePrefixInput,
  parseSubnetIdInput,
  formatIpv6Groups,
  buildUla,
  generateUla,
  generateUlas,
  clampQuantity,
  DEFAULT_ULA_OPTIONS,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useIpv6UlaGenerator';
export type {
  UlaPrefixBytes,
  SubnetIdBytes,
  UlaGeneratorOptions,
  UlaResult,
  UseIpv6UlaGeneratorReturn,
} from './useIpv6UlaGenerator';

const Ipv6UlaGenerator = defineAsyncComponent(
  () => import('./Ipv6UlaGenerator.vue'),
);

export default Ipv6UlaGenerator;
