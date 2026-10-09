/**
 * useNginxConfigBuilder - composable + pure logic for the Nginx config builder.
 *
 * Generates Nginx server-block configurations for three common patterns:
 *   - reverse-proxy: forward requests to an upstream backend
 *   - static-site:   serve files from a root directory
 *   - load-balancer: distribute traffic across multiple backends
 *
 * Pure helpers (buildNginxConfig, defaultNginxConfig) have no Vue dependency.
 * The composable wraps them in reactive state and wires up the embed protocol.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export type NginxMode = 'reverse-proxy' | 'static-site' | 'load-balancer';

export interface NginxBackend {
  url: string;
  weight: number;
}

export interface NginxConfig {
  mode: NginxMode;
  listenPort: number;
  serverName: string;
  // reverse-proxy
  proxyPass: string;
  proxyHost: string;
  proxyWebsocket: boolean;
  proxySetHeaders: boolean;
  // static-site
  rootDir: string;
  indexFile: string;
  gzip: boolean;
  tryFiles: boolean;
  // load-balancer
  upstreamName: string;
  lbMethod: 'round-robin' | 'ip_hash' | 'least_conn';
  backends: NginxBackend[];
  // SSL
  sslEnabled: boolean;
  sslCert: string;
  sslKey: string;
  // logging
  accessLog: string;
  errorLog: string;
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export function defaultNginxConfig(): NginxConfig {
  return {
    mode: 'reverse-proxy',
    listenPort: 80,
    serverName: 'example.com',
    proxyPass: 'http://127.0.0.1:3000',
    proxyHost: '$host',
    proxyWebsocket: true,
    proxySetHeaders: true,
    rootDir: '/var/www/html',
    indexFile: 'index.html',
    gzip: true,
    tryFiles: true,
    upstreamName: 'backend',
    lbMethod: 'round-robin',
    backends: [
      { url: '127.0.0.1:3000', weight: 1 },
      { url: '127.0.0.1:3001', weight: 1 },
    ],
    sslEnabled: false,
    sslCert: '/etc/nginx/ssl/cert.pem',
    sslKey: '/etc/nginx/ssl/key.pem',
    accessLog: '/var/log/nginx/access.log',
    errorLog: '/var/log/nginx/error.log',
  };
}

/* -------------------------------------------------------------------------- */
/* Pure logic - config generation                                              */
/* -------------------------------------------------------------------------- */

export function buildNginxConfig(cfg: NginxConfig): string {
  const out: string[] = [];

  // Upstream block (load-balancer only)
  if (cfg.mode === 'load-balancer') {
    out.push(`upstream ${cfg.upstreamName || 'backend'} {`);
    if (cfg.lbMethod === 'ip_hash') {
      out.push('  ip_hash;');
    } else if (cfg.lbMethod === 'least_conn') {
      out.push('  least_conn;');
    }
    for (const b of cfg.backends) {
      if (b.weight > 1) {
        out.push(`  server ${b.url} weight=${b.weight};`);
      } else {
        out.push(`  server ${b.url};`);
      }
    }
    out.push('}');
    out.push('');
  }

  // Server block
  const listenParts = [String(cfg.listenPort)];
  if (cfg.sslEnabled) listenParts.push('ssl');
  out.push('server {');
  out.push(`  listen ${listenParts.join(' ')};`);
  out.push(`  listen [::]:${cfg.listenPort}${cfg.sslEnabled ? ' ssl' : ''};`);
  out.push(`  server_name ${cfg.serverName};`);
  out.push('');

  // SSL
  if (cfg.sslEnabled) {
    out.push(`  ssl_certificate ${cfg.sslCert};`);
    out.push(`  ssl_certificate_key ${cfg.sslKey};`);
    out.push('  ssl_protocols TLSv1.2 TLSv1.3;');
    out.push('  ssl_ciphers HIGH:!aNULL:!MD5;');
    out.push('');
  }

  // Logging
  if (cfg.accessLog) {
    out.push(`  access_log ${cfg.accessLog};`);
  }
  if (cfg.errorLog) {
    out.push(`  error_log ${cfg.errorLog};`);
  }
  out.push('');

  // Mode-specific location
  if (cfg.mode === 'reverse-proxy' || cfg.mode === 'load-balancer') {
    const target = cfg.mode === 'load-balancer'
      ? `http://${cfg.upstreamName || 'backend'}`
      : cfg.proxyPass;

    out.push('  location / {');
    out.push(`    proxy_pass ${target};`);

    if (cfg.proxySetHeaders) {
      out.push(`    proxy_set_header Host ${cfg.proxyHost};`);
      out.push('    proxy_set_header X-Real-IP $remote_addr;');
      out.push('    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
      out.push('    proxy_set_header X-Forwarded-Proto $scheme;');
    }

    if (cfg.proxyWebsocket) {
      out.push('    proxy_http_version 1.1;');
      out.push('    proxy_set_header Upgrade $http_upgrade;');
      out.push('    proxy_set_header Connection "upgrade";');
    }

    out.push('    proxy_connect_timeout 60s;');
    out.push('    proxy_read_timeout 60s;');
    out.push('    proxy_send_timeout 60s;');
    out.push('  }');
  } else if (cfg.mode === 'static-site') {
    out.push(`  root ${cfg.rootDir};`);
    out.push(`  index ${cfg.indexFile};`);
    out.push('');

    if (cfg.gzip) {
      out.push('  gzip on;');
      out.push('  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;');
      out.push('  gzip_min_length 1000;');
      out.push('  gzip_comp_level 6;');
      out.push('');
    }

    out.push('  location / {');
    if (cfg.tryFiles) {
      out.push('    try_files $uri $uri/ /' + cfg.indexFile + ';');
    } else {
      out.push('    try_files $uri =404;');
    }
    out.push('  }');

    out.push('');
    out.push('  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {');
    out.push('    expires 1y;');
    out.push('    add_header Cache-Control "public, immutable";');
    out.push('    access_log off;');
    out.push('  }');
  }

  out.push('}');
  return out.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseNginxConfigBuilderReturn {
  config: Ref<NginxConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof NginxConfig>(key: K, value: NginxConfig[K]) => void;
  addBackend: () => void;
  removeBackend: (index: number) => void;
  updateBackend: (index: number, field: keyof NginxBackend, value: string | number) => void;
  reset: () => void;
}

export function useNginxConfigBuilder(): UseNginxConfigBuilderReturn {
  const config = ref<NginxConfig>(defaultNginxConfig());

  const output = computed(() => buildNginxConfig(config.value));

  function update<K extends keyof NginxConfig>(key: K, value: NginxConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addBackend(): void {
    config.value = {
      ...config.value,
      backends: [...config.value.backends, { url: '127.0.0.1:3002', weight: 1 }],
    };
  }

  function removeBackend(index: number): void {
    config.value = {
      ...config.value,
      backends: config.value.backends.filter((_, i) => i !== index),
    };
  }

  function updateBackend(index: number, field: keyof NginxBackend, value: string | number): void {
    const next = config.value.backends.map((b, i) =>
      i === index ? { ...b, [field]: value } : b,
    );
    config.value = { ...config.value, backends: next };
  }

  function reset(): void {
    config.value = defaultNginxConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<NginxConfig>) };
      }
      if (typeof p.mode === 'string') {
        config.value = { ...config.value, mode: p.mode as NginxMode };
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
    addBackend,
    removeBackend,
    updateBackend,
    reset,
  };
}
