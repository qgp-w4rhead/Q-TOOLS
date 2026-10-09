/**
 * MetadataStripper tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'metadata-stripper',
  name: 'EXIF / metadata stripper',
  description: 'Re-encode an image via Canvas to wipe EXIF/GPS metadata for privacy.',
  category: 'media',
  icon: 'eraser',
  keywords: ['exif', 'metadata', 'strip', 'remove', 'privacy', 'gps', 'clean'],
  dependencies: [],
};

export {
  useMetadataStripper,
  DEFAULT_BACKGROUND,
} from './useMetadataStripper';
export type {
  StripResult,
  UseMetadataStripperReturn,
} from './useMetadataStripper';

const MetadataStripper = defineAsyncComponent(
  () => import('./MetadataStripper.vue'),
);

export default MetadataStripper;
