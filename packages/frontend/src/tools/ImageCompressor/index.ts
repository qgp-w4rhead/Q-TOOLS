/**
 * ImageCompressor tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'image-compressor',
  name: 'Image compressor',
  description: 'Compress images with a quality slider or target file size, with before/after preview.',
  category: 'media',
  icon: 'shrink',
  keywords: ['image', 'compress', 'optimize', 'quality', 'size', 'webp', 'jpeg'],
  dependencies: [],
};

export {
  useImageCompressor,
  parseTargetSize,
  savingsPercent,
  compressToTargetSize,
  DEFAULT_MODE,
  DEFAULT_QUALITY,
  DEFAULT_TARGET_KB,
  MAX_TARGET_ITERATIONS,
} from './useImageCompressor';
export type {
  CompressMode,
  CompressedInfo,
  UseImageCompressorReturn,
} from './useImageCompressor';

const ImageCompressor = defineAsyncComponent(
  () => import('./ImageCompressor.vue'),
);

export default ImageCompressor;
