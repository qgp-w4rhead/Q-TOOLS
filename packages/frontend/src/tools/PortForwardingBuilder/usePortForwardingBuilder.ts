/**
 * usePortForwardingBuilder - composable + pure logic for generating
 * iptables, nftables, and SSH tunnel port-forwarding commands.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export type ForwardMethod = 'iptables' | 'nftables' | 'ssh';

export interface PortForwardConfig {
  method: ForwardMethod;
  localPort: number;
  remotePort: number;
  localInterface: string;
  remoteHost: string;
  sshUser: string;
  sshHost: string;
  bindAddress: string;
  reverse: boolean;
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export function defaultPortForwardConfig(): PortForwardConfig {
  return {
    method: 'iptables',
    localPort: 8080,
    remotePort: 80,
    localInterface: 'eth0',
    remoteHost: '127.0.0.1',
    sshUser: 'user',
    sshHost: 'remote.example.com',
    bindAddress: '0.0.0.0',
    reverse: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Pure logic - command generation                                            */
/* -------------------------------------------------------------------------- */

export function buildIptablesCommands(cfg: PortForwardConfig): string {
  const lines: string[] = [];
  lines.push('# Enable IP forwarding');
  lines.push('echo 1 > /proc/sys/net/ipv4/ip_forward');
  lines.push('');
  lines.push('# DNAT: redirect incoming traffic to remote');
  lines.push(`iptables -t nat -A PREROUTING -i ${cfg.localInterface} -p tcp --dport ${cfg.localPort} -j DNAT --to-destination ${cfg.remoteHost}:${cfg.remotePort}`);
  lines.push('');
  lines.push('# SNAT: masquerade the forwarded traffic');
  lines.push(`iptables -t nat -A POSTROUTING -d ${cfg.remoteHost} -p tcp --dport ${cfg.remotePort} -j MASQUERADE`);
  lines.push('');
  lines.push('# Allow forwarding in the filter table');
  lines.push(`iptables -A FORWARD -i ${cfg.localInterface} -o ${cfg.localInterface} -p tcp --dport ${cfg.remotePort} -j ACCEPT`);
  lines.push('');
  lines.push('# To remove rules later:');
  lines.push(`iptables -t nat -D PREROUTING -i ${cfg.localInterface} -p tcp --dport ${cfg.localPort} -j DNAT --to-destination ${cfg.remoteHost}:${cfg.remotePort}`);
  lines.push(`iptables -t nat -D POSTROUTING -d ${cfg.remoteHost} -p tcp --dport ${cfg.remotePort} -j MASQUERADE`);
  return lines.join('\n');
}

export function buildNftablesCommands(cfg: PortForwardConfig): string {
  const lines: string[] = [];
  lines.push('# Enable IP forwarding');
  lines.push('echo 1 > /proc/sys/net/ipv4/ip_forward');
  lines.push('');
  lines.push('# Add nftables port forwarding rule');
  lines.push('nft add table ip nat');
  lines.push('nft \'add chain ip nat prerouting { type nat hook prerouting priority -100; }\'');
  lines.push('nft \'add chain ip nat postrouting { type nat hook postrouting priority 100; }\'');
  lines.push('');
  lines.push(`nft add rule ip nat prerouting iifname "${cfg.localInterface}" tcp dport ${cfg.localPort} counter dnat to ${cfg.remoteHost}:${cfg.remotePort}`);
  lines.push(`nft add rule ip nat postrouting ip daddr ${cfg.remoteHost} tcp dport ${cfg.remotePort} counter masquerade`);
  lines.push('');
  lines.push('# To flush the rules later:');
  lines.push('nft flush table ip nat');
  return lines.join('\n');
}

export function buildSshCommand(cfg: PortForwardConfig): string {
  const bind = cfg.bindAddress === '0.0.0.0' ? '' : `${cfg.bindAddress}:`;
  const direction = cfg.reverse ? 'remote → local' : 'local → remote';
  const lines: string[] = [];
  lines.push(`# SSH ${direction} port forwarding`);
  lines.push(`# Forwards ${cfg.bindAddress}:${cfg.localPort} ${cfg.reverse ? '←' : '→'} ${cfg.remoteHost}:${cfg.remotePort} via ${cfg.sshHost}`);
  lines.push('');
  if (cfg.reverse) {
    lines.push(`ssh -R ${bind}${cfg.localPort}:${cfg.remoteHost}:${cfg.remotePort} ${cfg.sshUser}@${cfg.sshHost} -N`);
  } else {
    lines.push(`ssh -L ${bind}${cfg.localPort}:${cfg.remoteHost}:${cfg.remotePort} ${cfg.sshUser}@${cfg.sshHost} -N`);
  }
  lines.push('');
  lines.push('# Options:');
  lines.push('#   -N   no remote command (just forward)');
  lines.push('#   -f   background after authentication');
  lines.push('#   -g   allow remote hosts to connect to forwarded ports');
  return lines.join('\n');
}

export function buildForwardCommands(cfg: PortForwardConfig): string {
  switch (cfg.method) {
    case 'iptables':
      return buildIptablesCommands(cfg);
    case 'nftables':
      return buildNftablesCommands(cfg);
    case 'ssh':
      return buildSshCommand(cfg);
    default:
      return '';
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UsePortForwardingBuilderReturn {
  config: Ref<PortForwardConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof PortForwardConfig>(key: K, value: PortForwardConfig[K]) => void;
  reset: () => void;
}

export function usePortForwardingBuilder(): UsePortForwardingBuilderReturn {
  const config = ref<PortForwardConfig>(defaultPortForwardConfig());

  const output = computed(() => buildForwardCommands(config.value));

  function update<K extends keyof PortForwardConfig>(key: K, value: PortForwardConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function reset(): void {
    config.value = defaultPortForwardConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<PortForwardConfig>) };
      }
      if (typeof p.method === 'string') {
        config.value = { ...config.value, method: p.method as ForwardMethod };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return {
    config,
    output,
    isEmbed,
    embedInput,
    update,
    reset,
  };
}
