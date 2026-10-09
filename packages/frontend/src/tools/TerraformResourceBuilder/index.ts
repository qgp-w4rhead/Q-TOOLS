/**
 * TerraformResourceBuilder tool module - exports the lazy-loaded component plus
 * its metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'terraform-resource-builder',
    name: 'Terraform Resource Builder',
    description:
      'Form → HCL for AWS/Azure/GCP resources (EC2, S3, VPC, security groups, etc.).',
    category: 'devops',
    icon: 'cloud',
    keywords: ['terraform', 'hcl', 'aws', 'azure', 'gcp', 'ec2', 's3', 'vpc', 'security-group', 'iac'],
    dependencies: [],
  },
  () => import('./TerraformResourceBuilder.vue'),
);

export { metadata };

export {
  useTerraformResourceBuilder,
  buildHcl,
  defaultTerraformConfig,
} from './useTerraformResourceBuilder';
export type {
  CloudProvider,
  ResourceType,
  TerraformConfig,
  UseTerraformResourceBuilderReturn,
} from './useTerraformResourceBuilder';

export default component;
