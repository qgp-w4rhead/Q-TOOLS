/**
 * VideoToGif tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'video-to-gif',
  name: 'Video to GIF',
  description:
    'Convert video clips to animated GIF with fps, width, and trim controls via ffmpeg.wasm.',
  category: 'av',
  icon: 'image',
  keywords: [
    'video', 'gif', 'animated', 'convert', 'clip', 'fps', 'ffmpeg', 'meme',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useVideoToGif,
  buildGifArgs,
  clampFps,
  clampWidth,
  clampColors,
  MAX_FILE_SIZE,
} from './useVideoToGif';
export type {
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseVideoToGifReturn,
} from './useVideoToGif';

const VideoToGif = defineAsyncComponent(
  () => import('./VideoToGif.vue'),
);

export default VideoToGif;
