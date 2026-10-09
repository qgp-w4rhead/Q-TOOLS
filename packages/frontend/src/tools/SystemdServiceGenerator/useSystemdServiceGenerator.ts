/**
 * useSystemdServiceGenerator - composable + pure logic for the systemd service
 * generator tool.
 *
 * Generates a `.service` unit file from form inputs covering the most common
 * systemd directives: ExecStart, ExecStop, Restart, User, Group, WorkingDirectory,
 * Environment, EnvironmentFile, Type, etc.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export type SystemdType = 'simple' | 'forking' | 'oneshot' | 'notify' | 'idle';
export type RestartPolicy =
  | 'no'
  | 'on-success'
  | 'on-failure'
  | 'on-abnormal'
  | 'on-watchdog'
  | 'on-abort'
  | 'always';

export interface SystemdEnvVar {
  key: string;
  value: string;
}

export interface SystemdConfig {
  name: string;
  description: string;
  type: SystemdType;
  execStart: string;
  execStop: string;
  execStartPre: string;
  execStartPost: string;
  restart: RestartPolicy;
  restartSec: number;
  user: string;
  group: string;
  workingDirectory: string;
  environment: SystemdEnvVar[];
  environmentFile: string;
  after: string;
  wants: string;
  requires: string;
  timeoutStartSec: number;
  timeoutStopSec: number;
  killMode: 'control-group' | 'process' | 'mixed' | 'none';
  remainAfterExit: boolean;
  standardOutput: string;
  standardError: string;
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export function defaultSystemdConfig(): SystemdConfig {
  return {
    name: 'myapp',
    description: 'My Application Service',
    type: 'simple',
    execStart: '/usr/bin/node /opt/myapp/server.js',
    execStop: '',
    execStartPre: '',
    execStartPost: '',
    restart: 'on-failure',
    restartSec: 5,
    user: 'node',
    group: 'node',
    workingDirectory: '/opt/myapp',
    environment: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'PORT', value: '3000' },
    ],
    environmentFile: '',
    after: 'network.target',
    wants: '',
    requires: '',
    timeoutStartSec: 30,
    timeoutStopSec: 30,
    killMode: 'control-group',
    remainAfterExit: false,
    standardOutput: 'journal',
    standardError: 'journal',
  };
}

/* -------------------------------------------------------------------------- */
/* Pure logic - unit file generation                                          */
/* -------------------------------------------------------------------------- */

export function buildSystemdUnit(cfg: SystemdConfig): string {
  const out: string[] = [];

  // [Unit]
  out.push('[Unit]');
  out.push(`Description=${cfg.description}`);
  if (cfg.after) out.push(`After=${cfg.after}`);
  if (cfg.wants) out.push(`Wants=${cfg.wants}`);
  if (cfg.requires) out.push(`Requires=${cfg.requires}`);
  out.push('');

  // [Service]
  out.push('[Service]');
  out.push(`Type=${cfg.type}`);
  if (cfg.execStartPre) out.push(`ExecStartPre=${cfg.execStartPre}`);
  out.push(`ExecStart=${cfg.execStart}`);
  if (cfg.execStartPost) out.push(`ExecStartPost=${cfg.execStartPost}`);
  if (cfg.execStop) out.push(`ExecStop=${cfg.execStop}`);
  out.push(`Restart=${cfg.restart}`);
  out.push(`RestartSec=${cfg.restartSec}`);
  if (cfg.user) out.push(`User=${cfg.user}`);
  if (cfg.group) out.push(`Group=${cfg.group}`);
  if (cfg.workingDirectory) out.push(`WorkingDirectory=${cfg.workingDirectory}`);
  out.push(`KillMode=${cfg.killMode}`);
  if (cfg.remainAfterExit) out.push('RemainAfterExit=yes');
  out.push(`TimeoutStartSec=${cfg.timeoutStartSec}`);
  out.push(`TimeoutStopSec=${cfg.timeoutStopSec}`);
  if (cfg.standardOutput) out.push(`StandardOutput=${cfg.standardOutput}`);
  if (cfg.standardError) out.push(`StandardError=${cfg.standardError}`);

  for (const env of cfg.environment) {
    if (env.key) {
      out.push(`Environment=${env.key}=${env.value}`);
    }
  }
  if (cfg.environmentFile) {
    out.push(`EnvironmentFile=${cfg.environmentFile}`);
  }
  out.push('');

  // [Install]
  out.push('[Install]');
  out.push('WantedBy=multi-user.target');

  return out.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseSystemdServiceGeneratorReturn {
  config: Ref<SystemdConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof SystemdConfig>(key: K, value: SystemdConfig[K]) => void;
  addEnvVar: () => void;
  removeEnvVar: (index: number) => void;
  updateEnvVar: (index: number, field: keyof SystemdEnvVar, value: string) => void;
  reset: () => void;
}

export function useSystemdServiceGenerator(): UseSystemdServiceGeneratorReturn {
  const config = ref<SystemdConfig>(defaultSystemdConfig());

  const output = computed(() => buildSystemdUnit(config.value));

  function update<K extends keyof SystemdConfig>(key: K, value: SystemdConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addEnvVar(): void {
    config.value = {
      ...config.value,
      environment: [...config.value.environment, { key: '', value: '' }],
    };
  }

  function removeEnvVar(index: number): void {
    config.value = {
      ...config.value,
      environment: config.value.environment.filter((_, i) => i !== index),
    };
  }

  function updateEnvVar(index: number, field: keyof SystemdEnvVar, value: string): void {
    const next = config.value.environment.map((e, i) =>
      i === index ? { ...e, [field]: value } : e,
    );
    config.value = { ...config.value, environment: next };
  }

  function reset(): void {
    config.value = defaultSystemdConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<SystemdConfig>) };
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
    addEnvVar,
    removeEnvVar,
    updateEnvVar,
    reset,
  };
}
