/**
 * AudioMerger tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'audio-merger',
  name: 'Audio Merger',
  description:
    'Concatenate multiple audio files into a single track via ffmpeg.wasm.',
  category: 'av',
  icon: 'merge',
  keywords: [
    'audio', 'merge', 'join', 'concat', 'combine', 'mp3', 'wav', 'ffmpeg',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useAudioMerger,
  MERGE_FORMATS,
  AUDIO_BITRATES,
  buildConcatList,
  buildMergeArgs,
  MAX_FILES,
  MAX_FILE_SIZE,
} from './useAudioMerger';
export type {
  MergeFormat,
  MergeItem,
  ConvertStatus,
  ConvertResult,
  UseAudioMergerReturn,
} from './useAudioMerger';

const AudioMerger = defineAsyncComponent(
  () => import('./AudioMerger.vue'),
);

export default AudioMerger;
