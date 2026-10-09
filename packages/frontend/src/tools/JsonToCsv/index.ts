/**
 * JsonToCsv tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * No external npm dependencies are required (uses only the JSON builtin +
 * TextEncoder). The component is lazy-loaded so the JsonToCsv UI lands in
 * its own Vite chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'json-to-csv',
  name: 'JSON to CSV',
  description: 'Convert JSON arrays to CSV.',
  category: 'dev',
  icon: 'file-spreadsheet',
  keywords: ['json', 'csv', 'convert'],
  dependencies: [],
};

export {
  useJsonToCsv,
  jsonToCsv,
  parseJsonInput,
  collectColumns,
  cellToString,
  escapeField,
} from './useJsonToCsv';
export type {
  CsvDelimiter,
  JsonToCsvOptions,
  JsonToCsvResult,
  JsonToCsvError,
  JsonToCsvOutputs,
  UseJsonToCsvReturn,
} from './useJsonToCsv';

const JsonToCsv = defineAsyncComponent(
  () => import('./JsonToCsv.vue'),
);

export default JsonToCsv;
