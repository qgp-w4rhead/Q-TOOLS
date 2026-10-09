/**
 * AudioMetadataEditor tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'audio-metadata-editor',
  name: 'Audio Metadata Editor',
  description:
    'View and edit ID3 and Vorbis tags (title, artist, album, cover art) via ffmpeg.wasm.',
  category: 'av',
  icon: 'file-music',
  keywords: [
    'audio', 'metadata', 'id3', 'tags', 'mp3', 'flac', 'vorbis', 'cover',
    'artist', 'album', 'ffmpeg',
  ],
  dependencies: ['@ffmpeg/core'],
};

export {
  useAudioMetadataEditor,
  TAG_FIELDS,
  tagsFromProbe,
  hasCoverStream,
  buildTagWriteArgs,
  buildTagCoverArgs,
  buildCoverExtractArgs,
  MAX_FILE_SIZE,
} from './useAudioMetadataEditor';
export type {
  TagMap,
  FfprobeStream,
  FfprobeResult,
  EditorStatus,
  PickedFile,
  WriteResult,
  UseAudioMetadataEditorReturn,
} from './useAudioMetadataEditor';

const AudioMetadataEditor = defineAsyncComponent(
  () => import('./AudioMetadataEditor.vue'),
);

export default AudioMetadataEditor;
