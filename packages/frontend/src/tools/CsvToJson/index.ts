/**
 * CsvToJson tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert CSV data to JSON arrays of objects with configurable delimiter,
 * header row, and quote handling.
 *
 * No external dependencies - pure string parsing only.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'csv-to-json',
  name: 'CSV to JSON',
  description: 'Convert CSV data to JSON with configurable delimiter and header row.',
  category: 'converter',
  icon: 'file-spreadsheet',
  keywords: ['csv', 'json', 'convert', 'delimiter', 'comma', 'tab', 'semicolon'],
  dependencies: [],
};

export {
  useCsvToJson,
  csvToJson,
} from './useCsvToJson';
export type {
  UseCsvToJsonReturn,
} from './useCsvToJson';

const CsvToJson = defineAsyncComponent(
  () => import('./CsvToJson.vue'),
);

export default CsvToJson;
