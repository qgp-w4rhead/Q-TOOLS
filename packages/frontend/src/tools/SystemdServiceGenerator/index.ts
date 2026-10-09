/**
 * SystemdServiceGenerator tool module - exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'systemd-service-generator',
    name: 'Systemd Service Generator',
    description:
      'Form inputs → .service unit file (ExecStart, Restart, User, Environment, etc.).',
    category: 'devops',
    icon: 'settings',
    keywords: ['systemd', 'service', 'unit', 'execstart', 'restart', 'linux', 'init'],
    dependencies: [],
  },
  () => import('./SystemdServiceGenerator.vue'),
);

export { metadata };

export {
  useSystemdServiceGenerator,
  buildSystemdUnit,
  defaultSystemdConfig,
} from './useSystemdServiceGenerator';
export type {
  SystemdType,
  RestartPolicy,
  SystemdEnvVar,
  SystemdConfig,
  UseSystemdServiceGeneratorReturn,
} from './useSystemdServiceGenerator';

export default component;
