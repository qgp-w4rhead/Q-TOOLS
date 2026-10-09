/**
 * BasicAuthGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'basic-auth-generator',
  name: 'Basic auth generator',
  description: 'Generate HTTP Basic Authentication headers.',
  category: 'web',
  icon: 'lock',
  keywords: ['basic', 'auth', 'header', 'base64', 'http', 'authorization'],
  dependencies: [],
};

export {
  useBasicAuthGenerator,
  encodeBasicAuth,
  buildAuthHeader,
  bytesToBase64,
} from './useBasicAuthGenerator';
export type {
  BasicAuthHeader,
  UseBasicAuthGeneratorReturn,
} from './useBasicAuthGenerator';

const BasicAuthGenerator = defineAsyncComponent(
  () => import('./BasicAuthGenerator.vue'),
);

export default BasicAuthGenerator;
