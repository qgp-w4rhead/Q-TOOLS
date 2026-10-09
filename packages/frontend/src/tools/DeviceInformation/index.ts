/**
 * DeviceInformation tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'device-information',
  name: 'Device information',
  description: 'Show browser, OS, and device information.',
  category: 'web',
  icon: 'monitor',
  keywords: ['device', 'browser', 'useragent', 'screen', 'viewport', 'hardware'],
  dependencies: [],
};

export {
  useDeviceInformation,
  collectDeviceInfo,
  UNAVAILABLE,
} from './useDeviceInformation';
export type {
  InfoField,
  InfoGroup,
  DeviceInfo,
  UseDeviceInformationReturn,
} from './useDeviceInformation';

const DeviceInformation = defineAsyncComponent(
  () => import('./DeviceInformation.vue'),
);

export default DeviceInformation;
