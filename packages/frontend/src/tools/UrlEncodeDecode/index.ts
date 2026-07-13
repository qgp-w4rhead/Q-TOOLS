/**
 * UrlEncodeDecode tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'url-encode-decode',
  name: 'URL encode/decode',
  description: 'Percent-encode and decode URL strings.',
  category: 'web',
  icon: 'link',
  keywords: ['url', 'encode', 'decode', 'percent'],
  dependencies: [],
};

export {
  useUrlEncodeDecode,
  encodeUrl,
  decodeUrl,
  DEFAULT_DIRECTION,
  DEFAULT_SCOPE,
} from './useUrlEncodeDecode';
export type {
  UrlDirection,
  UrlScope,
  UrlEncodeDecodeOutputs,
  UseUrlEncodeDecodeReturn,
} from './useUrlEncodeDecode';

const UrlEncodeDecode = defineAsyncComponent(
  () => import('./UrlEncodeDecode.vue'),
);

export default UrlEncodeDecode;
