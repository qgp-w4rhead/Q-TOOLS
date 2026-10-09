/**
 * WolPacketBuilder tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - all logic is pure TypeScript over byte arrays.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'wol-packet-builder',
  name: 'Wake-on-LAN packet builder',
  description:
    'Build a WoL magic packet (hex + base64) and generate wakeonlan/etherwake CLI commands.',
  category: 'network',
  icon: 'send',
  keywords: ['wol', 'wake-on-lan', 'magic packet', 'wakeonlan', 'etherwake', 'mac', 'broadcast'],
  dependencies: [],
};

export {
  useWolPacketBuilder,
  parseMac,
  formatMac,
  buildMagicPacket,
  packetToHex,
  packetToBase64,
  parseBroadcast,
  parsePort,
  buildCliCommands,
  buildWolResult,
} from './useWolPacketBuilder';
export type {
  MacOctets,
  WolCommands,
  WolResult,
  UseWolPacketBuilderReturn,
} from './useWolPacketBuilder';

const WolPacketBuilder = defineAsyncComponent(
  () => import('./WolPacketBuilder.vue'),
);

export default WolPacketBuilder;
