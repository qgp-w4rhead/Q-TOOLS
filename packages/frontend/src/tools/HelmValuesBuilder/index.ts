/**
 * HelmValuesBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'helm-values-builder',
    name: 'Helm Values Builder',
    description:
      'Form → Helm values.yaml with common chart overrides.',
    category: 'devops',
    icon: 'ship',
    keywords: ['helm', 'values', 'yaml', 'chart', 'override', 'kubernetes', 'k8s'],
    dependencies: [],
  },
  () => import('./HelmValuesBuilder.vue'),
);

export { metadata };

export {
  useHelmValuesBuilder,
  buildValuesYaml,
  defaultHelmConfig,
} from './useHelmValuesBuilder';
export type {
  HelmConfig,
  UseHelmValuesBuilderReturn,
} from './useHelmValuesBuilder';

export default component;
