/**
 * useJsonToCsv — composable + pure logic for the JSON → CSV converter.
 *
 * Parses JSON text (an array of objects, or a single object wrapped into a
 * one-row array) and serializes it to CSV per RFC 4180. Nested objects and
 * arrays are flattened to JSON strings so each cell is a single scalar value.
 *
 * Pure helpers (`parseJsonInput`, `jsonToCsv`, `collectColumns`, `escapeField`)
 * have no Vue dependency and can be imported standalone for unit testing or
 * reuse. The `useJsonToCsv()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * Dependencies: none (uses only the JSON builtin + TextEncoder).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Field delimiter. */
export type CsvDelimiter = 'comma' | 'semicolon' | 'tab';

/** Options accepted by `jsonToCsv`. */
export interface JsonToCsvOptions {
  /** Include a header row of column names (default true). */
  header?: boolean;
  /** Field delimiter (default 'comma'). */
  delimiter?: CsvDelimiter;
  /** Quote every field, even when not required (default false). */
  quoteAll?: boolean;
}

/** Result of a successful JSON → CSV conversion. */
export interface JsonToCsvResult {
  /** Serialized CSV text (lines separated by `\r\n` per RFC 4180). */
  csv: string;
  /** Number of data rows (excluding the header). */
  rowCount: number;
  /** Number of columns (union of keys across all rows). */
  columnCount: number;
  /** Number of bytes in the input JSON (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output CSV (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the JSON parser or CSV serializer. */
export interface JsonToCsvError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
}

/** Map a `CsvDelimiter` to its literal character. */
const DELIMITER_CHARS: Record<CsvDelimiter, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
};

/**
 * Parse JSON text into a single JS value. Throws a normalised
 * `JsonToCsvError` on failure.
 *
 * `JSON.parse` throws a `SyntaxError` whose message usually contains the
 * character position (e.g. "Unexpected token … in JSON at position 42"). We
 * convert the character position to a 1-based line/column for display.
 */
export function parseJsonInput(input: string): unknown {
  if (typeof input !== 'string') {
    throw toError(new Error('Input must be a string.'));
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw toError(e, trimmed);
  }
}

/**
 * Collect the union of column names across all rows, preserving first-seen
 * order. Only object own-keys are considered; non-object rows contribute no
 * columns of their own but still consume a row.
 */
export function collectColumns(rows: unknown[]): string[] {
  const seen = new Set<string>();
  const columns: string[] = [];
  for (const row of rows) {
    if (row !== null && typeof row === 'object' && !Array.isArray(row)) {
      for (const key of Object.keys(row as Record<string, unknown>)) {
        if (!seen.has(key)) {
          seen.add(key);
          columns.push(key);
        }
      }
    }
  }
  return columns;
}

/**
 * Convert a cell value to its CSV string representation.
 *
 * - `null` / `undefined` → empty string.
 * - `boolean` → `true` / `false`.
 * - `number` → `String(n)` (preserves `Infinity`/`NaN` as `"Infinity"`/`"NaN"`).
 * - `string` → as-is.
 * - object / array → `JSON.stringify(value)` (compact, no whitespace) so
 *   nested structures survive a round-trip through CSV.
 */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  // Object or array → compact JSON so the cell is a single scalar string.
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    // Cycles / BigInt holders — fall back to a best-effort string.
    return String(value);
  }
}

/**
 * Escape a single CSV field per RFC 4180.
 *
 * - When `quoteAll` is true, the field is always wrapped in double quotes.
 * - Otherwise the field is quoted only when it contains the delimiter, a
 *   double-quote, a CR or an LF.
 * - Any double-quote inside a quoted field is doubled (`"` → `""`).
 */
