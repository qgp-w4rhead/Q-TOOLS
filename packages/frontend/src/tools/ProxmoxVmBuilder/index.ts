/**
 * ProxmoxVmBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'proxmox-vm-builder',
    name: 'Proxmox VM Builder',
    description:
      'Form → QEMU VM config (CPU cores, memory, disk, net0, SCSI controller, boot order).',
    category: 'devops',
    icon: 'server',
    keywords: ['proxmox', 'qemu', 'vm', 'virtual machine', 'cpu', 'memory', 'disk', 'scsi', 'boot'],
    dependencies: [],
  },
  () => import('./ProxmoxVmBuilder.vue'),
);

export { metadata };

export {
  useProxmoxVmBuilder,
  buildVmConfig,
  defaultVmConfig,
} from './useProxmoxVmBuilder';
export type {
  ScsiController,
  NetModel,
  BridgeMode,
  VmConfig,
  UseProxmoxVmBuilderReturn,
} from './useProxmoxVmBuilder';

export default component;
