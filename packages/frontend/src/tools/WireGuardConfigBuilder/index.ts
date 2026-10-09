/**
 * WireGuardConfigBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'wireguard-config-builder',
    name: 'WireGuard Config Generator',
    description:
      'Generate WireGuard server and client configs with key pair generation.',
    category: 'devops',
    icon: 'shield',
    keywords: ['wireguard', 'vpn', 'config', 'server', 'client', 'key', 'peer', 'tunnel'],
    dependencies: [],
  },
  () => import('./WireGuardConfigBuilder.vue'),
);

export { metadata };

export {
  useWireGuardConfigBuilder,
  buildServerConfig,
  buildClientConfig,
  defaultWireGuardConfig,
} from './useWireGuardConfigBuilder';
export type {
  WireGuardPeer,
  WireGuardConfig,
  UseWireGuardConfigBuilderReturn,
} from './useWireGuardConfigBuilder';

export default component;
