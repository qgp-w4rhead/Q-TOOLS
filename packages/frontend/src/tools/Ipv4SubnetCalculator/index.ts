/**
 * Ipv4SubnetCalculator tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript using 32-bit
 * unsigned integer arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ipv4-subnet-calculator',
  name: 'IPv4 subnet calculator',
  description:
    'Calculate IPv4 subnets from CIDR notation or a subnet mask (network, broadcast, hosts, wildcard, binary).',
  category: 'network',
  icon: 'network',
  keywords: ['ipv4', 'subnet', 'cidr', 'network', 'mask', 'broadcast', 'wildcard'],
  dependencies: [],
};

export {
  useIpv4SubnetCalculator,
  parseIpv4,
  parseCidr,
  parseSubnetMask,
  maskToPrefix,
  prefixToMask,
  intToIpv4,
  ipv4ToInt,
  intToBinary,
  classifyIp,
  isPrivateIp,
  calculateSubnet,
} from './useIpv4SubnetCalculator';
export type {
  Ipv4Int,
  Ipv4Octets,
  Ipv4ParseResult,
  CidrParseResult,
  MaskParseResult,
  SubnetResult,
  UseIpv4SubnetCalculatorReturn,
} from './useIpv4SubnetCalculator';

const Ipv4SubnetCalculator = defineAsyncComponent(
  () => import('./Ipv4SubnetCalculator.vue'),
);

export default Ipv4SubnetCalculator;
