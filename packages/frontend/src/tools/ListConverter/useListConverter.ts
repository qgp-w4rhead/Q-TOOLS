/**
 * useListConverter - composable + pure logic for the List converter tool.
 *
 * Converts a list of items between seven built-in formats plus an arbitrary
 * custom delimiter:
 *
 *   - comma        `a, b, c`
 *   - newline      `a\nb\nc`
 *   - json         `["a","b","c"]`
 *   - bullet       `- a\n- b\n- c`
 *   - numbered     `1. a\n2. b\n3. c`
 *   - tab          `a\tb\tc`
 *   - pipe         `a|b|c`
 *   - custom       split/join on a user-supplied delimiter string
 *
 * Parsing is tolerant: leading/trailing whitespace around items is ignored
 * when splitting (so `a, b , c` and `a,b,c` produce the same three items),
 * and the JSON parser accepts any valid JSON array of strings (numbers are
 * stringified, nested arrays/objects are rejected to keep the output a flat
 * list of strings). Empty input produces an empty item list.
 *
 * Options:
 *   - `trim`        - trim whitespace from each parsed item (default true)
 *   - `removeDuplicates` - drop repeated items, preserving first-seen order
 *   - `customDelimiter`  - used when `from`/`to` is `'custom'`
 *
 * Pure helpers (`parseList`, `formatList`, `convertList`, `dedupe`,
 * `splitJsonArray`, `formatJsonArray`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useListConverter()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Built-in list formats. */
export type ListFormat =
  | 'comma'
  | 'newline'
  | 'json'
  | 'bullet'
  | 'numbered'
  | 'tab'
  | 'pipe'
  | 'custom';

/** All selectable formats in display order. */
export const LIST_FORMATS: ListFormat[] = [
  'comma',
  'newline',
  'json',
  'bullet',
  'numbered',
  'tab',
  'pipe',
  'custom',
];

/** Human-readable labels for each format. */
export const LIST_FORMAT_LABELS: Record<ListFormat, string> = {
  comma: 'Comma',
  newline: 'Newline',
  json: 'JSON array',
  bullet: 'Bullet list',
  numbered: 'Numbered list',
  tab: 'Tab',
  pipe: 'Pipe',
  custom: 'Custom',
};

/** Options accepted by `parseList`, `formatList`, and `convertList`. */
export interface ListConverterOptions {
  /** Trim whitespace from each parsed item. Default true. */
  trim?: boolean;
  /** Drop duplicate items, preserving first-seen order. Default false. */
  removeDuplicates?: boolean;
  /** Delimiter used when the format is `'custom'`. Default `, `. */
  customDelimiter?: string;
}

/** Result of a successful list conversion. */
export interface ListConverterResult {
  /** Formatted output text. */
  output: string;
  /** Number of items in the converted list. */
  count: number;
  /** Number of duplicates removed (0 if `removeDuplicates` is off). */
  duplicatesRemoved: number;
  /** Number of bytes in the input (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the parser or formatter. */
export interface ListConverterError {
  message: string;
  /** Source stage that produced the error. */
  stage: 'parse' | 'format';
  /** 1-based line, when available (JSON parse errors). */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
}

/**
 * Split a JSON array string into a list of strings.
 *
 * Accepts any valid JSON array. Non-array roots are rejected. Each element
 * must be a string or a number (numbers are stringified). Booleans, null,
 * nested arrays, and objects are rejected to keep the output a flat list of
 * strings - the list converter is not a generic JSON transform.
 *
 * Throws a normalised `ListConverterError` (stage: 'parse') on failure.
 */
export function splitJsonArray(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (e) {
    throw toJsonError(e, text);
  }
  if (!Array.isArray(value)) {
    throw {
      message:
        'JSON input must be an array of strings (e.g. ["a","b","c"]). The parsed value was not an array.',
      stage: 'parse',
    } as ListConverterError;
  }
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const el = value[i];
    if (typeof el === 'string') {
      out.push(el);
    } else if (typeof el === 'number' && Number.isFinite(el)) {
      out.push(String(el));
    } else {
      throw {
        message: `JSON array element at index ${i} is ${typeof el === 'object' ? 'an object' : typeof el === 'undefined' ? 'undefined' : String(el)} - only strings and numbers are supported.`,
        stage: 'parse',
      } as ListConverterError;
    }
  }
  return out;
}

/**
 * Serialise a list of strings as a JSON array (one line, no trailing newline).
 */
export function formatJsonArray(items: string[]): string {
  return JSON.stringify(items);
}

