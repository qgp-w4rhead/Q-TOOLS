/**
 * CidrAggregator tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript using 32-bit
 * unsigned integer arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'cidr-aggregator',
  name: 'CIDR aggregator',
  description:
    'Merge a list of CIDRs, ranges, and IPs into minimal covering blocks.',
  category: 'network',
  icon: 'merge',
  keywords: ['cidr', 'aggregate', 'merge', 'summarize', 'supernet', 'ipv4', 'range'],
  dependencies: [],
};

export {
  useCidrAggregator,
  parseIpv4,
  intToIpv4,
  parseEntry,
  mergeIntervals,
  rangeToCidrs,
  aggregate,
} from './useCidrAggregator';
export type {
  Ipv4Int,
  IpInterval,
  CidrBlock,
  ParseError,
  AggregateResult,
  UseCidrAggregatorReturn,
} from './useCidrAggregator';

const CidrAggregator = defineAsyncComponent(
  () => import('./CidrAggregator.vue'),
);

export default CidrAggregator;
