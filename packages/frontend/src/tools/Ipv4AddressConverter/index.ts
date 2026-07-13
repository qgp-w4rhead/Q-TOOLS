/**
 * Ipv4AddressConverter tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies — all logic is pure TypeScript using 32-bit
 * unsigned integer arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ipv4-address-converter',
  name: 'IPv4 address converter',
  description:
    'Convert IPv4 addresses between decimal, hex, binary, octal, dotted decimal, dotted hex, dotted binary, and dotted octal.',
  category: 'network',
  icon: 'network',
  keywords: ['ipv4', 'address', 'convert', 'decimal', 'hex', 'binary', 'octal'],
  dependencies: [],
};

export {
  useIpv4AddressConverter,
  parseIpv4,
  ipv4ToInt,
  intToIpv4,
  intToHex,
  intToOctal,
  intToBinary,
  intToDottedHex,
  intToDottedBinary,
  intToDottedOctal,
  classifyIp,
  isPrivateIp,
  convertIpv4,
} from './useIpv4AddressConverter';
export type {
  Ipv4Int,
  Ipv4Octets,
  Ipv4ParseResult,
  Ipv4ConversionResult,
  UseIpv4AddressConverterReturn,
} from './useIpv4AddressConverter';

const Ipv4AddressConverter = defineAsyncComponent(
  () => import('./Ipv4AddressConverter.vue'),
);

export default Ipv4AddressConverter;
