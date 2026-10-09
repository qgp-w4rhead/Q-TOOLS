/**
 * useCsvToJson - composable + pure logic for the CSV to JSON converter tool.
 *
 * Parses CSV data into a JSON array of objects (when a header row is present)
 * or a JSON array of arrays (when no header row). Supports configurable
 * delimiters (comma, semicolon, tab, pipe) and handles quoted fields with
 * embedded delimiters and newlines.
 *
 * All computations are pure string parsing - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface UseCsvToJsonReturn {
  input: Ref<string>;
  delimiter: Ref<string>;
  hasHeader: Ref<boolean>;
  output: Ref<string>;
  rowCount: Ref<number>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Parse a single CSV row, handling quoted fields with embedded delimiters
 * and newlines.
 */
function parseCsvRow(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);

  return fields;
}

/**
 * Split CSV text into rows, handling quoted newlines.
 */
function splitCsvRows(text: string, _delimiter: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) rows.push(current);

  return rows;
}

/**
 * Convert CSV text to a JSON string.
 *
 * Options:
 *   - `delimiter` - the field delimiter (default: ',')
 *   - `hasHeader` - if true, the first row is used as object keys
 *
 * Returns an object with the JSON string, row count, and error (if any).
 */
export function csvToJson(
  input: string,
  delimiter: string,
  hasHeader: boolean,
): { json: string; count: number; error: string } {
  if (!input.trim()) {
    return { json: '', count: 0, error: '' };
  }

  try {
    const rows = splitCsvRows(input, delimiter);
    if (rows.length === 0) {
      return { json: '[]', count: 0, error: '' };
    }

    const parsedRows = rows.map((row) => parseCsvRow(row, delimiter));

    let result: unknown;

    if (hasHeader) {
      const headers = parsedRows[0] ?? [];
      const dataRows = parsedRows.slice(1);
      result = dataRows.map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] ?? '';
        });
        return obj;
      });
    } else {
      result = parsedRows;
    }

    return {
      json: JSON.stringify(result, null, 2),
      count: hasHeader ? (parsedRows.length - 1) : parsedRows.length,
      error: '',
    };
  } catch (e) {
    return {
      json: '',
      count: 0,
      error: e instanceof Error ? e.message : 'Failed to parse CSV.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useCsvToJson(): UseCsvToJsonReturn {
  const input = ref<string>('name,age,city\nAlice,30,London\nBob,25,Paris');
  const delimiter = ref<string>(',');
  const hasHeader = ref<boolean>(true);
  const output = ref<string>('');
  const rowCount = ref<number>(0);
  const error = ref<string>('');

  function recompute(): void {
    const result = csvToJson(input.value, delimiter.value, hasHeader.value);
    output.value = result.json;
    rowCount.value = result.count;
    error.value = result.error;
  }

  function reset(): void {
    input.value = '';
    delimiter.value = ',';
    hasHeader.value = true;
    recompute();
  }

  watch([input, delimiter, hasHeader], () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      }
      if (typeof p.delimiter === 'string') {
        delimiter.value = p.delimiter;
      }
      if (typeof p.hasHeader === 'boolean') {
        hasHeader.value = p.hasHeader;
      }
    },
  });

  watch(output, () => {
    if (isEmbed.value) {
      sendOutput({
        output: output.value,
        count: rowCount.value,
        error: error.value,
      });
    }
  });

  return {
    input,
    delimiter,
    hasHeader,
    output,
    rowCount,
    error,
    isEmbed,
    embedInput,
    reset,
  };
}
