/**
 * PermissionsPolicyBuilder tool module - exports the lazy-loaded component
 * plus its metadata and composable so the tool can be registered in the
 * registry and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'permissions-policy-builder',
    name: 'Permissions-Policy Builder',
    description:
      'Build a Permissions-Policy header (camera, microphone, geolocation, etc.) from a form.',
    category: 'security',
    icon: 'shield-check',
    keywords: [
      'permissions-policy', 'feature-policy', 'header', 'camera', 'microphone',
      'geolocation', 'http', 'security headers',
    ],
    dependencies: [],
  },
  () => import('./PermissionsPolicyBuilder.vue'),
);

export { metadata };

export {
  usePermissionsPolicyBuilder,
  buildAllowlist,
  buildHeader,
  headerToNginx,
  headerToApache,
  defaultPolicies,
  FEATURES,
} from './usePermissionsPolicyBuilder';
export type {
  AllowlistMode,
  FeaturePolicy,
  FeatureDef,
  UsePermissionsPolicyBuilderReturn,
} from './usePermissionsPolicyBuilder';

export default component;
