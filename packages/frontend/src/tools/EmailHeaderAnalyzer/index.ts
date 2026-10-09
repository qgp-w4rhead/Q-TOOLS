/**
 * EmailHeaderAnalyzer tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'email-header-analyzer',
    name: 'Email Header Analyzer',
    description:
      'Parse raw email headers: Received chain, per-hop delays, and SPF/DKIM/DMARC results.',
    category: 'security',
    icon: 'mail',
    keywords: [
      'email', 'header', 'analyzer', 'received', 'spf', 'dkim', 'dmarc',
      'deliverability', 'phishing', 'trace',
    ],
    dependencies: [],
  },
  () => import('./EmailHeaderAnalyzer.vue'),
);

export { metadata };

export {
  useEmailHeaderAnalyzer,
  parseHeaderFields,
  getAll,
  getFirst,
  parseReceived,
  parseReceivedChain,
  parseAuthResults,
  parseIdentity,
  analyzeHeaders,
  formatDelay,
} from './useEmailHeaderAnalyzer';
export type {
  HeaderField,
  ReceivedHop,
  AuthResults,
  AuthVerdict,
  IdentityHeaders,
  EmailHeaderResult,
  UseEmailHeaderAnalyzerReturn,
} from './useEmailHeaderAnalyzer';

export default component;
