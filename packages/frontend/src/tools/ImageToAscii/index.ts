/**
 * ImageToAscii tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'image-to-ascii',
  name: 'Image to ASCII art',
  description: 'Render an image as ASCII text with charset and width controls.',
  category: 'media',
  icon: 'type',
  keywords: ['image', 'ascii', 'art', 'text', 'convert', 'render'],
  dependencies: [],
};

export {
  useImageToAscii,
  imageToAscii,
  luminanceToChar,
  CHARSETS,
  CHARSET_LABELS,
  DEFAULT_WIDTH,
  MIN_WIDTH,
  MAX_WIDTH,
  DEFAULT_CHARSET,
  DEFAULT_CUSTOM_CHARSET,
} from './useImageToAscii';
export type {
  CharsetPreset,
  UseImageToAsciiReturn,
} from './useImageToAscii';

const ImageToAscii = defineAsyncComponent(
  () => import('./ImageToAscii.vue'),
);

export default ImageToAscii;
