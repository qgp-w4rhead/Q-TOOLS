/**
 * Ipv6SubnetCalculator tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Calculate IPv6 subnet details from an address and prefix length:
 * network address, range, total addresses, and compressed/expanded forms.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ipv6-subnet-calculator',
  name: 'IPv6 subnet calculator',
  description: 'Calculate IPv6 subnet details from an address and prefix length.',
  category: 'network',
  icon: 'network',
  keywords: ['ipv6', 'subnet', 'cidr', 'prefix', 'network', 'address', 'range'],
  dependencies: [],
};

export {
  useIpv6SubnetCalculator,
  parseIpv6,
  expandIpv6,
  compressIpv6,
  calculateIpv6Subnet,
} from './useIpv6SubnetCalculator';
export type {
  UseIpv6SubnetCalculatorReturn,
} from './useIpv6SubnetCalculator';

const Ipv6SubnetCalculator = defineAsyncComponent(
  () => import('./Ipv6SubnetCalculator.vue'),
);

export default Ipv6SubnetCalculator;
