/**
 * ImageCropper tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'image-cropper',
  name: 'Image cropper',
  description: 'Drag-select crop with preset ratios (16:9, 1:1, 4:3, freeform).',
  category: 'media',
  icon: 'crop',
  keywords: ['image', 'crop', 'cut', 'aspect', 'ratio', 'trim'],
  dependencies: [],
};

export {
  useImageCropper,
  presetRatio,
  normalizeRect,
  clampRect,
  rectFromPoints,
  isUsableRect,
  ASPECT_PRESETS,
  DEFAULT_PRESET,
} from './useImageCropper';
export type {
  CropRect,
  AspectPreset,
  UseImageCropperReturn,
} from './useImageCropper';

const ImageCropper = defineAsyncComponent(
  () => import('./ImageCropper.vue'),
);

export default ImageCropper;
