/**
 * AudioTrimmer tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'audio-trimmer',
  name: 'Audio Trimmer',
  description:
    'Cut audio with a waveform preview, fade in/out, and format re-export via ffmpeg.wasm.',
  category: 'av',
  icon: 'scissors',
  keywords: [
    'audio', 'trim', 'cut', 'fade', 'waveform', 'mp3', 'wav', 'ffmpeg', 'clip',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useAudioTrimmer,
  TRIM_FORMATS,
  computePeaks,
  buildTrimArgs,
  encoderForExtension,
  MAX_FILE_SIZE,
} from './useAudioTrimmer';
export type {
  TrimFormat,
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseAudioTrimmerReturn,
} from './useAudioTrimmer';

const AudioTrimmer = defineAsyncComponent(
  () => import('./AudioTrimmer.vue'),
);

export default AudioTrimmer;
