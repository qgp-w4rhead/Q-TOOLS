/**
 * Ipv6Compressor tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript over 8-hextet
 * arrays.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ipv6-compressor',
  name: 'IPv6 compressor / expander',
  description:
    'Convert IPv6 addresses between canonical, full, and IPv4-mapped forms.',
  category: 'network',
  icon: 'shrink',
  keywords: ['ipv6', 'compress', 'expand', 'canonical', 'rfc5952', 'ipv4-mapped'],
  dependencies: [],
};

export {
  useIpv6Compressor,
  parseIpv6,
  expandIpv6,
  uncompressedIpv6,
  compressIpv6,
  isIpv4Mapped,
  embeddedIpv4,
  toIpv4Mapped,
  toIpv4Compatible,
  convertIpv6,
} from './useIpv6Compressor';
export type {
  Ipv6Hextets,
  Ipv6ParseResult,
  Ipv6ConvertResult,
  UseIpv6CompressorReturn,
} from './useIpv6Compressor';

const Ipv6Compressor = defineAsyncComponent(
  () => import('./Ipv6Compressor.vue'),
);

export default Ipv6Compressor;
