/**
 * TerraformImportBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'terraform-import-builder',
    name: 'Terraform Import Command Builder',
    description:
      'Generate terraform import commands from a list of resource addresses and IDs.',
    category: 'devops',
    icon: 'download',
    keywords: ['terraform', 'import', 'command', 'resource', 'address', 'id', 'iac'],
    dependencies: [],
  },
  () => import('./TerraformImportBuilder.vue'),
);

export { metadata };

export {
  useTerraformImportBuilder,
  buildImportCommands,
  defaultImportConfig,
} from './useTerraformImportBuilder';
export type {
  ImportEntry,
  ImportConfig,
  UseTerraformImportBuilderReturn,
} from './useTerraformImportBuilder';

export default component;
