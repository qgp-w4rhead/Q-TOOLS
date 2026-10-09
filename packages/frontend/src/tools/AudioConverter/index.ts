/**
 * AudioConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'audio-converter',
  name: 'Audio Converter',
  description:
    'Convert audio between WAV, MP3, OGG, FLAC, AAC, and M4A locally via ffmpeg.wasm.',
  category: 'av',
  icon: 'music',
  keywords: [
    'audio', 'convert', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'vorbis',
    'transcode', 'ffmpeg',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useAudioConverter,
  AUDIO_FORMATS,
  AUDIO_BITRATES,
  codecArgsForFormat,
  buildConvertArgs,
  isLosslessFormat,
  MAX_FILE_SIZE,
} from './useAudioConverter';
export type {
  AudioOutputFormat,
  AudioFormatDef,
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseAudioConverterReturn,
} from './useAudioConverter';

const AudioConverter = defineAsyncComponent(
  () => import('./AudioConverter.vue'),
);

export default AudioConverter;
