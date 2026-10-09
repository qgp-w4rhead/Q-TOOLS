/**
 * AudioExtractor tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'audio-extractor',
  name: 'Audio Extractor',
  description:
    'Extract the audio track from a video file (MP4 â†’ MP3/AAC/WAV) via ffmpeg.wasm.',
  category: 'av',
  icon: 'file-audio',
  keywords: [
    'audio', 'extract', 'video', 'mp4', 'mp3', 'aac', 'wav', 'rip', 'demux',
    'ffmpeg',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useAudioExtractor,
  EXTRACT_FORMATS,
  AUDIO_BITRATES,
  codecCanCopy,
  firstAudioCodec,
  buildExtractArgs,
  MAX_FILE_SIZE,
} from './useAudioExtractor';
export type {
  ExtractFormat,
  ExtractFormatDef,
  FfprobeStream,
  FfprobeResult,
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseAudioExtractorReturn,
} from './useAudioExtractor';

const AudioExtractor = defineAsyncComponent(
  () => import('./AudioExtractor.vue'),
);

export default AudioExtractor;
