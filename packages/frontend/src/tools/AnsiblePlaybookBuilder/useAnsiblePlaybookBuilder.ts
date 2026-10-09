/**
 * useAnsiblePlaybookBuilder - composable + pure logic for generating Ansible
 * playbook YAML.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export interface AnsibleTask {
  name: string;
  module: string;
  args: string;
  become: boolean;
}

export interface AnsibleHandler {
  name: string;
  module: string;
  args: string;
}

export interface PlaybookConfig {
  playbookName: string;
  hosts: string;
  remoteUser: string;
  become: boolean;
  gatherFacts: boolean;
  variables: { key: string; value: string }[];
  tasks: AnsibleTask[];
  handlers: AnsibleHandler[];
}

export function defaultPlaybookConfig(): PlaybookConfig {
  return {
    playbookName: 'deploy',
    hosts: 'webservers',
    remoteUser: 'ansible',
    become: true,
    gatherFacts: true,
    variables: [
      { key: 'app_name', value: 'myapp' },
      { key: 'app_port', value: '8080' },
    ],
    tasks: [
      { name: 'Install nginx', module: 'apt', args: 'name=nginx state=present update_cache=yes', become: true },
      { name: 'Start nginx', module: 'service', args: 'name=nginx state=started enabled=yes', become: true },
      { name: 'Copy config', module: 'template', args: 'src=nginx.conf.j2 dest=/etc/nginx/nginx.conf', become: true },
    ],
    handlers: [
      { name: 'restart nginx', module: 'service', args: 'name=nginx state=restarted' },
    ],
  };
}

export function buildPlaybook(cfg: PlaybookConfig): string {
  const lines: string[] = [];

  lines.push(`---`);
  lines.push(`# ${cfg.playbookName}.yml`);
  lines.push(`- name: ${cfg.playbookName}`);
  lines.push(`  hosts: ${cfg.hosts}`);
  if (cfg.remoteUser) lines.push(`  remote_user: ${cfg.remoteUser}`);
  lines.push(`  become: ${cfg.become ? 'yes' : 'no'}`);
  lines.push(`  gather_facts: ${cfg.gatherFacts ? 'yes' : 'no'}`);

  // Variables
  if (cfg.variables.some((v) => v.key)) {
    lines.push(`  vars:`);
    for (const v of cfg.variables) {
      if (v.key) {
        const val = /^\d+$/.test(v.value) ? v.value : `"${v.value}"`;
        lines.push(`    ${v.key}: ${val}`);
      }
    }
  }

  // Tasks
  if (cfg.tasks.some((t) => t.name)) {
    lines.push(`  tasks:`);
    for (const t of cfg.tasks) {
      if (!t.name) continue;
      lines.push(`    - name: ${t.name}`);
      lines.push(`      ${t.module}: ${t.args}`);
      if (t.become) lines.push(`      become: yes`);
    }
  }

  // Handlers
  if (cfg.handlers.some((h) => h.name)) {
    lines.push(`  handlers:`);
    for (const h of cfg.handlers) {
      if (!h.name) continue;
      lines.push(`    - name: ${h.name}`);
      lines.push(`      ${h.module}: ${h.args}`);
    }
  }

  return lines.join('\n');
}

export interface UseAnsiblePlaybookBuilderReturn {
  config: Ref<PlaybookConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof PlaybookConfig>(key: K, value: PlaybookConfig[K]) => void;
  addVariable: () => void;
  removeVariable: (index: number) => void;
  updateVariable: (index: number, field: 'key' | 'value', value: string) => void;
  addTask: () => void;
  removeTask: (index: number) => void;
  updateTask: (index: number, field: keyof AnsibleTask, value: string | boolean) => void;
  addHandler: () => void;
  removeHandler: (index: number) => void;
  updateHandler: (index: number, field: keyof AnsibleHandler, value: string) => void;
  reset: () => void;
}

export function useAnsiblePlaybookBuilder(): UseAnsiblePlaybookBuilderReturn {
  const config = ref<PlaybookConfig>(defaultPlaybookConfig());

  const output = computed(() => buildPlaybook(config.value));

  function update<K extends keyof PlaybookConfig>(key: K, value: PlaybookConfig[K]): void {
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

  function addTask(): void {
    config.value = { ...config.value, tasks: [...config.value.tasks, { name: '', module: 'apt', args: '', become: false }] };
  }
  function removeTask(index: number): void {
    config.value = { ...config.value, tasks: config.value.tasks.filter((_, i) => i !== index) };
  }
  function updateTask(index: number, field: keyof AnsibleTask, value: string | boolean): void {
    const next = config.value.tasks.map((t, i) => i === index ? { ...t, [field]: value } : t);
    config.value = { ...config.value, tasks: next };
  }

  function addHandler(): void {
    config.value = { ...config.value, handlers: [...config.value.handlers, { name: '', module: 'service', args: '' }] };
  }
  function removeHandler(index: number): void {
    config.value = { ...config.value, handlers: config.value.handlers.filter((_, i) => i !== index) };
  }
  function updateHandler(index: number, field: keyof AnsibleHandler, value: string): void {
    const next = config.value.handlers.map((h, i) => i === index ? { ...h, [field]: value } : h);
    config.value = { ...config.value, handlers: next };
  }

  function reset(): void {
    config.value = defaultPlaybookConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<PlaybookConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return {
    config, output, isEmbed, embedInput, update,
    addVariable, removeVariable, updateVariable,
    addTask, removeTask, updateTask,
    addHandler, removeHandler, updateHandler,
    reset,
  };
}
