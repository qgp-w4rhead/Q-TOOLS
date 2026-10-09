/**
 * IpGeolocation tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - uses the browser `fetch` API against ipapi.co.
 * Requires network access at runtime; free tier is rate-limited.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ip-geolocation',
  name: 'IP geolocation lookup',
  description:
    'Look up an IP address\'s country, region, city, ISP, and coordinates via ipapi.co.',
  category: 'network',
  icon: 'map-pin',
  keywords: ['ip', 'geolocation', 'geo', 'country', 'city', 'isp', 'asn', 'location'],
  dependencies: [],
};

export {
  useIpGeolocation,
  buildGeoUrl,
  parseGeoResponse,
} from './useIpGeolocation';
export type {
  GeoResult,
  UseIpGeolocationReturn,
} from './useIpGeolocation';

const IpGeolocation = defineAsyncComponent(
  () => import('./IpGeolocation.vue'),
);

export default IpGeolocation;
