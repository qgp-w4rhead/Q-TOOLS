/**
 * CameraRecorder tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'camera-recorder',
  name: 'Camera recorder',
  description: 'Record video from your webcam via MediaRecorder and download as WebM.',
  category: 'media',
  icon: 'video',
  keywords: ['camera', 'record', 'video', 'webcam', 'media', 'webm', 'mediarecorder'],
  dependencies: [],
  // Iframe embedding requires the parent to grant camera + microphone perms.
  iframeRequirements: ['camera; microphone'],
};

export {
  useCameraRecorder,
  parseResolution,
  formatDuration,
  listSupportedMimeTypes,
  pickPreferredMimeType,
  isSecureContextAvailable,
  mimeExtension,
  RESOLUTION_PRESETS,
  MIME_CANDIDATES,
  DEFAULT_RESOLUTION,
  DEFAULT_MIME,
} from './useCameraRecorder';
export type {
  ResolutionPreset,
  Resolution,
  UseCameraRecorderReturn,
} from './useCameraRecorder';

const CameraRecorder = defineAsyncComponent(
  () => import('./CameraRecorder.vue'),
);

export default CameraRecorder;
