/**
 * CorsPolicyTester tool module - exports the lazy-loaded component plus its
 * metadata and composable.
 *
 * Validate and test CORS configurations; generate Access-Control-* headers.
 *
 * No external dependencies - pure string building and validation.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'cors-policy-tester',
    name: 'CORS Policy Tester',
    description: 'Validate and test CORS configurations; generate Access-Control-* headers.',
    category: 'security',
    icon: 'globe',
    keywords: ['cors', 'access-control', 'origin', 'preflight', 'cross-origin', 'headers'],
    dependencies: [],
  },
  () => import('./CorsPolicyTester.vue'),
);

export { metadata };

export {
  useCorsPolicyTester,
  analyzeCors,
  ALL_METHODS,
  COMMON_HEADERS,
  DEFAULT_CONFIG,
} from './useCorsPolicyTester';
export type {
  CorsConfig,
  CorsHeader,
  CorsAnalysis,
  UseCorsPolicyTesterReturn,
} from './useCorsPolicyTester';

export default component;
