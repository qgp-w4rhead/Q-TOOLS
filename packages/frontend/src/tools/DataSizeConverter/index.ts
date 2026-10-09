/**
 * DataSizeConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between digital data size units: bytes, KB, MB, GB, TB, PB
 * using both binary (1024) and decimal (1000) conventions.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'data-size-converter',
    name: 'Data size converter',
    description: 'Convert between bytes, KB, MB, GB, TB, PB with binary (1024) and decimal (1000) modes.',
    category: 'measurement',
    icon: 'hard-drive',
    keywords: ['data', 'size', 'bytes', 'kilobytes', 'megabytes', 'gigabytes', 'terabytes', 'petabytes', 'binary', 'decimal'],
    dependencies: [],
  },
  () => import('./DataSizeConverter.vue'),
);

export { metadata };

export {
  useDataSizeConverter,
  convertDataSize,
  formatDataSize,
  DATA_SIZE_UNITS,
} from './useDataSizeConverter';
export type {
  DataSizeUnit,
  DataSizeConvention,
  UseDataSizeConverterReturn,
} from './useDataSizeConverter';

export default component;
