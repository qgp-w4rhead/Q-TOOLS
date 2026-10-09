/**
 * SecurityHeadersBuilder tool module - exports the lazy-loaded component
 * plus its metadata and composable.
 *
 * Generate CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy
 * headers.
 *
 * No external dependencies - pure string building.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'security-headers-builder',
    name: 'Security Headers Builder',
    description: 'Generate CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy headers.',
    category: 'security',
    icon: 'shield-check',
    keywords: ['csp', 'hsts', 'x-frame-options', 'security', 'headers', 'referrer-policy', 'permissions-policy'],
    dependencies: [],
  },
  () => import('./SecurityHeadersBuilder.vue'),
);

export { metadata };

export {
  useSecurityHeadersBuilder,
  buildHeaders,
  headersToText,
  headersToNginx,
  DEFAULT_CONFIG,
  REFERRER_POLICY_OPTIONS,
} from './useSecurityHeadersBuilder';
export type {
  SecurityHeadersConfig,
  SecurityHeader,
  UseSecurityHeadersBuilderReturn,
} from './useSecurityHeadersBuilder';

export default component;