export function escapeField(
  field: string,
  delimiterChar: string,
  quoteAll: boolean,
): string {
  const needsQuote =
    quoteAll ||
    field.includes(delimiterChar) ||
    field.includes('"') ||
    field.includes('\r') ||
    field.includes('\n');
  if (!needsQuote) return field;
  return '"' + field.replace(/"/g, '""') + '"';
}

/**
 * Convert JSON text to a CSV string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - A top-level JSON array is treated as the row set. Each element should be
 *   an object; non-object elements are rendered as a single empty row (their
 *   cells are blank for every column).
 * - A top-level JSON object is wrapped into a one-row array.
 * - Any other top-level type (string/number/boolean/null) is rejected with a
 *   normalised error — CSV requires tabular (object) data.
 */
export function jsonToCsv(
  input: string,
  options: JsonToCsvOptions = {},
): JsonToCsvResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const value = parseJsonInput(input);
  if (value === undefined) {
    return { csv: '', rowCount: 0, columnCount: 0, inputBytes, outputBytes: 0 };
  }

  let rows: unknown[];
  if (Array.isArray(value)) {
    rows = value;
  } else if (value !== null && typeof value === 'object') {
    rows = [value];
  } else {
    throw toError(
      new Error(
        'CSV requires a JSON array of objects (or a single object). ' +
          'Received a ' +
          (value === null ? 'null' : typeof value) +
          ' value.',
      ),
    );
  }

  const header = options.header ?? true;
  const delimiter = options.delimiter ?? 'comma';
  const quoteAll = options.quoteAll ?? false;
  const delimiterChar = DELIMITER_CHARS[delimiter];

  const columns = collectColumns(rows);
  const lines: string[] = [];

  if (header && columns.length > 0) {
    lines.push(
      columns
        .map((c) => escapeField(c, delimiterChar, quoteAll))
        .join(delimiterChar),
    );
  }

  for (const row of rows) {
    const obj =
      row !== null && typeof row === 'object' && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : null;
    const cells = columns.map((col) =>
      escapeField(
        cellToString(obj ? obj[col] : undefined),
        delimiterChar,
        quoteAll,
      ),
    );
    lines.push(cells.join(delimiterChar));
  }

  // RFC 4180 uses CRLF line terminators.
  const csv = lines.join('\r\n') + (lines.length > 0 ? '\r\n' : '');

  return {
    csv,
    rowCount: rows.length,
    columnCount: columns.length,
    inputBytes,
    outputBytes: new TextEncoder().encode(csv).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Error helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Convert a raw `JSON.parse` SyntaxError (or any other error) into a
 * normalised `JsonToCsvError`.
 *
 * V8/Node SyntaxErrors expose the failing character position in the message
 * ("at position N"). We extract the position and translate it to a 1-based
 * line/column using the source text (when provided).
 */
function toError(err: unknown, source?: string): JsonToCsvError {
  if (err instanceof Error) {
    const anyErr = err as Error & { line?: number; column?: number };
    if (typeof anyErr.line === 'number' && typeof anyErr.column === 'number') {
      return { message: err.message, line: anyErr.line, column: anyErr.column };
    }
    if (source !== undefined) {
      const pos = extractPosition(err.message);
      if (pos !== -1) {
        const { line, column } = posToLineCol(source, pos);
        return { message: err.message, line, column };
      }
    }
    return { message: err.message };
  }
  return { message: String(err) };
}

/** Extract the character position from a V8/Node SyntaxError message. */
function extractPosition(message: string): number {
  const m = /at position (\d+)/.exec(message);
  return m ? Number(m[1]!) : -1;
}

/** Convert a 0-based character offset into a 1-based line/column pair. */
function posToLineCol(source: string, pos: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const end = Math.min(pos, source.length);
  for (let i = 0; i < end; i++) {
    const ch = source.charCodeAt(i);
    if (ch === 0x0a /* \n */) {
      line += 1;
      column = 1;
    } else if (ch !== 0x0d /* \r */) {
      column += 1;
    }
  }
  return { line, column };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface JsonToCsvOutputs {
  csv: string;
  rowCount: number;
  columnCount: number;
  inputBytes: number;
  outputBytes: number;
}

export const DEFAULT_DELIMITER: CsvDelimiter = 'comma';
export const DEFAULT_HEADER: boolean = true;
export const DEFAULT_QUOTE_ALL: boolean = false;

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseJsonToCsvReturn {
  input: Ref<string>;
  header: Ref<boolean>;
  delimiter: Ref<CsvDelimiter>;
  quoteAll: Ref<boolean>;
  outputs: Ref<JsonToCsvOutputs | null>;
  error: Ref<JsonToCsvError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  toggleHeader: () => void;
  setDelimiter: (d: CsvDelimiter) => void;
  toggleQuoteAll: () => void;
}

export function useJsonToCsv(): UseJsonToCsvReturn {
  const input = ref<string>('');
  const header = ref<boolean>(DEFAULT_HEADER);
  const delimiter = ref<CsvDelimiter>(DEFAULT_DELIMITER);
  const quoteAll = ref<boolean>(DEFAULT_QUOTE_ALL);
  const outputs = ref<JsonToCsvOutputs | null>(null);
  const error = ref<JsonToCsvError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = jsonToCsv(text, {
        header: header.value,
        delimiter: delimiter.value,
        quoteAll: quoteAll.value,
      });
      outputs.value = {
        csv: r.csv,
        rowCount: r.rowCount,
        columnCount: r.columnCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as JsonToCsvError;
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    run();
  }

  function toggleHeader(): void {
    header.value = !header.value;
  }

  function setDelimiter(d: CsvDelimiter): void {
    delimiter.value = d;
  }

  function toggleQuoteAll(): void {
    quoteAll.value = !quoteAll.value;
  }

  watch(input, scheduleRun);
  watch(header, scheduleRun);
  watch(delimiter, scheduleRun);
  watch(quoteAll, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.json === 'string') {
        input.value = p.json;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      } else if (typeof p.content === 'string') {
        input.value = p.content;
      }
      if (typeof p.header === 'boolean') header.value = p.header;
      if (
        typeof p.delimiter === 'string' &&
        (p.delimiter === 'comma' || p.delimiter === 'semicolon' || p.delimiter === 'tab')
      ) {
        delimiter.value = p.delimiter as CsvDelimiter;
      }
      if (typeof p.quoteAll === 'boolean') quoteAll.value = p.quoteAll;
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    header,
    delimiter,
    quoteAll,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    toggleHeader,
    setDelimiter,
    toggleQuoteAll,
  };
}
