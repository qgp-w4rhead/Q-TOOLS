/**
 * ImageConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'image-converter',
  name: 'Image converter',
  description: 'Convert images between PNG, JPEG, WebP, and AVIF locally via Canvas.',
  category: 'media',
  icon: 'repeat',
  keywords: ['image', 'convert', 'png', 'jpeg', 'webp', 'avif', 'format', 'canvas'],
  dependencies: [],
};

export {
  useImageConverter,
  normalizeQuality,
  formatLabel,
  sizeChangePercent,
  describeSizeChange,
  DEFAULT_FORMAT,
  DEFAULT_QUALITY,
  DEFAULT_BACKGROUND,
} from './useImageConverter';
export type {
  SourceInfo,
  ConvertedInfo,
  UseImageConverterReturn,
} from './useImageConverter';

const ImageConverter = defineAsyncComponent(
  () => import('./ImageConverter.vue'),
);

export default ImageConverter;
