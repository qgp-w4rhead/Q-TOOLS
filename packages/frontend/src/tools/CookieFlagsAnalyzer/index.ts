/**
 * CookieFlagsAnalyzer tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'cookie-flags-analyzer',
    name: 'Cookie Flags Analyzer',
    description:
      'Analyze Set-Cookie headers for missing Secure, HttpOnly, SameSite flags and scope issues.',
    category: 'security',
    icon: 'cookie',
    keywords: [
      'cookie', 'set-cookie', 'secure', 'httponly', 'samesite', 'flags',
      'session', 'security', 'analyzer',
    ],
    dependencies: [],
  },
  () => import('./CookieFlagsAnalyzer.vue'),
);

export { metadata };

export {
  useCookieFlagsAnalyzer,
  splitSetCookieLines,
  parseSetCookie,
  analyzeCookie,
  analyzeCookies,
} from './useCookieFlagsAnalyzer';
export type {
  CookieAttribute,
  ParsedCookie,
  CookieIssue,
  CookieAnalysis,
  UseCookieFlagsAnalyzerReturn,
} from './useCookieFlagsAnalyzer';

export default component;
