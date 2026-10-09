/**
 * MailAuthRecordBuilder tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'mail-auth-record-builder',
    name: 'SPF / DKIM / DMARC Builder',
    description:
      'Build and validate SPF, DKIM, and DMARC DNS TXT records for email authentication.',
    category: 'security',
    icon: 'mail-check',
    keywords: [
      'spf', 'dkim', 'dmarc', 'email', 'dns', 'txt', 'record', 'mail',
      'authentication', 'domainkey',
    ],
    dependencies: [],
  },
  () => import('./MailAuthRecordBuilder.vue'),
);

export { metadata };

export {
  useMailAuthRecordBuilder,
  buildSpf,
  validateSpf,
  buildDkim,
  validateDkim,
  dkimRecordName,
  buildDmarc,
  validateDmarc,
  dmarcRecordName,
  detectRecordKind,
  DEFAULT_SPF,
  DEFAULT_DKIM,
  DEFAULT_DMARC,
} from './useMailAuthRecordBuilder';
export type {
  SpfConfig,
  SpfQualifier,
  DkimConfig,
  DmarcConfig,
  DmarcPolicy,
  ValidationIssue,
  MailAuthTab,
  UseMailAuthRecordBuilderReturn,
} from './useMailAuthRecordBuilder';

export default component;
