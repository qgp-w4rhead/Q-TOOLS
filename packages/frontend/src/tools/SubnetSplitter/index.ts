/**
 * SubnetSplitter tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript using 32-bit
 * unsigned integer arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'subnet-splitter',
  name: 'Subnet splitter / VLSM planner',
  description:
    'Split a CIDR into N equal subnets or plan VLSM allocations by required host counts.',
  category: 'network',
  icon: 'scissors',
  keywords: ['subnet', 'split', 'vlsm', 'cidr', 'network', 'planner', 'ipv4'],
  dependencies: [],
};

export {
  useSubnetSplitter,
  parseIpv4,
  intToIpv4,
  prefixToMask,
  parseBaseCidr,
  usableHosts,
  splitEqual,
  planVlsm,
  hostsToPrefix,
  parseHostCounts,
  MAX_SUBNETS,
} from './useSubnetSplitter';
export type {
  Ipv4Int,
  SubnetAllocation,
  SplitResult,
  SplitMode,
  UseSubnetSplitterReturn,
} from './useSubnetSplitter';

const SubnetSplitter = defineAsyncComponent(
  () => import('./SubnetSplitter.vue'),
);

export default SubnetSplitter;
