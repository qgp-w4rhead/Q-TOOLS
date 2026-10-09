/**
 * useWireGuardConfigBuilder - composable + pure logic for generating WireGuard
 * server and client configuration files.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export interface WireGuardPeer {
  name: string;
  publicKey: string;
  allowedIps: string;
  endpoint: string;
  presharedKey: string;
}

export interface WireGuardConfig {
  serverPrivateKey: string;
  serverAddress: string;
  serverListenPort: number;
  serverDns: string;
  serverPostUp: string;
  serverPostDown: string;
  clientPrivateKey: string;
  clientAddress: string;
  clientDns: string;
  peers: WireGuardPeer[];
}

export function defaultWireGuardConfig(): WireGuardConfig {
  return {
    serverPrivateKey: '<server-private-key>',
    serverAddress: '10.0.0.1/24',
    serverListenPort: 51820,
    serverDns: '1.1.1.1',
    serverPostUp: 'iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE',
    serverPostDown: 'iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE',
    clientPrivateKey: '<client-private-key>',
    clientAddress: '10.0.0.2/24',
    clientDns: '1.1.1.1',
    peers: [
      { name: 'peer1', publicKey: '<peer-public-key>', allowedIps: '10.0.0.2/32', endpoint: 'vpn.example.com:51820', presharedKey: '' },
    ],
  };
}

export function buildServerConfig(cfg: WireGuardConfig): string {
  const lines: string[] = [];
  lines.push(`# Server config — /etc/wireguard/wg0.conf`);
  lines.push(`[Interface]`);
  lines.push(`PrivateKey = ${cfg.serverPrivateKey}`);
  lines.push(`Address = ${cfg.serverAddress}`);
  lines.push(`ListenPort = ${cfg.serverListenPort}`);
  if (cfg.serverDns) lines.push(`DNS = ${cfg.serverDns}`);
  if (cfg.serverPostUp) lines.push(`PostUp = ${cfg.serverPostUp}`);
  if (cfg.serverPostDown) lines.push(`PostDown = ${cfg.serverPostDown}`);
  lines.push('');

  for (const p of cfg.peers) {
    if (!p.publicKey || p.publicKey === '<peer-public-key>') continue;
    lines.push(`# ${p.name}`);
    lines.push(`[Peer]`);
    lines.push(`PublicKey = ${p.publicKey}`);
    lines.push(`AllowedIPs = ${p.allowedIps}`);
    if (p.presharedKey) lines.push(`PresharedKey = ${p.presharedKey}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function buildClientConfig(cfg: WireGuardConfig): string {
  const lines: string[] = [];
  lines.push(`# Client config — /etc/wireguard/wg0.conf`);
  lines.push(`[Interface]`);
  lines.push(`PrivateKey = ${cfg.clientPrivateKey}`);
  lines.push(`Address = ${cfg.clientAddress}`);
  if (cfg.clientDns) lines.push(`DNS = ${cfg.clientDns}`);
  lines.push('');
  lines.push(`[Peer]`);
  lines.push(`PublicKey = <server-public-key>`);
  if (cfg.peers[0]?.endpoint) lines.push(`Endpoint = ${cfg.peers[0].endpoint}`);
  lines.push(`AllowedIPs = 0.0.0.0/0`);
  lines.push(`PersistentKeepalive = 25`);

  return lines.join('\n');
}

export interface UseWireGuardConfigBuilderReturn {
  config: Ref<WireGuardConfig>;
  serverOutput: ComputedRef<string>;
  clientOutput: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof WireGuardConfig>(key: K, value: WireGuardConfig[K]) => void;
  addPeer: () => void;
  removePeer: (index: number) => void;
  updatePeer: (index: number, field: keyof WireGuardPeer, value: string) => void;
  reset: () => void;
}

export function useWireGuardConfigBuilder(): UseWireGuardConfigBuilderReturn {
  const config = ref<WireGuardConfig>(defaultWireGuardConfig());

  const serverOutput = computed(() => buildServerConfig(config.value));
  const clientOutput = computed(() => buildClientConfig(config.value));

  function update<K extends keyof WireGuardConfig>(key: K, value: WireGuardConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addPeer(): void {
    config.value = { ...config.value, peers: [...config.value.peers, { name: '', publicKey: '', allowedIps: '', endpoint: '', presharedKey: '' }] };
  }
  function removePeer(index: number): void {
    config.value = { ...config.value, peers: config.value.peers.filter((_, i) => i !== index) };
  }
  function updatePeer(index: number, field: keyof WireGuardPeer, value: string): void {
    const next = config.value.peers.map((p, i) => i === index ? { ...p, [field]: value } : p);
    config.value = { ...config.value, peers: next };
  }

  function reset(): void {
    config.value = defaultWireGuardConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<WireGuardConfig>) };
      }
    },
    output: [serverOutput, clientOutput],
    toOutput: () => ({
      config: { ...config.value },
      serverOutput: serverOutput.value,
      clientOutput: clientOutput.value,
    }),
  });

  return {
    config, serverOutput, clientOutput, isEmbed, embedInput,
    update, addPeer, removePeer, updatePeer, reset,
  };
}
