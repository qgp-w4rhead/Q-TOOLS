/**
 * SriHashGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'sri-hash-generator',
    name: 'SRI Hash Generator',
    description:
      'Generate Subresource Integrity (sha256/384/512) attributes for script and link tags.',
    category: 'security',
    icon: 'shield-check',
    keywords: [
      'sri', 'subresource', 'integrity', 'sha256', 'sha384', 'sha512', 'cdn',
      'script', 'link', 'hash',
    ],
    dependencies: [],
  },
  () => import('./SriHashGenerator.vue'),
);

export { metadata };

export {
  useSriHashGenerator,
  sriHash,
  sriHashAll,
  buildTag,
  bufferToBase64,
  readFileBytes,
  formatSize,
  SRI_ALGORITHMS,
  SRI_PREFIX,
  MAX_FILE_SIZE,
} from './useSriHashGenerator';
export type {
  SriAlgorithm,
  SriTagKind,
  SriInputMode,
  SriResult,
  UseSriHashGeneratorReturn,
} from './useSriHashGenerator';

export default component;
