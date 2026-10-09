/**
 * ExifViewer tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'exif-viewer',
  name: 'EXIF viewer',
  description: 'Inspect camera, lens, GPS, and metadata embedded in a photo.',
  category: 'media',
  icon: 'info',
  keywords: ['exif', 'metadata', 'camera', 'gps', 'photo', 'jpeg', 'inspect'],
  dependencies: [],
};

export {
  useExifViewer,
  findExifSegment,
  parseExif,
  formatGpsCoord,
} from './useExifViewer';
export type {
  ExifEntry,
  ExifResult,
  UseExifViewerReturn,
} from './useExifViewer';

const ExifViewer = defineAsyncComponent(
  () => import('./ExifViewer.vue'),
);

export default ExifViewer;
