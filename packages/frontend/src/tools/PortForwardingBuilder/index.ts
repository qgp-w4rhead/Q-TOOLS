/**
 * PortForwardingBuilder tool module - exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'port-forwarding-builder',
    name: 'Port Forwarding Rule Builder',
    description:
      'Generate iptables, nftables, or SSH tunnel port-forwarding commands.',
    category: 'devops',
    icon: 'plug',
    keywords: ['port', 'forwarding', 'iptables', 'nftables', 'ssh', 'tunnel', 'nat', 'redirect'],
    dependencies: [],
  },
  () => import('./PortForwardingBuilder.vue'),
);

export { metadata };

export {
  usePortForwardingBuilder,
  buildForwardCommands,
  buildIptablesCommands,
  buildNftablesCommands,
  buildSshCommand,
  defaultPortForwardConfig,
} from './usePortForwardingBuilder';
export type {
  ForwardMethod,
  PortForwardConfig,
  UsePortForwardingBuilderReturn,
} from './usePortForwardingBuilder';

export default component;