/** Remove duplicate strings, preserving first-seen order. Case-sensitive. */
export function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/**
 * Parse a list of items out of `text` according to `format`.
 *
 * - For delimiter-based formats (comma, newline, tab, pipe, custom), the
 *   text is split on the delimiter. Empty items produced by trailing
 *   delimiters are dropped (e.g. `"a,b,"` → `["a","b"]`).
 * - For `bullet`, each line beginning with `-`, `*`, or `+` (followed by
 *   optional whitespace) is treated as a list item; the marker is stripped.
 *   Blank lines are ignored.
 * - For `numbered`, each line matching `<digits>.<space>item` (or
 *   `<digits>)<space>item`) is treated as a list item; the prefix is
 *   stripped. Blank lines are ignored.
 * - For `json`, the text is parsed as a JSON array of strings/numbers.
 *
 * Throws a `ListConverterError` (stage: 'parse') only for invalid JSON.
 */
export function parseList(
  text: string,
  format: ListFormat,
  options: ListConverterOptions = {},
): string[] {
  const trim = options.trim ?? true;
  const customDelimiter = options.customDelimiter ?? ', ';

  if (text == null) return [];
  const input = String(text);

  let items: string[];

  switch (format) {
    case 'comma':
      items = splitOnDelimiter(input, ',');
      break;
    case 'newline':
      items = splitOnNewlines(input);
      break;
    case 'tab':
      items = splitOnDelimiter(input, '\t');
      break;
    case 'pipe':
      items = splitOnDelimiter(input, '|');
      break;
    case 'custom':
      items = splitOnDelimiter(input, customDelimiter);
      break;
    case 'bullet':
      items = parseBulletList(input);
      break;
    case 'numbered':
      items = parseNumberedList(input);
      break;
    case 'json':
      items = splitJsonArray(input);
      break;
    default:
      items = [];
  }

  if (trim) {
    items = items.map((s) => s.trim());
  }
  // Drop empty strings that result from trailing delimiters / blank lines.
  // (An intentionally-empty item like "" inside a JSON array is preserved
  // because splitJsonArray returns it explicitly; here we only drop empties
  // from delimiter/bullet/numbered splits.)
  if (format !== 'json') {
    items = items.filter((s) => s.length > 0);
  }

  if (options.removeDuplicates) {
    items = dedupe(items);
  }

  return items;
}

/**
 * Format a list of items as `text` according to `format`.
 *
 * - `comma`   → `a, b, c`
 * - `newline` → `a\nb\nc`
 * - `json`    → `["a","b","c"]`
 * - `bullet`  → `- a\n- b\n- c`
 * - `numbered`→ `1. a\n2. b\n3. c`
 * - `tab`     → `a\tb\tc`
 * - `pipe`    → `a|b|c`
 * - `custom`  → items joined with `customDelimiter`
 */
export function formatList(
  items: string[],
  format: ListFormat,
  options: ListConverterOptions = {},
): string {
  const customDelimiter = options.customDelimiter ?? ', ';
  switch (format) {
    case 'comma':
      return items.join(', ');
    case 'newline':
      return items.join('\n');
    case 'json':
      return formatJsonArray(items);
    case 'bullet':
      return items.map((s) => `- ${s}`).join('\n');
    case 'numbered':
      return items.map((s, i) => `${i + 1}. ${s}`).join('\n');
    case 'tab':
      return items.join('\t');
    case 'pipe':
      return items.join('|');
    case 'custom':
      return items.join(customDelimiter);
    default:
      return '';
  }
}

/**
 * Convert `input` text from `fromFormat` to `toFormat`.
 *
 * Convenience wrapper: parse → format. Returns a `ListConverterResult` with
 * metadata (item count, bytes, duplicates removed). Throws a
 * `ListConverterError` on parse failure.
 */
