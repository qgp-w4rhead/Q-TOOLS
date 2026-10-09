/**
 * TerraformModuleBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'terraform-module-builder',
    name: 'Terraform Module Generator',
    description:
      'Generate reusable module scaffolding (main.tf, variables.tf, outputs.tf) from inputs.',
    category: 'devops',
    icon: 'boxes',
    keywords: ['terraform', 'module', 'scaffold', 'main.tf', 'variables.tf', 'outputs.tf', 'iac'],
    dependencies: [],
  },
  () => import('./TerraformModuleBuilder.vue'),
);

export { metadata };

export {
  useTerraformModuleBuilder,
  buildModuleFiles,
  defaultModuleConfig,
} from './useTerraformModuleBuilder';
export type {
  ModuleVariable,
  ModuleOutput,
  ModuleConfig,
  UseTerraformModuleBuilderReturn,
} from './useTerraformModuleBuilder';

export default component;
