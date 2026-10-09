/**
 * EmailNormalizer tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * No external npm dependencies - the disposable-domain set and provider map
 * are bundled inside the composable.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'email-normalizer',
  name: 'Email normalizer',
  description: 'Normalize email addresses for comparison (lowercase, strip dots/+suffix).',
  category: 'dev',
  icon: 'mail',
  keywords: ['email', 'normalize', 'canonical', 'gmail', 'disposable', 'provider'],
  dependencies: [],
};

export {
  useEmailNormalizer,
  parseEmail,
  normalizeEmail,
  isValidEmail,
  isDisposableDomain,
  detectProvider,
} from './useEmailNormalizer';
export type {
  ParsedEmail,
  NormalizedEmail,
  UseEmailNormalizerReturn,
} from './useEmailNormalizer';

const EmailNormalizer = defineAsyncComponent(
  () => import('./EmailNormalizer.vue'),
);

export default EmailNormalizer;
