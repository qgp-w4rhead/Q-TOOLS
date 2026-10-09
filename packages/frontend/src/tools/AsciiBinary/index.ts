/**
 * AsciiBinary tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'text-to-ascii-binary',
  name: 'Text to ASCII binary',
  description: 'Convert text to binary (UTF-8 bytes) and back, with a configurable byte separator.',
  category: 'converter',
  icon: 'binary',
  keywords: ['ascii', 'binary', 'text', 'utf8', 'bits', 'encode', 'decode'],
  dependencies: [],
};

export {
  useAsciiBinary,
  bytesToBinary,
  binaryToBytes,
  textToBinary,
  binaryToText,
  DEFAULT_MODE,
  DEFAULT_SEPARATOR,
} from './useAsciiBinary';
export type {
  BinaryMode,
  SeparatorPreset,
  AsciiBinaryOutputs,
  UseAsciiBinaryReturn,
} from './useAsciiBinary';

const AsciiBinary = defineAsyncComponent(
  () => import('./AsciiBinary.vue'),
);

export default AsciiBinary;
