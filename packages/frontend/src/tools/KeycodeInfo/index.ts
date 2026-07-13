/**
 * KeycodeInfo tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'keycode-info',
  name: 'Keycode info',
  description: 'Show key codes and details for pressed keys.',
  category: 'web',
  icon: 'keyboard',
  keywords: ['keycode', 'key', 'keyboard', 'event', 'keydown', 'modifier'],
  dependencies: [],
};

export {
  useKeycodeInfo,
  describeKeyEvent,
  summarizeEvent,
  eventToJson,
  KEY_LOCATION_LABELS,
  MAX_HISTORY,
} from './useKeycodeInfo';
export type {
  KeyEventInfo,
  UseKeycodeInfoReturn,
} from './useKeycodeInfo';

const KeycodeInfo = defineAsyncComponent(() => import('./KeycodeInfo.vue'));

export default KeycodeInfo;
