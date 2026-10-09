/**
 * ProxmoxLxcBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'proxmox-lxc-builder',
    name: 'Proxmox LXC Container Builder',
    description:
      'Generate LXC container config (arch, cores, memory, swap, rootfs, network).',
    category: 'devops',
    icon: 'box',
    keywords: ['proxmox', 'lxc', 'container', 'cores', 'memory', 'swap', 'rootfs', 'network'],
    dependencies: [],
  },
  () => import('./ProxmoxLxcBuilder.vue'),
);

export { metadata };

export {
  useProxmoxLxcBuilder,
  buildLxcConfig,
  defaultLxcConfig,
} from './useProxmoxLxcBuilder';
export type {
  LxcArch,
  LxcConfig,
  UseProxmoxLxcBuilderReturn,
} from './useProxmoxLxcBuilder';

export default component;
