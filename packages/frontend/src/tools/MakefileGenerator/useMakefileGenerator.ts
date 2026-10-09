/**
 * useMakefileGenerator - composable + pure logic for generating Makefiles.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export interface MakefileTarget {
  name: string;
  commands: string;
  phony: boolean;
  dependsOn: string;
}

export interface MakefileConfig {
  variables: { key: string; value: string }[];
  targets: MakefileTarget[];
}

export function defaultMakefileConfig(): MakefileConfig {
  return {
    variables: [
      { key: 'APP', value: 'myapp' },
      { key: 'GO', value: 'go' },
      { key: 'BUILD_DIR', value: './build' },
    ],
    targets: [
      { name: 'build', commands: '$(GO) build -o $(BUILD_DIR)/$(APP) ./cmd/$(APP)', phony: true, dependsOn: '' },
      { name: 'test', commands: '$(GO) test ./...', phony: true, dependsOn: '' },
      { name: 'lint', commands: 'golangci-lint run', phony: true, dependsOn: '' },
      { name: 'deploy', commands: 'kubectl apply -f k8s/', phony: true, dependsOn: 'build' },
      { name: 'clean', commands: 'rm -rf $(BUILD_DIR)', phony: true, dependsOn: '' },
    ],
  };
}

export function buildMakefile(cfg: MakefileConfig): string {
  const lines: string[] = [];

  // Variables
  for (const v of cfg.variables) {
    if (v.key) {
      lines.push(`${v.key} := ${v.value}`);
    }
  }
  lines.push('');

  // Collect phony targets
  const phonyTargets = cfg.targets.filter((t) => t.phony && t.name).map((t) => t.name);
  if (phonyTargets.length) {
    lines.push(`.PHONY: ${phonyTargets.join(' ')}`);
    lines.push('');
  }

  // Targets
  for (const t of cfg.targets) {
    if (!t.name) continue;
    const deps = t.dependsOn ? `: ${t.dependsOn}` : ':';
    lines.push(`${t.name}${deps}`);

    for (const cmd of t.commands.split('\n').map((s) => s.trim()).filter(Boolean)) {
      lines.push(`\t${cmd}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export interface UseMakefileGeneratorReturn {
  config: Ref<MakefileConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof MakefileConfig>(key: K, value: MakefileConfig[K]) => void;
  addVariable: () => void;
  removeVariable: (index: number) => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  addTarget: () => void;
  removeTarget: (index: number) => void;
  updateTarget: (index: number, field: keyof MakefileTarget, value: string | boolean) => void;
  reset: () => void;
}

export function useMakefileGenerator(): UseMakefileGeneratorReturn {
  const config = ref<MakefileConfig>(defaultMakefileConfig());

  const output = computed(() => buildMakefile(config.value));

  function update<K extends keyof MakefileConfig>(key: K, value: MakefileConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addVariable(): void {
    config.value = { ...config.value, variables: [...config.value.variables, { key: '', value: '' }] };
  }
  function removeVariable(index: number): void {
    config.value = { ...config.value, variables: config.value.variables.filter((_, i) => i !== index) };
  }
  function updateVariable(index: number, field: 'key' | 'value', value: string): void {
    const next = config.value.variables.map((v, i) => i === index ? { ...v, [field]: value } : v);
    config.value = { ...config.value, variables: next };
  }

  function addTarget(): void {
    config.value = { ...config.value, targets: [...config.value.targets, { name: '', commands: '', phony: true, dependsOn: '' }] };
  }
  function removeTarget(index: number): void {
    config.value = { ...config.value, targets: config.value.targets.filter((_, i) => i !== index) };
  }
  function updateTarget(index: number, field: keyof MakefileTarget, value: string | boolean): void {
    const next = config.value.targets.map((t, i) => i === index ? { ...t, [field]: value } : t);
    config.value = { ...config.value, targets: next };
  }

  function reset(): void {
    config.value = defaultMakefileConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<MakefileConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return {
    config, output, isEmbed, embedInput, update,
    addVariable, removeVariable, updateVariable,
    addTarget, removeTarget, updateTarget,
    reset,
  };
}
