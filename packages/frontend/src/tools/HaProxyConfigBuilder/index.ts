/**
 * HaProxyConfigBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'haproxy-config-builder',
    name: 'HAProxy Config Builder',
    description:
      'Form → HAProxy frontend/backend config (ACLs, backends, SSL, stats).',
    category: 'devops',
    icon: 'server',
    keywords: ['haproxy', 'load-balancer', 'frontend', 'backend', 'acl', 'ssl', 'stats', 'proxy'],
    dependencies: [],
  },
  () => import('./HaProxyConfigBuilder.vue'),
);

export { metadata };

export {
  useHaProxyConfigBuilder,
  buildHaProxyConfig,
  defaultHaProxyConfig,
} from './useHaProxyConfigBuilder';
export type {
  HaProxyBackend,
  HaProxyConfig,
  UseHaProxyConfigBuilderReturn,
} from './useHaProxyConfigBuilder';

export default component;
