/**
 * useTerraformImportBuilder - composable + pure logic for generating
 * terraform import commands.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export interface ImportEntry {
  address: string;
  id: string;
}

export interface ImportConfig {
  workspace: string;
  entries: ImportEntry[];
}

export function defaultImportConfig(): ImportConfig {
  return {
    workspace: 'default',
    entries: [
      { address: 'aws_instance.web', id: 'i-0123456789abcdef0' },
      { address: 'aws_s3_bucket.data', id: 'my-bucket-name' },
    ],
  };
}

export function buildImportCommands(cfg: ImportConfig): string {
  const lines: string[] = [];

  if (cfg.workspace && cfg.workspace !== 'default') {
    lines.push(`terraform workspace select ${cfg.workspace} || terraform workspace new ${cfg.workspace}`);
    lines.push('');
  }

  for (const e of cfg.entries) {
    if (e.address && e.id) {
      lines.push(`terraform import ${e.address} ${e.id}`);
    }
  }

  return lines.join('\n');
}

export interface UseTerraformImportBuilderReturn {
  config: Ref<ImportConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof ImportConfig>(key: K, value: ImportConfig[K]) => void;
  addEntry: () => void;
  removeEntry: (index: number) => void;
  updateEntry: (index: number, field: keyof ImportEntry, value: string) => void;
  reset: () => void;
}

export function useTerraformImportBuilder(): UseTerraformImportBuilderReturn {
  const config = ref<ImportConfig>(defaultImportConfig());

  const output = computed(() => buildImportCommands(config.value));

  function update<K extends keyof ImportConfig>(key: K, value: ImportConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addEntry(): void {
    config.value = {
      ...config.value,
      entries: [...config.value.entries, { address: '', id: '' }],
    };
  }

  function removeEntry(index: number): void {
    config.value = {
      ...config.value,
      entries: config.value.entries.filter((_, i) => i !== index),
    };
  }

  function updateEntry(index: number, field: keyof ImportEntry, value: string): void {
    const next = config.value.entries.map((e, i) =>
      i === index ? { ...e, [field]: value } : e,
    );
    config.value = { ...config.value, entries: next };
  }

  function reset(): void {
    config.value = defaultImportConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<ImportConfig>) };
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
    addEntry,
    removeEntry,
    updateEntry,
    reset,
  };
}
