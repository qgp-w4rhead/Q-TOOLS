/**
 * RdapLookup tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - uses the browser `fetch` API against rdap.org.
 * Requires network access at runtime.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'rdap-lookup',
  name: 'RDAP / WHOIS lookup',
  description:
    'Look up domain or IP registration data (registrar, dates, nameservers) via RDAP.',
  category: 'network',
  icon: 'globe',
  keywords: ['rdap', 'whois', 'domain', 'registration', 'registrar', 'nameserver', 'ip'],
  dependencies: [],
};

export {
  useRdapLookup,
  detectQueryType,
  buildRdapUrl,
  vcardField,
  parseRdapResponse,
} from './useRdapLookup';
export type {
  RdapQueryType,
  RdapEvent,
  RdapEntity,
  RdapResult,
  UseRdapLookupReturn,
} from './useRdapLookup';

const RdapLookup = defineAsyncComponent(
  () => import('./RdapLookup.vue'),
);

export default RdapLookup;
