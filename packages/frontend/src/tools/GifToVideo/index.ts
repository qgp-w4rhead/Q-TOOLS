/**
 * GifToVideo tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'gif-to-video',
  name: 'GIF to Video',
  description:
    'Convert animated GIF to MP4 or WebM for a much smaller file size via ffmpeg.wasm.',
  category: 'av',
  icon: 'file-video',
  keywords: [
    'gif', 'video', 'mp4', 'webm', 'convert', 'animated', 'compress', 'ffmpeg',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useGifToVideo,
  GIF_VIDEO_FORMATS,
  buildGifToVideoArgs,
  MAX_FILE_SIZE,
} from './useGifToVideo';
export type {
  GifVideoFormat,
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseGifToVideoReturn,
} from './useGifToVideo';

const GifToVideo = defineAsyncComponent(
  () => import('./GifToVideo.vue'),
);

export default GifToVideo;
