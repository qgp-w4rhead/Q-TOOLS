/**
 * VolumeNormalizer tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'volume-normalizer',
  name: 'Volume Normalizer',
  description:
    'Normalize or boost audio loudness (peak / EBU R128) and export via ffmpeg.wasm.',
  category: 'av',
  icon: 'volume-2',
  keywords: [
    'audio', 'volume', 'normalize', 'loudness', 'lufs', 'ebu', 'r128', 'gain',
    'boost', 'ffmpeg',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useVolumeNormalizer,
  NORMALIZE_MODES,
  NORMALIZE_FORMATS,
  parseVolumeDetect,
  buildMeasureArgs,
  buildNormalizeArgs,
  buildLoudnormArgs,
  encoderArgs,
  MAX_FILE_SIZE,
} from './useVolumeNormalizer';
export type {
  NormalizeMode,
  NormalizeFormat,
  VolumeMeasurement,
  ConvertStatus,
  PickedFile,
  ConvertResult,
  UseVolumeNormalizerReturn,
} from './useVolumeNormalizer';

const VolumeNormalizer = defineAsyncComponent(
  () => import('./VolumeNormalizer.vue'),
);

export default VolumeNormalizer;
