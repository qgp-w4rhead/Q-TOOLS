/**
 * DataRateConverter tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between data rate units: bps, kbps, Mbps, Gbps, Tbps, B/s, KB/s,
 * MB/s, GB/s, KiB/s, MiB/s, GiB/s, and baud. Includes a transfer-time
 * helper (file size + rate → duration).
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'data-rate-converter',
    name: 'Data rate converter',
    description: 'Convert between data rate units (bps→Tbps, B/s→GiB/s, baud) with a transfer-time helper.',
    category: 'measurement',
    icon: 'activity',
    keywords: ['data rate', 'bandwidth', 'bps', 'mbps', 'gbps', 'mb/s', 'kib/s', 'baud', 'transfer time', 'download'],
    dependencies: [],
  },
  () => import('./DataRateConverter.vue'),
);

export { metadata };

export {
  useDataRateConverter,
  DATA_RATE_UNITS,
  FILE_SIZE_UNITS,
  convertDataRate,
  formatDataRate,
  transferSeconds,
  formatDuration,
} from './useDataRateConverter';
export type { UseDataRateConverterReturn } from './useDataRateConverter';

export default component;
