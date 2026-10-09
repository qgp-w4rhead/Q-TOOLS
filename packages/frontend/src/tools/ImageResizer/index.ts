/**
 * ImageResizer tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'image-resizer',
  name: 'Image resizer',
  description: 'Scale images by pixels or percent with aspect-ratio lock and batch export.',
  category: 'media',
  icon: 'scaling',
  keywords: ['image', 'resize', 'scale', 'dimensions', 'batch', 'percent', 'pixels'],
  dependencies: [],
};

export {
  useImageResizer,
  computeOutputSize,
  DEFAULT_MODE,
  DEFAULT_PERCENT,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  MAX_DIMENSION,
} from './useImageResizer';
export type {
  ResizeMode,
  ResizeItem,
  UseImageResizerReturn,
} from './useImageResizer';

const ImageResizer = defineAsyncComponent(
  () => import('./ImageResizer.vue'),
);

export default ImageResizer;
