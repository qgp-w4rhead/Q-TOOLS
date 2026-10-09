/**
 * MediaInfoInspector tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'media-info-inspector',
  name: 'Media Info Inspector',
  description:
    'Inspect container, codecs, duration, bitrate, resolution, and streams of a media file via ffprobe.',
  category: 'av',
  icon: 'info',
  keywords: [
    'media', 'info', 'inspect', 'ffprobe', 'codec', 'bitrate', 'resolution',
    'duration', 'metadata', 'ffmpeg',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useMediaInfoInspector,
  summarizeProbe,
  formatBitrate,
  formatHz,
  parseFrameRate,
  MAX_FILE_SIZE,
} from './useMediaInfoInspector';
export type {
  FfprobeStream,
  FfprobeFormat,
  FfprobeResult,
  StreamSummary,
  MediaSummary,
  InspectStatus,
  PickedFile,
  UseMediaInfoInspectorReturn,
} from './useMediaInfoInspector';

const MediaInfoInspector = defineAsyncComponent(
  () => import('./MediaInfoInspector.vue'),
);

export default MediaInfoInspector;
