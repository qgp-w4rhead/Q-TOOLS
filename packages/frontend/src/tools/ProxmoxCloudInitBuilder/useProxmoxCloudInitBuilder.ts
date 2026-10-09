/**
 * useProxmoxCloudInitBuilder - composable + pure logic for generating
 * cloud-init user-data and network-config for Proxmox VMs.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export interface CloudInitConfig {
  hostname: string;
  fqdn: string;
  user: string;
  password: string;
  sshKey: string;
  timezone: string;
  ip: string;
  gateway: string;
  dns: string;
  searchDomain: string;
  packages: string;
  runcmd: string;
  writeFiles: string;
}

export function defaultCloudInitConfig(): CloudInitConfig {
  return {
    hostname: 'vm-100',
    fqdn: 'vm-100.example.com',
    user: 'ubuntu',
    password: '',
    sshKey: 'ssh-rsa AAAAB3...',
    timezone: 'UTC',
    ip: '192.168.1.100/24',
    gateway: '192.168.1.1',
    dns: '8.8.8.8',
    searchDomain: 'example.com',
    packages: 'curl\ngit\nvim',
    runcmd: 'apt-get update\napt-get upgrade -y',
    writeFiles: '',
  };
}

export function buildCloudInit(cfg: CloudInitConfig): string {
  const lines: string[] = [];

  // user-data
  lines.push('#cloud-config');
  lines.push(`hostname: ${cfg.hostname}`);
  if (cfg.fqdn) lines.push(`fqdn: ${cfg.fqdn}`);
  lines.push(`manage_etc_hosts: true`);
  lines.push(`timezone: ${cfg.timezone}`);
  lines.push('');

  if (cfg.user) {
    lines.push(`users:`);
    lines.push(`  - name: ${cfg.user}`);
    lines.push(`    sudo: ALL=(ALL) NOPASSWD:ALL`);
    lines.push(`    shell: /bin/bash`);
    if (cfg.password) {
      lines.push(`    passwd: "${cfg.password}"`);
      lines.push(`    lock_passwd: false`);
    }
    if (cfg.sshKey) {
      lines.push(`    ssh_authorized_keys:`);
      lines.push(`      - ${cfg.sshKey}`);
    }
    lines.push('');
  }

  if (cfg.packages.trim()) {
    lines.push(`packages:`);
    for (const pkg of cfg.packages.split('\n').map((s) => s.trim()).filter(Boolean)) {
      lines.push(`  - ${pkg}`);
    }
    lines.push('');
  }

  if (cfg.writeFiles.trim()) {
    lines.push(cfg.writeFiles);
    lines.push('');
  }

  if (cfg.runcmd.trim()) {
    lines.push(`runcmd:`);
    for (const cmd of cfg.runcmd.split('\n').map((s) => s.trim()).filter(Boolean)) {
      lines.push(`  - ${cmd}`);
    }
    lines.push('');
  }

  // network-config
  lines.push('# ─── network-config ───');
  lines.push(`version: 2`);
  lines.push(`ethernets:`);
  lines.push(`  eth0:`);
  if (cfg.ip) {
    lines.push(`    addresses:`);
    lines.push(`      - ${cfg.ip}`);
  }
  if (cfg.gateway) lines.push(`    gateway4: ${cfg.gateway}`);
  if (cfg.dns) {
    lines.push(`    nameservers:`);
    lines.push(`      addresses: [${cfg.dns}]`);
    if (cfg.searchDomain) lines.push(`      search: [${cfg.searchDomain}]`);
  }

  return lines.join('\n');
}

export interface UseProxmoxCloudInitBuilderReturn {
  config: Ref<CloudInitConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof CloudInitConfig>(key: K, value: CloudInitConfig[K]) => void;
  reset: () => void;
}

export function useProxmoxCloudInitBuilder(): UseProxmoxCloudInitBuilderReturn {
  const config = ref<CloudInitConfig>(defaultCloudInitConfig());

  const output = computed(() => buildCloudInit(config.value));

  function update<K extends keyof CloudInitConfig>(key: K, value: CloudInitConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function reset(): void {
    config.value = defaultCloudInitConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<CloudInitConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return { config, output, isEmbed, embedInput, update, reset };
}
