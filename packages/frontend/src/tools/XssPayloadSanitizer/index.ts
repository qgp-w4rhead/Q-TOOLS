/**
 * XssPayloadSanitizer tool module - exports the lazy-loaded component plus
 * its metadata and composable.
 *
 * Test HTML input against XSS vectors with allowlist-based filtering.
 *
 * No external dependencies - DOMParser + allowlist filtering.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'xss-payload-sanitizer',
    name: 'XSS Payload Sanitizer',
    description: 'Test HTML input against XSS vectors with allowlist-based filtering.',
    category: 'security',
    icon: 'shield-alert',
    keywords: ['xss', 'sanitize', 'html', 'security', 'allowlist', 'filter', 'payload', 'injection'],
    dependencies: [],
  },
  () => import('./XssPayloadSanitizer.vue'),
);

export { metadata };

export {
  useXssPayloadSanitizer,
  sanitizeHtml,
  DEFAULT_OPTIONS,
  DEFAULT_ALLOWED_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
} from './useXssPayloadSanitizer';
export type {
  XssSanitizerOptions,
  XssFinding,
  XssSanitizerResult,
  UseXssPayloadSanitizerReturn,
} from './useXssPayloadSanitizer';

export default component;
