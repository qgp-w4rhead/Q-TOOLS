/**
 * useHaProxyConfigBuilder - composable + pure logic for generating HAProxy
 * configuration files.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export type BalanceAlgorithm = 'roundrobin' | 'leastconn' | 'static-rr' | 'source';

export interface HaProxyBackend {
  name: string;
  servers: string;
  balance: BalanceAlgorithm;
  sslCert: string;
  check: boolean;
  redirectHttps: boolean;
}

export interface HaProxyConfig {
  frontendName: string;
  frontendBind: string;
  frontendPort: number;
  sslCert: string;
  enableStats: boolean;
  statsUri: string;
  statsAuth: string;
  backends: HaProxyBackend[];
}

export function defaultHaProxyConfig(): HaProxyConfig {
  return {
    frontendName: 'web_frontend',
    frontendBind: '*',
    frontendPort: 80,
    sslCert: '/etc/ssl/certs/mycert.pem',
    enableStats: true,
    statsUri: '/haproxy?stats',
    statsAuth: 'admin:password',
    backends: [
      { name: 'web_backend', servers: 'web1 10.0.0.1:8080 check\nweb2 10.0.0.2:8080 check', balance: 'roundrobin', sslCert: '', check: true, redirectHttps: false },
    ],
  };
}

export function buildHaProxyConfig(cfg: HaProxyConfig): string {
  const lines: string[] = [];

  lines.push(`# HAProxy configuration`);
  lines.push(`global`);
  lines.push(`  log /dev/log local0`);
  lines.push(`  maxconn 4096`);
  lines.push(`  daemon`);
  lines.push('');

  lines.push(`defaults`);
  lines.push(`  log global`);
  lines.push(`  mode http`);
  lines.push(`  option httplog`);
  lines.push(`  option dontlognull`);
  lines.push(`  timeout connect 5s`);
  lines.push(`  timeout client 50s`);
  lines.push(`  timeout server 50s`);
  lines.push('');

  // Frontend
  lines.push(`frontend ${cfg.frontendName}`);
  lines.push(`  bind ${cfg.frontendBind}:${cfg.frontendPort}`);
  if (cfg.sslCert) {
    lines.push(`  bind *:443 ssl crt ${cfg.sslCert}`);
  }
  lines.push(`  mode http`);

  // ACLs and use_backend
  for (const b of cfg.backends) {
    if (b.name) {
      lines.push(`  use_backend ${b.name}`);
    }
  }
  lines.push(`  default_backend ${cfg.backends[0]?.name || 'default_backend'}`);
  lines.push('');

  // Backends
  for (const b of cfg.backends) {
    if (!b.name) continue;
    lines.push(`backend ${b.name}`);
    lines.push(`  mode http`);
    lines.push(`  balance ${b.balance}`);
    if (b.redirectHttps) {
      lines.push(`  redirect scheme https if !{ ssl_fc }`);
    }
    for (const srv of b.servers.split('\n').map((s) => s.trim()).filter(Boolean)) {
      lines.push(`  server ${srv}`);
    }
    lines.push('');
  }

  // Stats
  if (cfg.enableStats) {
    lines.push(`listen stats`);
    lines.push(`  bind *:8404`);
    lines.push(`  mode http`);
    lines.push(`  stats enable`);
    lines.push(`  stats uri ${cfg.statsUri}`);
    if (cfg.statsAuth) {
      lines.push(`  stats auth ${cfg.statsAuth}`);
    }
  }

  return lines.join('\n');
}

export interface UseHaProxyConfigBuilderReturn {
  config: Ref<HaProxyConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof HaProxyConfig>(key: K, value: HaProxyConfig[K]) => void;
  addBackend: () => void;
  removeBackend: (index: number) => void;
  updateBackend: (index: number, field: keyof HaProxyBackend, value: string | boolean) => void;
  reset: () => void;
}

export function useHaProxyConfigBuilder(): UseHaProxyConfigBuilderReturn {
  const config = ref<HaProxyConfig>(defaultHaProxyConfig());

  const output = computed(() => buildHaProxyConfig(config.value));

  function update<K extends keyof HaProxyConfig>(key: K, value: HaProxyConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addBackend(): void {
    config.value = { ...config.value, backends: [...config.value.backends, { name: '', servers: '', balance: 'roundrobin', sslCert: '', check: true, redirectHttps: false }] };
  }
  function removeBackend(index: number): void {
    config.value = { ...config.value, backends: config.value.backends.filter((_, i) => i !== index) };
  }
  function updateBackend(index: number, field: keyof HaProxyBackend, value: string | boolean): void {
    const next = config.value.backends.map((b, i) => i === index ? { ...b, [field]: value } : b);
    config.value = { ...config.value, backends: next };
  }

  function reset(): void {
    config.value = defaultHaProxyConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<HaProxyConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return { config, output, isEmbed, embedInput, update, addBackend, removeBackend, updateBackend, reset };
}
