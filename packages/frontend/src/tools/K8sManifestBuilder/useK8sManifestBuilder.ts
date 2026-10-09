/**
 * useK8sManifestBuilder - composable + pure logic for the Kubernetes manifest
 * builder tool.
 *
 * Generates Deployment, Service, and Ingress YAML manifests from form inputs.
 * Uses the `yaml` package (initial bundle) for serialisation.
 *
 * Dependencies: `yaml` (initial bundle).
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { stringify as yamlStringify } from 'yaml';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export type K8sServiceType = 'ClusterIP' | 'NodePort' | 'LoadBalancer';
export type K8sIngressBackend = 'service' | 'default-backend';

export interface K8sEnvVar {
  key: string;
  value: string;
}

export interface K8sPort {
  containerPort: number;
  name: string;
  protocol: 'TCP' | 'UDP';
}

export interface K8sConfig {
  // Deployment
  deploymentName: string;
  replicas: number;
  image: string;
  imagePullPolicy: 'Always' | 'IfNotPresent' | 'Never';
  containerName: string;
  containerPort: number;
  envVars: K8sEnvVar[];
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  // Service
  serviceName: string;
  serviceType: K8sServiceType;
  servicePort: number;
  targetPort: number;
  // Ingress
  ingressName: string;
  ingressEnabled: boolean;
  ingressHost: string;
  ingressPath: string;
  ingressPathType: 'Prefix' | 'Exact' | 'ImplementationSpecific';
  // Labels
  labels: K8sEnvVar[];
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export function defaultK8sConfig(): K8sConfig {
  return {
    deploymentName: 'myapp',
    replicas: 2,
    image: 'nginx:1.25-alpine',
    imagePullPolicy: 'IfNotPresent',
    containerName: 'myapp',
    containerPort: 80,
    envVars: [],
    cpuRequest: '100m',
    cpuLimit: '500m',
    memoryRequest: '128Mi',
    memoryLimit: '256Mi',
    serviceName: 'myapp',
    serviceType: 'ClusterIP',
    servicePort: 80,
    targetPort: 80,
    ingressName: 'myapp-ingress',
    ingressEnabled: false,
    ingressHost: 'myapp.example.com',
    ingressPath: '/',
    ingressPathType: 'Prefix',
    labels: [{ key: 'app', value: 'myapp' }],
  };
}

/* -------------------------------------------------------------------------- */
/* Pure logic - manifest generation                                           */
/* -------------------------------------------------------------------------- */

function labelsToObject(labels: K8sEnvVar[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of labels) {
    if (l.key) out[l.key] = l.value;
  }
  return out;
}

export function buildDeploymentManifest(cfg: K8sConfig): object {
  const labels = labelsToObject(cfg.labels);
  const env = cfg.envVars.filter((e) => e.key).map((e) => ({
    name: e.key,
    value: e.value,
  }));

  const container: Record<string, unknown> = {
    name: cfg.containerName,
    image: cfg.image,
    imagePullPolicy: cfg.imagePullPolicy,
    ports: [{ containerPort: cfg.containerPort, protocol: 'TCP' }],
  };

  if (env.length > 0) {
    container.env = env;
  }

  const resources: Record<string, Record<string, string>> = {};
  if (cfg.cpuRequest || cfg.memoryRequest) {
    resources.requests = {};
    if (cfg.cpuRequest) resources.requests.cpu = cfg.cpuRequest;
    if (cfg.memoryRequest) resources.requests.memory = cfg.memoryRequest;
  }
  if (cfg.cpuLimit || cfg.memoryLimit) {
    resources.limits = {};
    if (cfg.cpuLimit) resources.limits.cpu = cfg.cpuLimit;
    if (cfg.memoryLimit) resources.limits.memory = cfg.memoryLimit;
  }
  if (Object.keys(resources).length > 0) {
    container.resources = resources;
  }

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: cfg.deploymentName,
      labels,
    },
    spec: {
      replicas: cfg.replicas,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: {
          containers: [container],
        },
      },
    },
  };
}

export function buildServiceManifest(cfg: K8sConfig): object {
  const labels = labelsToObject(cfg.labels);
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: cfg.serviceName,
      labels,
    },
    spec: {
      type: cfg.serviceType,
      selector: labels,
      ports: [
        {
          port: cfg.servicePort,
          targetPort: cfg.targetPort,
          protocol: 'TCP',
        },
      ],
    },
  };
}

export function buildIngressManifest(cfg: K8sConfig): object {
  const labels = labelsToObject(cfg.labels);
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: cfg.ingressName,
      labels,
    },
    spec: {
      rules: [
        {
          host: cfg.ingressHost,
          http: {
            paths: [
              {
                path: cfg.ingressPath,
                pathType: cfg.ingressPathType,
                backend: {
                  service: {
                    name: cfg.serviceName,
                    port: { number: cfg.servicePort },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };
}

export function buildK8sManifests(cfg: K8sConfig): string {
  const docs: object[] = [buildDeploymentManifest(cfg), buildServiceManifest(cfg)];
  if (cfg.ingressEnabled) {
    docs.push(buildIngressManifest(cfg));
  }
  return docs
    .map((d) => yamlStringify(d, { indent: 2 }))
    .join('---\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseK8sManifestBuilderReturn {
  config: Ref<K8sConfig>;
  output: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  update: <K extends keyof K8sConfig>(key: K, value: K8sConfig[K]) => void;
  addEnvVar: () => void;
  removeEnvVar: (index: number) => void;
  updateEnvVar: (index: number, field: keyof K8sEnvVar, value: string) => void;
  addLabel: () => void;
  removeLabel: (index: number) => void;
  updateLabel: (index: number, field: keyof K8sEnvVar, value: string) => void;
  reset: () => void;
}

export function useK8sManifestBuilder(): UseK8sManifestBuilderReturn {
  const config = ref<K8sConfig>(defaultK8sConfig());

  const output = computed(() => buildK8sManifests(config.value));

  function update<K extends keyof K8sConfig>(key: K, value: K8sConfig[K]): void {
    config.value = { ...config.value, [key]: value };
  }

  function addEnvVar(): void {
    config.value = { ...config.value, envVars: [...config.value.envVars, { key: '', value: '' }] };
  }

  function removeEnvVar(index: number): void {
    config.value = { ...config.value, envVars: config.value.envVars.filter((_, i) => i !== index) };
  }

  function updateEnvVar(index: number, field: keyof K8sEnvVar, value: string): void {
    const next = config.value.envVars.map((e, i) => (i === index ? { ...e, [field]: value } : e));
    config.value = { ...config.value, envVars: next };
  }

  function addLabel(): void {
    config.value = { ...config.value, labels: [...config.value.labels, { key: '', value: '' }] };
  }

  function removeLabel(index: number): void {
    config.value = { ...config.value, labels: config.value.labels.filter((_, i) => i !== index) };
  }

  function updateLabel(index: number, field: keyof K8sEnvVar, value: string): void {
    const next = config.value.labels.map((e, i) => (i === index ? { ...e, [field]: value } : e));
    config.value = { ...config.value, labels: next };
  }

  function reset(): void {
    config.value = defaultK8sConfig();
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.config && typeof p.config === 'object') {
        config.value = { ...config.value, ...(p.config as Partial<K8sConfig>) };
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
    addLabel,
    removeLabel,
    updateLabel,
    reset,
  };
}
