/**
 * DnsRecordLookup tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'dns-record-lookup',
    name: 'DNS Record Lookup',
    description:
      'Query A/AAAA/MX/TXT/NS/CNAME/CAA records via DNS-over-HTTPS (Cloudflare/Google).',
    category: 'devops',
    icon: 'globe',
    keywords: ['dns', 'lookup', 'doh', 'cloudflare', 'google', 'a', 'aaaa', 'mx', 'txt', 'ns', 'cname', 'caa'],
    dependencies: [],
  },
  () => import('./DnsRecordLookup.vue'),
);

export { metadata };

export {
  useDnsRecordLookup,
  buildDohUrl,
  buildDohHeaders,
  parseDohResponse,
  formatRecordType,
} from './useDnsRecordLookup';
export type {
  DnsRecordType,
  DohProvider,
  DnsAnswer,
  DnsResult,
  UseDnsRecordLookupReturn,
} from './useDnsRecordLookup';

export default component;
