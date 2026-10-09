/**
 * ImageRedactor tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'image-redactor',
  name: 'Image redactor / blur',
  description: 'Draw boxes to blur or pixelate regions of an image; doubles as a privacy tool.',
  category: 'media',
  icon: 'eye-off',
  keywords: ['image', 'redact', 'blur', 'pixelate', 'censor', 'privacy', 'hide'],
  dependencies: [],
};

export {
  useImageRedactor,
  normalizeRect,
  clampRect,
  isUsableRect,
  applyRedaction,
  REDACT_MODES,
  DEFAULT_MODE,
  DEFAULT_STRENGTH,
  MIN_STRENGTH,
  MAX_STRENGTH,
} from './useImageRedactor';
export type {
  RedactRect,
  RedactMode,
  UseImageRedactorReturn,
} from './useImageRedactor';

const ImageRedactor = defineAsyncComponent(
  () => import('./ImageRedactor.vue'),
);

export default ImageRedactor;
