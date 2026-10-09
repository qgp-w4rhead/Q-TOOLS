/**
 * Eui64Calculator tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript over byte arrays.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'eui-64-calculator',
  name: 'EUI-64 calculator',
  description:
    'Convert a MAC address to an IPv6 link-local / modified EUI-64 interface identifier.',
  category: 'network',
  icon: 'calculator',
  keywords: ['eui64', 'eui-64', 'mac', 'ipv6', 'link-local', 'interface id', 'slaac'],
  dependencies: [],
};

export {
  useEui64Calculator,
  parseMac,
  macToEui64,
  formatEui64,
  formatEui64Colon,
  iidToHextets,
  compressIpv6,
  parsePrefix64,
  buildEui64,
} from './useEui64Calculator';
export type {
  MacOctets,
  Eui64Bytes,
  Ipv6Hextets,
  Eui64Result,
  UseEui64CalculatorReturn,
} from './useEui64Calculator';

const Eui64Calculator = defineAsyncComponent(
  () => import('./Eui64Calculator.vue'),
);

export default Eui64Calculator;
