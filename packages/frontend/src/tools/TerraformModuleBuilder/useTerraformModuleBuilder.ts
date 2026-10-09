/**
 * useTerraformModuleBuilder - composable + pure logic for generating Terraform
 * module scaffolding (main.tf, variables.tf, outputs.tf).
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export type VariableType = 'string' | 'number' | 'bool' | 'list(string)' | 'map(string)' | 'object';

export interface ModuleVariable {
  name: string;
  type: VariableType;
  description: string;
  defaultValue: string;
  sensitive: boolean;
}

export interface ModuleOutput {
  name: string;
  description: string;
  value: string;
  sensitive: boolean;
}

export interface ModuleConfig {
  moduleName: string;
  provider: string;
  variables: ModuleVariable[];
  outputs: ModuleOutput[];
}

export function defaultModuleConfig(): ModuleConfig {
  return {
    moduleName: 'my_module',
    provider: 'aws',
    variables: [
      { name: 'region', type: 'string', description: 'AWS region', defaultValue: 'us-east-1', sensitive: false },
      { name: 'instance_count', type: 'number', description: 'Number of instances', defaultValue: '1', sensitive: false },
    ],
    outputs: [
      { name: 'instance_ids', description: 'IDs of created instances', value: 'aws_instance.example[*].id', sensitive: false },
    ],
  };
}

export function buildMainTf(cfg: ModuleConfig): string {
  const out: string[] = [];
  out.push(`# ${cfg.moduleName} - main.tf`);
  out.push('');
  out.push(`terraform {`);
  out.push(`  required_providers {`);
  out.push(`    ${cfg.provider} = {`);
  out.push(`      source  = "hashicorp/${cfg.provider}"`);
  out.push(`      version = "~> 5.0"`);
  out.push(`    }`);
  out.push(`  }`);
  out.push(`}`);
  out.push('');

  // Reference variables
  for (const v of cfg.variables) {
    if (v.name) {
      out.push(`# Use var.${v.name} in your resources`);
    }
  }
  out.push('');
  out.push(`# Add your resources here`);
  out.push(`# Example:`);
  out.push(`# resource "${cfg.provider}_example" "example" {`);
  out.push(`#   # ...`);
  out.push(`# }`);

  return out.join('\n');
}

export function buildVariablesTf(cfg: ModuleConfig): string {
  const out: string[] = [];
  out.push(`# ${cfg.moduleName} - variables.tf`);
  out.push('');

  for (const v of cfg.variables) {
    if (!v.name) continue;
    out.push(`variable "${v.name}" {`);
    out.push(`  type        = ${v.type}`);
    if (v.description) out.push(`  description = "${v.description}"`);
    if (v.defaultValue) out.push(`  default     = ${v.defaultValue}`);
    if (v.sensitive) out.push(`  sensitive   = true`);
    out.push(`}`);
    out.push('');
  }

  return out.join('\n');
}

export function buildOutputsTf(cfg: ModuleConfig): string {
  const out: string[] = [];
  out.push(`# ${cfg.moduleName} - outputs.tf`);
  out.push('');

  for (const o of cfg.outputs) {
    if (!o.name) continue;
    out.push(`output "${o.name}" {`);
    if (o.description) out.push(`  description = "${o.description}"`);
    out.push(`  value       = ${o.value}`);
    if (o.sensitive) out.push(`  sensitive   = true`);
    out.push(`}`);
    out.push('');
  }

  return out.join('\n');
}

export function buildModuleFiles(cfg: ModuleConfig): string {
  const parts: string[] = [];
  parts.push('# ─── main.tf ───\n');
  parts.push(buildMainTf(cfg));
  parts.push('\n\n# ─── variables.tf ───\n');
  parts.push(buildVariablesTf(cfg));
  parts.push('\n\n# ─── outputs.tf ───\n');
  parts.push(buildOutputsTf(cfg));
  return parts.join('\n');
}

export interface UseTerraformModuleBuilderReturn {
  config: Ref<ModuleConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof ModuleConfig>(key: K, value: ModuleConfig[K]) => void;
  addVariable: () => void;
  removeVariable: (index: number) => void;
  updateVariable: (index: number, field: keyof ModuleVariable, value: string | boolean) => void;
  addOutput: () => void;
  removeOutput: (index: number) => void;
  updateOutput: (index: number, field: keyof ModuleOutput, value: string | boolean) => void;
  reset: () => void;
}

export function useTerraformModuleBuilder(): UseTerraformModuleBuilderReturn {
  const config = ref<ModuleConfig>(defaultModuleConfig());

  const output = computed(() => buildModuleFiles(config.value));

  function update<K extends keyof ModuleConfig>(key: K, value: ModuleConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addVariable(): void {
    config.value = {
      ...config.value,
      variables: [...config.value.variables, { name: '', type: 'string', description: '', defaultValue: '', sensitive: false }],
    };
  }

  function removeVariable(index: number): void {
    config.value = {
      ...config.value,
      variables: config.value.variables.filter((_, i) => i !== index),
    };
  }

  function updateVariable(index: number, field: keyof ModuleVariable, value: string | boolean): void {
    const next = config.value.variables.map((v, i) =>
      i === index ? { ...v, [field]: value } : v,
    );
    config.value = { ...config.value, variables: next };
  }

  function addOutput(): void {
    config.value = {
      ...config.value,
      outputs: [...config.value.outputs, { name: '', description: '', value: '', sensitive: false }],
    };
  }

  function removeOutput(index: number): void {
    config.value = {
      ...config.value,
      outputs: config.value.outputs.filter((_, i) => i !== index),
    };
  }

  function updateOutput(index: number, field: keyof ModuleOutput, value: string | boolean): void {
    const next = config.value.outputs.map((o, i) =>
      i === index ? { ...o, [field]: value } : o,
    );
    config.value = { ...config.value, outputs: next };
  }

  function reset(): void {
    config.value = defaultModuleConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<ModuleConfig>) };
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
    addVariable,
    removeVariable,
    updateVariable,
    addOutput,
    removeOutput,
    updateOutput,
    reset,
  };
}
