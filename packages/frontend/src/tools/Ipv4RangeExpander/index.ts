/**
 * Ipv4RangeExpander tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies — all logic is pure TypeScript using 32-bit
 * unsigned integer arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ipv4-range-expander',
  name: 'IPv4 range expander',
  description:
    'Expand an IPv4 range (start-end or CIDR) into the minimal list of CIDR blocks that cover it.',
  category: 'network',
  icon: 'network',
  keywords: ['ipv4', 'range', 'cidr', 'expand', 'subnet', 'network'],
  dependencies: [],
};

export {
  useIpv4RangeExpander,
  parseIpv4,
  parseCidr,
  ipv4ToInt,
  intToIpv4,
  cidrToRange,
  maxBlockSize,
  rangeToCidrs,
  parseRangeExpression,
  expandRange,
} from './useIpv4RangeExpander';
export type {
  Ipv4Int,
  Ipv4Octets,
  Ipv4ParseResult,
  CidrParseResult,
  CidrBlock,
  RangeExpansionResult,
  UseIpv4RangeExpanderReturn,
} from './useIpv4RangeExpander';

const Ipv4RangeExpander = defineAsyncComponent(
  () => import('./Ipv4RangeExpander.vue'),
);

export default Ipv4RangeExpander;
