/**
 * useProxmoxVmBuilder - composable + pure logic for generating Proxmox QEMU
 * VM configurations.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export type ScsiController = 'lsi' | 'virtio-scsi-pci' | 'virtio-scsi-single' | 'megasas' | 'pvscsi';
export type NetModel = 'virtio' | 'e1000' | 'rtl8139' | 'vmxnet3';
export type BridgeMode = 'bridge' | 'nat';

export interface VmConfig {
  vmId: number;
  name: string;
  cores: number;
  memory: number;
  sockets: number;
  cpuType: string;
  bios: 'seabios' | 'ovmf';
  bootOrder: string;
  scsihw: ScsiController;
  diskStorage: string;
  diskSize: number;
  diskFormat: 'raw' | 'qcow2' | 'vmdk';
  netModel: NetModel;
  netBridge: string;
  netVlan: string;
  osType: string;
  onboot: boolean;
  protection: boolean;
  agent: boolean;
}

export function defaultVmConfig(): VmConfig {
  return {
    vmId: 100,
    name: 'vm-100',
    cores: 2,
    memory: 2048,
    sockets: 1,
    cpuType: 'host',
    bios: 'seabios',
    bootOrder: 'c',
    scsihw: 'virtio-scsi-pci',
    diskStorage: 'local-lvm',
    diskSize: 32,
    diskFormat: 'raw',
    netModel: 'virtio',
    netBridge: 'vmbr0',
    netVlan: '',
    osType: 'l26',
    onboot: false,
    protection: false,
    agent: false,
  };
}

export function buildVmConfig(cfg: VmConfig): string {
  const lines: string[] = [];

  lines.push(`# ${cfg.name} - Proxmox VM config`);
  lines.push(`# Create with: qm create ${cfg.vmId}`);
  lines.push('');
  lines.push(`name: ${cfg.name}`);
  lines.push(`cores: ${cfg.cores}`);
  lines.push(`memory: ${cfg.memory}`);
  lines.push(`sockets: ${cfg.sockets}`);
  lines.push(`cpu: ${cfg.cpuType}`);
  lines.push(`bios: ${cfg.bios}`);
  lines.push(`boot: ${cfg.bootOrder}`);
  lines.push(`scsihw: ${cfg.scsihw}`);
  lines.push(`ostype: ${cfg.osType}`);

  if (cfg.onboot) lines.push('onboot: 1');
  if (cfg.protection) lines.push('protection: 1');
  if (cfg.agent) lines.push('agent: 1');

  // Disk
  const diskFormat = cfg.diskFormat === 'raw' ? '' : `,format=${cfg.diskFormat}`;
  lines.push(`scsi0: ${cfg.diskStorage}:vm-${cfg.vmId}-disk-0${diskFormat},size=${cfg.diskSize}G`);

  // Network
  let net0 = `model=${cfg.netModel},bridge=${cfg.netBridge}`;
  if (cfg.netVlan) net0 += `,tag=${cfg.netVlan}`;
  lines.push(`net0: ${net0}`);

  lines.push('');
  lines.push(`# qm set ${cfg.vmId} --name ${cfg.name}`);
  lines.push(`# qm set ${cfg.vmId} --cores ${cfg.cores}`);
  lines.push(`# qm set ${cfg.vmId} --memory ${cfg.memory}`);
  lines.push(`# qm set ${cfg.vmId} --scsi0 ${cfg.diskStorage}:vm-${cfg.vmId}-disk-0,size=${cfg.diskSize}G`);
  lines.push(`# qm set ${cfg.vmId} --net0 ${net0}`);

  return lines.join('\n');
}

export interface UseProxmoxVmBuilderReturn {
  config: Ref<VmConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof VmConfig>(key: K, value: VmConfig[K]) => void;
  reset: () => void;
}

export function useProxmoxVmBuilder(): UseProxmoxVmBuilderReturn {
  const config = ref<VmConfig>(defaultVmConfig());

  const output = computed(() => buildVmConfig(config.value));

  function update<K extends keyof VmConfig>(key: K, value: VmConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function reset(): void {
    config.value = defaultVmConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<VmConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return { config, output, isEmbed, embedInput, update, reset };
}
