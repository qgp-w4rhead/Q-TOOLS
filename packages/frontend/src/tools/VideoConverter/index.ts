/**
 * VideoConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'video-converter',
  name: 'Video Converter',
  description:
    'Convert video between MP4, WebM, MOV, AVI, and MKV with codec/CRF controls via ffmpeg.wasm.',
  category: 'av',
  icon: 'film',
  keywords: [
    'video', 'convert', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'h264', 'vp9',
    'transcode', 'ffmpeg', 'crf',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useVideoConverter,
  VIDEO_FORMATS,
  ENCODE_PRESETS,
  buildVideoConvertArgs,
  crfToQscale,
  MAX_FILE_SIZE,
} from './useVideoConverter';
export type {
  VideoOutputFormat,
  VideoFormatDef,
  EncodePreset,
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseVideoConverterReturn,
} from './useVideoConverter';

const VideoConverter = defineAsyncComponent(
  () => import('./VideoConverter.vue'),
);

export default VideoConverter;
