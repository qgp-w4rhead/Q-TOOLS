/**
 * MacAddressLookup tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external npm dependencies - the OUI database is a bundled static JSON
 * asset (lazy-loaded via dynamic import → separate Vite chunk) and all lookup
 * logic is pure TypeScript.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'mac-address-lookup',
  name: 'MAC address lookup',
  description:
    'Look up the vendor / manufacturer for a MAC address from the IEEE OUI database.',
  category: 'network',
  icon: 'network',
  keywords: ['mac', 'oui', 'vendor', 'manufacturer', 'lookup', 'ieee'],
  dependencies: [],
};

export {
  useMacAddressLookup,
  loadOuiDatabase,
  parseMac,
  normalizeMac,
  formatMac,
  ouiFromOctets,
  isMulticast,
  isLocallyAdministered,
  isBroadcast,
  lookupVendor,
  resolveMacLookup,
} from './useMacAddressLookup';
export type {
  MacOctets,
  MacSeparator,
  ParsedMac,
  MacLookupResult,
  UseMacAddressLookupReturn,
} from './useMacAddressLookup';

const MacAddressLookup = defineAsyncComponent(
  () => import('./MacAddressLookup.vue'),
);

export default MacAddressLookup;