export function convertList(
  input: string,
  fromFormat: ListFormat,
  toFormat: ListFormat,
  options: ListConverterOptions = {},
): ListConverterResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const trim = options.trim ?? true;

  // Parse without dedupe first so we can count duplicates separately.
  const rawItems = parseList(input, fromFormat, {
    trim,
    removeDuplicates: false,
    customDelimiter: options.customDelimiter,
  });

  let items = rawItems;
  let duplicatesRemoved = 0;
  if (options.removeDuplicates) {
    const deduped = dedupe(rawItems);
    duplicatesRemoved = rawItems.length - deduped.length;
    items = deduped;
  }

  const output = formatList(items, toFormat, {
    customDelimiter: options.customDelimiter,
  });

  return {
    output,
    count: items.length,
    duplicatesRemoved,
    inputBytes,
    outputBytes: new TextEncoder().encode(output).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Split `text` on `delimiter`, dropping trailing empty segments. */
function splitOnDelimiter(text: string, delimiter: string): string[] {
  if (delimiter.length === 0) {
    // An empty custom delimiter is meaningless - treat the whole input as
    // a single item so we don't infinite-loop on split('').
    return text.length === 0 ? [] : [text];
  }
  const parts = text.split(delimiter);
  // Drop a single trailing empty string produced by a trailing delimiter
  // (e.g. "a,b," → ["a","b",""]). Preserve internal empties only when the
  // user did not request trimming - but the trim pass + filter pass below
  // will drop them anyway for non-JSON formats.
  if (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}

/** Split `text` on any of \r\n, \n, \r. */
function splitOnNewlines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

/** Parse a Markdown-style bullet list (`-`, `*`, or `+` markers). */
function parseBulletList(text: string): string[] {
  const lines = text.split(/\r\n|\n|\r/);
  const items: string[] = [];
  // Match: optional leading whitespace, one of -*+, one required space (or
  // more), then the item text.
  const markerRe = /^\s*[-*+]\s+(.*)$/;
  for (const line of lines) {
    const m = markerRe.exec(line);
    if (m) {
      items.push(m[1] ?? '');
    } else if (line.trim().length === 0) {
      // skip blank lines
      continue;
    } else {
      // A non-bullet line: treat its trimmed content as an item too, so
      // pasting a plain newline list still works in bullet mode.
      items.push(line);
    }
  }
  return items;
}

/** Parse a numbered list (`1.`, `2)`, etc.). */
function parseNumberedList(text: string): string[] {
  const lines = text.split(/\r\n|\n|\r/);
  const items: string[] = [];
  const markerRe = /^\s*\d+[.)]\s+(.*)$/;
  for (const line of lines) {
    const m = markerRe.exec(line);
    if (m) {
      items.push(m[1] ?? '');
    } else if (line.trim().length === 0) {
      continue;
    } else {
      items.push(line);
    }
  }
  return items;
}

/** Convert a raw `JSON.parse` SyntaxError into a normalised error. */
function toJsonError(err: unknown, source: string): ListConverterError {
  if (err instanceof Error) {
    const msg = err.message;
    const pos = extractPosition(msg);
    if (pos !== -1) {
      const { line, column } = posToLineCol(source, pos);
      return { message: msg, stage: 'parse', line, column };
    }
    return { message: msg, stage: 'parse' };
  }
  return { message: String(err), stage: 'parse' };
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
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface ListConverterOutputs {
  output: string;
  count: number;
  duplicatesRemoved: number;
  inputBytes: number;
  outputBytes: number;
}

export interface UseListConverterReturn {
  input: Ref<string>;
  fromFormat: Ref<ListFormat>;
  toFormat: Ref<ListFormat>;
  trim: Ref<boolean>;
  removeDuplicates: Ref<boolean>;
  customDelimiter: Ref<string>;
  outputs: Ref<ListConverterOutputs | null>;
  error: Ref<ListConverterError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  swapFormats: () => void;
  setFromFormat: (f: ListFormat) => void;
  setToFormat: (f: ListFormat) => void;
  toggleTrim: () => void;
  toggleRemoveDuplicates: () => void;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export function useListConverter(): UseListConverterReturn {
  const input = ref<string>('');
  const fromFormat = ref<ListFormat>('comma');
  const toFormat = ref<ListFormat>('newline');
  const trim = ref<boolean>(true);
  const removeDuplicates = ref<boolean>(false);
  const customDelimiter = ref<string>(', ');
  const outputs = ref<ListConverterOutputs | null>(null);
  const error = ref<ListConverterError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0 && toFormat.value !== 'json') {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = convertList(text, fromFormat.value, toFormat.value, {
        trim: trim.value,
        removeDuplicates: removeDuplicates.value,
        customDelimiter: customDelimiter.value,
      });
      outputs.value = {
        output: r.output,
        count: r.count,
        duplicatesRemoved: r.duplicatesRemoved,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as ListConverterError;
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

  function swapFormats(): void {
    const tmp = fromFormat.value;
    fromFormat.value = toFormat.value;
    toFormat.value = tmp;
    // If we have output, feed it back into the input so the swap is
    // immediately useful (matches the JSON→TOML tool's swap-and-feed-back
    // convention).
    if (outputs.value && outputs.value.output.length > 0) {
      input.value = outputs.value.output;
    }
  }

  function setFromFormat(f: ListFormat): void {
    fromFormat.value = f;
  }
  function setToFormat(f: ListFormat): void {
    toFormat.value = f;
  }
  function toggleTrim(): void {
    trim.value = !trim.value;
  }
  function toggleRemoveDuplicates(): void {
    removeDuplicates.value = !removeDuplicates.value;
  }

  watch(
    [input, fromFormat, toFormat, trim, removeDuplicates, customDelimiter],
    scheduleRun,
  );

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.fromFormat === 'string') {
        fromFormat.value = p.fromFormat as ListFormat;
      }
      if (typeof p.toFormat === 'string') {
        toFormat.value = p.toFormat as ListFormat;
      }
      if (typeof p.trim === 'boolean') trim.value = p.trim;
      if (typeof p.removeDuplicates === 'boolean') {
        removeDuplicates.value = p.removeDuplicates;
      }
      if (typeof p.customDelimiter === 'string') {
        customDelimiter.value = p.customDelimiter;
      }
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    fromFormat,
    toFormat,
    trim,
    removeDuplicates,
    customDelimiter,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    swapFormats,
    setFromFormat,
    setToFormat,
    toggleTrim,
    toggleRemoveDuplicates,
  };
}
