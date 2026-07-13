/**
 * Base64String tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'base64-string',
  name: 'Base64 string encoder/decoder',
  description: 'Encode and decode Base64 strings (UTF-8 safe).',
  category: 'converter',
  icon: 'file-code',
  keywords: ['base64', 'encode', 'decode', 'urlsafe'],
  dependencies: [],
};

export {
  useBase64String,
  encodeBase64,
  decodeBase64,
  bytesToBase64,
  base64ToBytes,
  toUrlSafe,
  fromUrlSafe,
  DEFAULT_MODE,
} from './useBase64String';
export type {
  Base64Mode,
  Base64StringOutputs,
  UseBase64StringReturn,
} from './useBase64String';

const Base64String = defineAsyncComponent(
  () => import('./Base64String.vue'),
);

export default Base64String;
