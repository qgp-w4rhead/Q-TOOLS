/**
 * useHelmValuesBuilder - composable + pure logic for generating Helm values.yaml
 * with common chart overrides.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

export type ServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer';

export interface HelmConfig {
  replicaCount: number;
  imageRepo: string;
  imageTag: string;
  imagePullPolicy: string;
  serviceType: ServiceType;
  servicePort: number;
  serviceTargetPort: number;
  resourcesRequestsCpu: string;
  resourcesRequestsMemory: string;
  resourcesLimitsCpu: string;
  resourcesLimitsMemory: string;
  ingressEnabled: boolean;
  ingressHost: string;
  ingressPath: string;
  ingressClassName: string;
  envVars: { key: string; value: string }[];
  nodeSelector: string;
  tolerations: string;
  affinity: string;
  autoscalingEnabled: boolean;
  autoscalingMinReplicas: number;
  autoscalingMaxReplicas: number;
  autoscalingTargetCpu: number;
  persistenceEnabled: boolean;
  persistenceSize: string;
  persistenceStorageClass: string;
}

export function defaultHelmConfig(): HelmConfig {
  return {
    replicaCount: 2,
    imageRepo: 'nginx',
    imageTag: 'latest',
    imagePullPolicy: 'IfNotPresent',
    serviceType: 'ClusterIP',
    servicePort: 80,
    serviceTargetPort: 80,
    resourcesRequestsCpu: '100m',
    resourcesRequestsMemory: '128Mi',
    resourcesLimitsCpu: '250m',
    resourcesLimitsMemory: '256Mi',
    ingressEnabled: false,
    ingressHost: 'chart.example.com',
    ingressPath: '/',
    ingressClassName: 'nginx',
    envVars: [{ key: 'APP_ENV', value: 'production' }],
    nodeSelector: '',
    tolerations: '',
    affinity: '',
    autoscalingEnabled: false,
    autoscalingMinReplicas: 1,
    autoscalingMaxReplicas: 10,
    autoscalingTargetCpu: 80,
    persistenceEnabled: false,
    persistenceSize: '8Gi',
    persistenceStorageClass: '',
  };
}

export function buildValuesYaml(cfg: HelmConfig): string {
  const lines: string[] = [];

  lines.push(`# Helm values.yaml`);
  lines.push(`replicaCount: ${cfg.replicaCount}`);
  lines.push('');
  lines.push(`image:`);
  lines.push(`  repository: ${cfg.imageRepo}`);
  lines.push(`  tag: ${cfg.imageTag}`);
  lines.push(`  pullPolicy: ${cfg.imagePullPolicy}`);
  lines.push('');

  lines.push(`service:`);
  lines.push(`  type: ${cfg.serviceType}`);
  lines.push(`  port: ${cfg.servicePort}`);
  lines.push(`  targetPort: ${cfg.serviceTargetPort}`);
  lines.push('');

  lines.push(`resources:`);
  lines.push(`  requests:`);
  lines.push(`    cpu: ${cfg.resourcesRequestsCpu}`);
  lines.push(`    memory: ${cfg.resourcesRequestsMemory}`);
  lines.push(`  limits:`);
  lines.push(`    cpu: ${cfg.resourcesLimitsCpu}`);
  lines.push(`    memory: ${cfg.resourcesLimitsMemory}`);
  lines.push('');

  if (cfg.ingressEnabled) {
    lines.push(`ingress:`);
    lines.push(`  enabled: true`);
    lines.push(`  className: ${cfg.ingressClassName}`);
    lines.push(`  hosts:`);
    lines.push(`    - host: ${cfg.ingressHost}`);
    lines.push(`      paths:`);
    lines.push(`        - path: ${cfg.ingressPath}`);
    lines.push(`          pathType: Prefix`);
    lines.push('');
  } else {
    lines.push(`ingress:`);
    lines.push(`  enabled: false`);
    lines.push('');
  }

  if (cfg.envVars.some((e) => e.key)) {
    lines.push(`env:`);
    for (const e of cfg.envVars) {
      if (e.key) {
        lines.push(`  ${e.key}: "${e.value}"`);
      }
    }
    lines.push('');
  }

  if (cfg.autoscalingEnabled) {
    lines.push(`autoscaling:`);
    lines.push(`  enabled: true`);
    lines.push(`  minReplicas: ${cfg.autoscalingMinReplicas}`);
    lines.push(`  maxReplicas: ${cfg.autoscalingMaxReplicas}`);
    lines.push(`  targetCPUUtilizationPercentage: ${cfg.autoscalingTargetCpu}`);
    lines.push('');
  } else {
    lines.push(`autoscaling:`);
    lines.push(`  enabled: false`);
    lines.push('');
  }

  if (cfg.persistenceEnabled) {
    lines.push(`persistence:`);
    lines.push(`  enabled: true`);
    lines.push(`  size: ${cfg.persistenceSize}`);
    if (cfg.persistenceStorageClass) {
      lines.push(`  storageClass: ${cfg.persistenceStorageClass}`);
    }
    lines.push('');
  }

  if (cfg.nodeSelector) {
    lines.push(`nodeSelector:`);
    lines.push(`  ${cfg.nodeSelector}`);
    lines.push('');
  }

  if (cfg.tolerations) {
    lines.push(`tolerations:`);
    lines.push(`  ${cfg.tolerations}`);
    lines.push('');
  }

  if (cfg.affinity) {
    lines.push(`affinity:`);
    lines.push(`  ${cfg.affinity}`);
    lines.push('');
  }

  return lines.join('\n');
}

export interface UseHelmValuesBuilderReturn {
  config: Ref<HelmConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof HelmConfig>(key: K, value: HelmConfig[K]) => void;
  addEnvVar: () => void;
  removeEnvVar: (index: number) => void;
  updateEnvVar: (index: number, field: 'key' | 'value', value: string) => void;
  reset: () => void;
}

export function useHelmValuesBuilder(): UseHelmValuesBuilderReturn {
  const config = ref<HelmConfig>(defaultHelmConfig());

  const output = computed(() => buildValuesYaml(config.value));

  function update<K extends keyof HelmConfig>(key: K, value: HelmConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addEnvVar(): void {
    config.value = { ...config.value, envVars: [...config.value.envVars, { key: '', value: '' }] };
  }
  function removeEnvVar(index: number): void {
    config.value = { ...config.value, envVars: config.value.envVars.filter((_, i) => i !== index) };
  }
  function updateEnvVar(index: number, field: 'key' | 'value', value: string): void {
    const next = config.value.envVars.map((e, i) => i === index ? { ...e, [field]: value } : e);
    config.value = { ...config.value, envVars: next };
  }

  function reset(): void {
    config.value = defaultHelmConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<HelmConfig>) };
      }
    },
    output,
    toOutput: () => ({ config: { ...config.value }, output: output.value }),
  });

  return { config, output, isEmbed, embedInput, update, addEnvVar, removeEnvVar, updateEnvVar, reset };
}
