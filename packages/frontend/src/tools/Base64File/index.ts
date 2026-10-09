/**
 * Base64File tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'base64-file-converter',
  name: 'Base64 file converter',
  description: 'Convert files to and from Base64.',
  category: 'converter',
  icon: 'file-up',
  keywords: ['base64', 'file', 'data-uri'],
  dependencies: [],
};

export {
  useBase64File,
  readFileAsBytes,
  readFileAsDataURL,
  parseDataUri,
  buildDataUri,
  downloadBytes,
  formatFileSize,
  guessExtension,
  stripDataUri,
  MAX_FILE_SIZE,
  DEFAULT_DOWNLOAD_NAME,
} from './useBase64File';
export type {
  Base64FileMode,
  ParsedDataUri,
  EncodeFileState,
  DecodeFileState,
  UseBase64FileReturn,
} from './useBase64File';

const Base64File = defineAsyncComponent(
  () => import('./Base64File.vue'),
);

export default Base64File;
