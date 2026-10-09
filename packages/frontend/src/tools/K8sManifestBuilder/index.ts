/**
 * K8sManifestBuilder tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * Dependencies: `yaml` (initial bundle).
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'k8s-manifest-builder',
    name: 'Kubernetes Manifest Builder',
    description:
      'Form → Deployment, Service, and Ingress YAML manifests.',
    category: 'devops',
    icon: 'box',
    keywords: ['kubernetes', 'k8s', 'manifest', 'deployment', 'service', 'ingress', 'yaml'],
    dependencies: ['yaml'],
  },
  () => import('./K8sManifestBuilder.vue'),
);

export { metadata };

export {
  useK8sManifestBuilder,
  buildK8sManifests,
  buildDeploymentManifest,
  buildServiceManifest,
  buildIngressManifest,
  defaultK8sConfig,
} from './useK8sManifestBuilder';
export type {
  K8sServiceType,
  K8sIngressBackend,
  K8sEnvVar,
  K8sPort,
  K8sConfig,
  UseK8sManifestBuilderReturn,
} from './useK8sManifestBuilder';

export default component;
