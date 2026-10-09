/**
 * ListConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * No external dependencies - pure JS string/array manipulation only.
 * The component itself is lazy-loaded so the ListConverter UI lands in its
 * own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'list-converter',
  name: 'List converter',
  description: 'Convert lists between formats (CSV, JSON, arrays).',
  category: 'converter',
  icon: 'list',
  keywords: ['list', 'csv', 'array', 'convert'],
  dependencies: [],
};

export {
  useListConverter,
  parseList,
  formatList,
  convertList,
  dedupe,
  splitJsonArray,
  formatJsonArray,
  LIST_FORMATS,
  LIST_FORMAT_LABELS,
} from './useListConverter';
export type {
  ListFormat,
  ListConverterOptions,
  ListConverterResult,
  ListConverterError,
  ListConverterOutputs,
  UseListConverterReturn,
} from './useListConverter';

const ListConverter = defineAsyncComponent(
  () => import('./ListConverter.vue'),
);

export default ListConverter;
