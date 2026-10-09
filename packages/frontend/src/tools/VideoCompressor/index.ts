/**
 * VideoCompressor tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'video-compressor',
  name: 'Video Compressor',
  description:
    'Reduce video size via resolution, bitrate, and CRF presets via ffmpeg.wasm.',
  category: 'av',
  icon: 'shrink',
  keywords: [
    'video', 'compress', 'reduce', 'size', 'crf', 'bitrate', 'mp4', 'webm',
    'ffmpeg', 'shrink',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useVideoCompressor,
  COMPRESS_FORMATS,
  RESOLUTION_PRESETS,
  ENCODE_PRESETS,
  AUDIO_BITRATE_OPTIONS,
  buildCompressArgs,
  MAX_FILE_SIZE,
} from './useVideoCompressor';
export type {
  CompressFormat,
  EncodePreset,
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseVideoCompressorReturn,
} from './useVideoCompressor';

const VideoCompressor = defineAsyncComponent(
  () => import('./VideoCompressor.vue'),
);

export default VideoCompressor;
