/**
 * ProxmoxCloudInitBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'proxmox-cloud-init-builder',
    name: 'Proxmox Cloud-Init Generator',
    description:
      'Generate cloud-init user-data and network-config snippets for Proxmox VMs.',
    category: 'devops',
    icon: 'cloud',
    keywords: ['proxmox', 'cloud-init', 'user-data', 'network-config', 'vm', 'snippet', 'ci'],
    dependencies: [],
  },
  () => import('./ProxmoxCloudInitBuilder.vue'),
);

export { metadata };

export {
  useProxmoxCloudInitBuilder,
  buildCloudInit,
  defaultCloudInitConfig,
} from './useProxmoxCloudInitBuilder';
export type {
  CloudInitConfig,
  UseProxmoxCloudInitBuilderReturn,
} from './useProxmoxCloudInitBuilder';

export default component;
