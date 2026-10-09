/**
 * VideoTrimmer tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'video-trimmer',
  name: 'Video Trimmer',
  description:
    'Cut video clips by start/end timestamp; stream-copy when codecs allow, via ffmpeg.wasm.',
  category: 'av',
  icon: 'clapperboard',
  keywords: [
    'video', 'trim', 'cut', 'clip', 'mp4', 'keyframe', 'ffmpeg', 'split',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useVideoTrimmer,
  TRIM_MODES,
  buildVideoTrimArgs,
  canStreamCopy,
  MAX_FILE_SIZE,
} from './useVideoTrimmer';
export type {
  TrimMode,
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseVideoTrimmerReturn,
} from './useVideoTrimmer';

const VideoTrimmer = defineAsyncComponent(
  () => import('./VideoTrimmer.vue'),
);

export default VideoTrimmer;
