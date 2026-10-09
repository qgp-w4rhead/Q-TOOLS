/**
 * PiiRedactor tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Mask emails, phone numbers, SSNs, credit cards, and other sensitive data
 * in text.
 *
 * No external dependencies - pure regex-based detection.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'pii-redactor',
    name: 'PII Redactor',
    description: 'Mask emails, phone numbers, SSNs, credit cards, and other sensitive data in text.',
    category: 'security',
    icon: 'eye-off',
    keywords: ['pii', 'redact', 'mask', 'email', 'phone', 'ssn', 'credit card', 'privacy', 'gdpr'],
    dependencies: [],
  },
  () => import('./PiiRedactor.vue'),
);

export { metadata };

export {
  usePiiRedactor,
  redactPii,
  DEFAULT_OPTIONS,
  PII_TYPE_LABELS,
} from './usePiiRedactor';
export type {
  PiiType,
  PiiMatch,
  PiiRedactionResult,
  PiiRedactorOptions,
  UsePiiRedactorReturn,
} from './usePiiRedactor';

export default component;
