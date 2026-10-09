/**
 * NginxConfigBuilder tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'nginx-config-builder',
    name: 'Nginx Config Builder',
    description:
      'Visual form → Nginx reverse proxy, static site, or load balancer configuration.',
    category: 'devops',
    icon: 'server',
    keywords: ['nginx', 'config', 'reverse-proxy', 'load-balancer', 'static-site', 'upstream', 'server-block'],
    dependencies: [],
  },
  () => import('./NginxConfigBuilder.vue'),
);

export { metadata };

export {
  useNginxConfigBuilder,
  buildNginxConfig,
  defaultNginxConfig,
} from './useNginxConfigBuilder';
export type {
  NginxMode,
  NginxBackend,
  NginxConfig,
  UseNginxConfigBuilderReturn,
} from './useNginxConfigBuilder';

export default component;
