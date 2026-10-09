/**
 * ScreenRecorder tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'screen-recorder',
  name: 'Screen recorder',
  description: 'Record screen/window/tab via getDisplayMedia + MediaRecorder.',
  category: 'media',
  icon: 'monitor',
  keywords: ['screen', 'record', 'capture', 'display', 'video', 'webm', 'mediarecorder'],
  dependencies: [],
  // Iframe embedding requires the parent to grant display-capture perms.
  iframeRequirements: ['display-capture'],
};

export {
  useScreenRecorder,
  formatDuration,
  listSupportedMimeTypes,
  pickPreferredMimeType,
  isDisplayCaptureAvailable,
  mimeExtension,
  MIME_CANDIDATES,
  DEFAULT_MIME,
} from './useScreenRecorder';
export type { UseScreenRecorderReturn } from './useScreenRecorder';

const ScreenRecorder = defineAsyncComponent(
  () => import('./ScreenRecorder.vue'),
);

export default ScreenRecorder;
