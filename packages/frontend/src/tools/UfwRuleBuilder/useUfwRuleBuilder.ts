/**
 * useUfwRuleBuilder - composable + pure logic for generating UFW firewall
 * commands.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export type UfwAction = 'allow' | 'deny' | 'reject' | 'limit';
export type UfwDirection = 'in' | 'out';
export type UfwProtocol = 'tcp' | 'udp' | 'both';

export interface UfwRule {
  action: UfwAction;
  port: string;
  protocol: UfwProtocol;
  direction: UfwDirection;
  sourceIp: string;
  service: string;
}

export interface UfwConfig {
  defaultDenyIncoming: boolean;
  defaultAllowOutgoing: boolean;
  rules: UfwRule[];
}

export function defaultUfwConfig(): UfwConfig {
  return {
    defaultDenyIncoming: true,
    defaultAllowOutgoing: true,
    rules: [
      { action: 'allow', port: '22', protocol: 'tcp', direction: 'in', sourceIp: '', service: '' },
      { action: 'allow', port: '80', protocol: 'tcp', direction: 'in', sourceIp: '', service: '' },
      { action: 'allow', port: '443', protocol: 'tcp', direction: 'in', sourceIp: '', service: '' },
    ],
  };
}

export function buildUfwCommands(cfg: UfwConfig): string {
  const lines: string[] = [];

  lines.push('# Reset and set defaults');
  lines.push('ufw --force reset');
  if (cfg.defaultDenyIncoming) lines.push('ufw default deny incoming');
  else lines.push('ufw default allow incoming');
  if (cfg.defaultAllowOutgoing) lines.push('ufw default allow outgoing');
  else lines.push('ufw default deny outgoing');
  lines.push('');

  for (const r of cfg.rules) {
    const parts: string[] = ['ufw'];
    if (r.direction === 'out') parts.push('route');
    parts.push(r.action);
    if (r.direction === 'out') parts.push('out');

    // Build the rule spec
    const spec: string[] = [];
    if (r.sourceIp) spec.push(`from ${r.sourceIp}`);
    if (r.direction === 'in' && r.sourceIp) spec.push('to any');
    if (r.direction === 'out' && !r.sourceIp) spec.push('from any');

    if (r.service) {
      spec.push(r.service);
    } else if (r.port) {
      spec.push(r.port);
    }

    if (r.port && r.protocol !== 'both') {
      spec.push(`proto ${r.protocol}`);
    }

    if (spec.length) parts.push(spec.join(' '));

    lines.push(parts.join(' '));
  }

  lines.push('');
  lines.push('ufw --force enable');
  lines.push('ufw status verbose');

  return lines.join('\n');
}

export interface UseUfwRuleBuilderReturn {
  config: Ref<UfwConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof UfwConfig>(key: K, value: UfwConfig[K]) => void;
  addRule: () => void;
  removeRule: (index: number) => void;
  updateRule: (index: number, field: keyof UfwRule, value: string) => void;
  reset: () => void;
}

export function useUfwRuleBuilder(): UseUfwRuleBuilderReturn {
  const config = ref<UfwConfig>(defaultUfwConfig());

  const output = computed(() => buildUfwCommands(config.value));

  function update<K extends keyof UfwConfig>(key: K, value: UfwConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addRule(): void {
    config.value = {
      ...config.value,
      rules: [...config.value.rules, { action: 'allow', port: '', protocol: 'tcp', direction: 'in', sourceIp: '', service: '' }],
    };
  }

  function removeRule(index: number): void {
    config.value = { ...config.value, rules: config.value.rules.filter((_, i) => i !== index) };
  }

  function updateRule(index: number, field: keyof UfwRule, value: string): void {
    const next = config.value.rules.map((r, i) => i === index ? { ...r, [field]: value } : r);
    config.value = { ...config.value, rules: next };
  }

  function reset(): void {
    config.value = defaultUfwConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<UfwConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return { config, output, isEmbed, embedInput, update, addRule, removeRule, updateRule, reset };
}
