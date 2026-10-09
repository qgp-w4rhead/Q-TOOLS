/**
 * IpClassifier tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript over 32-bit
 * integers and 8-hextet arrays.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ip-classifier',
  name: 'IP address classifier',
  description:
    'Classify an IP as private, loopback, link-local, multicast, CGNAT, or reserved with its RFC range.',
  category: 'network',
  icon: 'tag',
  keywords: ['ip', 'classify', 'private', 'loopback', 'link-local', 'multicast', 'cgnat', 'reserved', 'rfc'],
  dependencies: [],
};

export {
  useIpClassifier,
  parseIpv4,
  intToIpv4,
  parseIpv6,
  compressIpv6,
  classifyIpv4,
  classifyIpv6,
  classifyIp,
} from './useIpClassifier';
export type {
  Ipv4Int,
  Ipv6Hextets,
  IpScope,
  IpClassification,
  UseIpClassifierReturn,
} from './useIpClassifier';

const IpClassifier = defineAsyncComponent(
  () => import('./IpClassifier.vue'),
);

export default IpClassifier;
