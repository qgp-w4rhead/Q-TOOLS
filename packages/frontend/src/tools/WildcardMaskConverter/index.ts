/**
 * WildcardMaskConverter tool module - exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers so the tool can be registered in
 * the registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript using 32-bit
 * unsigned integer arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'wildcard-mask-converter',
  name: 'Wildcard mask converter',
  description:
    'Convert between subnet mask, wildcard mask, and CIDR prefix (Cisco ACL style).',
  category: 'network',
  icon: 'flip-horizontal',
  keywords: ['wildcard', 'mask', 'subnet', 'cidr', 'acl', 'cisco', 'inverse'],
  dependencies: [],
};

export {
  useWildcardMaskConverter,
  parseIpv4,
  intToIpv4,
  intToBinary,
  prefixToMask,
  maskToPrefix,
  wildcardToPrefix,
  convert,
} from './useWildcardMaskConverter';
export type {
  Ipv4Int,
  MaskMode,
  WildcardResult,
  UseWildcardMaskConverterReturn,
} from './useWildcardMaskConverter';

const WildcardMaskConverter = defineAsyncComponent(
  () => import('./WildcardMaskConverter.vue'),
);

export default WildcardMaskConverter;
