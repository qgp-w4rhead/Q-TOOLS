/**
 * useProxmoxLxcBuilder - composable + pure logic for generating Proxmox LXC
 * container configurations.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export type LxcArch = 'amd64' | 'arm64' | 'armhf' | 'i386';

export interface LxcConfig {
  ctId: number;
  hostname: string;
  arch: LxcArch;
  cores: number;
  memory: number;
  swap: number;
  rootStorage: string;
  rootSize: string;
  netType: 'veth' | 'vlan';
  netBridge: string;
  netIp: string;
  netGateway: string;
  netDns: string;
  osType: string;
  onboot: boolean;
  protection: boolean;
  unprivileged: boolean;
  features: string;
}

export function defaultLxcConfig(): LxcConfig {
  return {
    ctId: 200,
    hostname: 'ct-200',
    arch: 'amd64',
    cores: 2,
    memory: 1024,
    swap: 512,
    rootStorage: 'local-lvm',
    rootSize: '8G',
    netType: 'veth',
    netBridge: 'vmbr0',
    netIp: '192.168.1.200/24',
    netGateway: '192.168.1.1',
    netDns: '8.8.8.8',
    osType: 'debian',
    onboot: false,
    protection: false,
    unprivileged: true,
    features: 'keyctl=1,nesting=1',
  };
}

export function buildLxcConfig(cfg: LxcConfig): string {
  const lines: string[] = [];

  lines.push(`# ${cfg.hostname} - Proxmox LXC container config`);
  lines.push(`# Create with: pct create ${cfg.ctId} ${cfg.osType} ...`);
  lines.push('');
  lines.push(`arch: ${cfg.arch}`);
  lines.push(`hostname: ${cfg.hostname}`);
  lines.push(`cores: ${cfg.cores}`);
  lines.push(`memory: ${cfg.memory}`);
  lines.push(`swap: ${cfg.swap}`);
  lines.push(`ostype: ${cfg.osType}`);

  if (cfg.onboot) lines.push('onboot: 1');
  if (cfg.protection) lines.push('protection: 1');
  if (cfg.unprivileged) lines.push('unprivileged: 1');
  if (cfg.features) lines.push(`features: ${cfg.features}`);

  // Root filesystem
  lines.push(`rootfs: ${cfg.rootStorage}:subvol-${cfg.ctId}-disk-0,size=${cfg.rootSize}`);

  // Network
  const netParts: string[] = [`name=eth0,type=${cfg.netType},bridge=${cfg.netBridge}`];
  if (cfg.netIp) netParts.push(`ip=${cfg.netIp}`);
  if (cfg.netGateway) netParts.push(`gw=${cfg.netGateway}`);
  lines.push(`net0: ${netParts.join(',')}`);

  if (cfg.netDns) lines.push(`nameserver: ${cfg.netDns}`);

  lines.push('');
  lines.push(`# pct create ${cfg.ctId} ${cfg.osType} \\`);
  lines.push(`#   --hostname ${cfg.hostname} \\`);
  lines.push(`#   --cores ${cfg.cores} \\`);
  lines.push(`#   --memory ${cfg.memory} \\`);
  lines.push(`#   --swap ${cfg.swap} \\`);
  lines.push(`#   --rootfs ${cfg.rootStorage}:size=${cfg.rootSize} \\`);
  lines.push(`#   --net0 ${netParts.join(',')} \\`);
  if (cfg.unprivileged) lines.push(`#   --unprivileged 1 \\`);
  if (cfg.features) lines.push(`#   --features ${cfg.features}`);

  return lines.join('\n');
}

export interface UseProxmoxLxcBuilderReturn {
  config: Ref<LxcConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof LxcConfig>(key: K, value: LxcConfig[K]) => void;
  reset: () => void;
}

export function useProxmoxLxcBuilder(): UseProxmoxLxcBuilderReturn {
  const config = ref<LxcConfig>(defaultLxcConfig());

  const output = computed(() => buildLxcConfig(config.value));

  function update<K extends keyof LxcConfig>(key: K, value: LxcConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function reset(): void {
    config.value = defaultLxcConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<LxcConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return { config, output, isEmbed, embedInput, update, reset };
}
