/**
 * useXmlToJson - composable + pure logic for the XML → JSON converter.
 *
 * Parses XML text via `fast-xml-parser`'s `XMLParser` and emits pretty-printed
 * (or compact) JSON. The `fast-xml-parser` package is part of the initial
 * bundle per `tech-stack.md`, so it is statically imported here - no dynamic
 * import, no separate Vite chunk.
 *
 * Pure helpers (`parseXml`, `xmlToJson`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useXmlToJson()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * Dependencies: `fast-xml-parser` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation mode for the JSON output. */
export type JsonIndent = 2 | 4 | 0;

/**
 * Array mode for the XML parser.
 *
 * - `auto`   - default behaviour: a tag becomes an array only when it appears
 *              more than once at the same level. Single-occurrence tags are
 *              scalars/objects. This is `fast-xml-parser`'s default.
 * - `always` - every element tag is wrapped in an array (`isArray: () => true`),
 *              even single-occurrence ones. Useful when the consumer needs a
 *              predictable structure for code consumption.
 */
export type ArrayMode = 'auto' | 'always';

/** Options accepted by the pure `xmlToJson` helper. */
export interface XmlToJsonOptions {
  /** Prefix prepended to attribute names in the parsed object. Default `@_`. */
  attributeNamePrefix: string;
  /** Array mode. Default `auto`. */
  arrayMode: ArrayMode;
  /** Trim surrounding whitespace from tag/attribute values. Default `true`. */
  trimValues: boolean;
  /** JSON output indent. `0` = compact. Default `2`. */
  indent: JsonIndent;
}

/** Result of a successful XML → JSON conversion. */
export interface XmlToJsonResult {
  /** Pretty-printed (or compact) JSON string. */
  json: string;
  /** Number of top-level keys in the parsed object (0 for an empty document). */
  rootKeyCount: number;
  /** Number of bytes in the input XML (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output JSON (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the XML parser. */
export interface XmlParseError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
}

export const DEFAULT_ATTRIBUTE_PREFIX = '@_';
export const DEFAULT_ARRAY_MODE: ArrayMode = 'auto';
export const DEFAULT_TRIM = true;
export const DEFAULT_INDENT: JsonIndent = 2;

/** Build a `fast-xml-parser` `XMLParser` instance from the given options. */
export function buildParser(opts: XmlToJsonOptions): XMLParser {
  const isArray = opts.arrayMode === 'always' ? () => true : undefined;
  return new XMLParser({
    attributeNamePrefix: opts.attributeNamePrefix,
    ignoreAttributes: false,
    trimValues: opts.trimValues,
    // `isArray: undefined` lets fast-xml-parser use its default behaviour
    // (repeated tags → arrays, single tags → scalars).
    ...(isArray ? { isArray } : {}),
    // Keep CDATA and comments out of the JSON by default - they would otherwise
    // surface as `__cdata` / `__comment` keys. Users wanting them can extend
    // this later.
    cdataPropName: false,
    commentPropName: false,
    // Parse tag values (numbers, booleans, null) into native JS types.
    parseTagValue: true,
    parseAttributeValue: true,
    // Remove namespace prefixes from tag/attribute names for cleaner JSON.
    removeNSPrefix: false,
  });
}

/**
 * Validate XML text using `fast-xml-parser`'s `XMLValidator`. Returns `null`
 * if valid, or a normalised `XmlParseError` if malformed. `XMLValidator` is
 * deprecated in v5 in favour of the separate `fast-xml-validator` package, but
 * it remains functional and is part of the same `fast-xml-parser` dependency
 * already listed in `tech-stack.md` - no new dependency is introduced.
 */
export function validateXml(input: string): XmlParseError | null {
  const result = XMLValidator.validate(input);
  if (result === true) return null;
  // `ValidationError` shape: `{ err: { code, msg, line, col } }`
  const err = (result as { err: { code: string; msg: string; line: number; col: number } }).err;
  return {
    message: err.msg,
    line: err.line,
    column: err.col,
  };
}

/**
 * Parse XML text into a plain JS object. Throws a normalised `XmlParseError`
 * on failure.
 *
 * - Empty input → `null` (caller treats as "nothing to convert").
 * - Pre-validates with `XMLValidator` to surface meaningful line/column
 *   errors for malformed XML (the `XMLParser` itself is lenient and silently
 *   accepts many malformed documents).
 */
export function parseXml(
  input: string,
  opts: XmlToJsonOptions,
): Record<string, unknown> | null {
  if (typeof input !== 'string') {
    throw toXmlError(new Error('Input must be a string.'));
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Pre-validate to catch malformed XML with good line/column errors.
  const validationError = validateXml(trimmed);
  if (validationError) throw validationError;

  try {
    const parser = buildParser(opts);
    const parsed = parser.parse(trimmed);
    // `XMLParser.parse` returns an object whose root key is the document
    // element. For an empty document it may return `{}`.
    if (parsed === null || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch (e) {
    throw toXmlError(e);
  }
}

/**
 * Convert XML text to a JSON string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - `indent: 0` → compact, single-line JSON.
 */
export function xmlToJson(
  input: string,
  opts: XmlToJsonOptions,
): XmlToJsonResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const obj = parseXml(input, opts);
  if (obj === null) {
    return { json: '', rootKeyCount: 0, inputBytes, outputBytes: 0 };
  }

  const json = JSON.stringify(obj, null, opts.indent === 0 ? undefined : opts.indent);
  return {
    json,
    rootKeyCount: Object.keys(obj).length,
    inputBytes,
    outputBytes: new TextEncoder().encode(json).length,
  };
}

/**
 * Convert a raw `fast-xml-parser` error (or any thrown value) into a normalised
 * `XmlParseError`. `fast-xml-parser` errors typically embed line/column in the
 * message (e.g. `"...Line: 3 Column: 12"`); we extract them when present.
 */
function toXmlError(err: unknown): XmlParseError {
  if (err instanceof Error) {
    const msg = err.message || String(err);
    const { message, line, column } = extractLineColumn(msg);
    return { message, line, column };
  }
  const msg = String(err);
  const { message, line, column } = extractLineColumn(msg);
  return { message, line, column };
}

/**
 * Extract a 1-based line/column from a `fast-xml-parser` error message.
 * Messages look like: `Issue: foo. Line: 3 Column: 12` or
 * `...at line 3, column 12`. Returns the cleaned message and any numbers found.
 */
function extractLineColumn(raw: string): {
  message: string;
  line?: number;
  column?: number;
} {
  let line: number | undefined;
  let column: number | undefined;
  let message = raw;

  // Pattern: "Line: 3 Column: 12" (fast-xml-parser v5 style)
  const lc = /Line:\s*(\d+)\s+Column:\s*(\d+)/i.exec(raw);
  if (lc) {
    line = Number(lc[1]);
    column = Number(lc[2]);
    message = raw.replace(/Line:\s*\d+\s+Column:\s*\d+/i, '').trim();
  } else {
    // Pattern: "at line 3, column 12"
    const lc2 = /at line (\d+),?\s*column (\d+)/i.exec(raw);
    if (lc2) {
      line = Number(lc2[1]);
      column = Number(lc2[2]);
      message = raw.replace(/at line \d+,?\s*column \d+/i, '').trim();
    }
  }

  // Tidy trailing punctuation/whitespace left after stripping the location.
  message = message.replace(/[\s.;]+$/, '').trim();
  if (message.length === 0) message = raw;
  return { message, line, column };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface XmlToJsonOutputs {
  json: string;
  rootKeyCount: number;
  inputBytes: number;
  outputBytes: number;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseXmlToJsonReturn {
  input: Ref<string>;
  attributeNamePrefix: Ref<string>;
  arrayMode: Ref<ArrayMode>;
  trimValues: Ref<boolean>;
  indent: Ref<JsonIndent>;
  outputs: Ref<XmlToJsonOutputs | null>;
  error: Ref<XmlParseError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setArrayMode: (m: ArrayMode) => void;
  setIndent: (i: JsonIndent) => void;
  setTrim: (v: boolean) => void;
  setAttributePrefix: (v: string) => void;
}

export function useXmlToJson(): UseXmlToJsonReturn {
  const input = ref<string>('');
  const attributeNamePrefix = ref<string>(DEFAULT_ATTRIBUTE_PREFIX);
  const arrayMode = ref<ArrayMode>(DEFAULT_ARRAY_MODE);
  const trimValues = ref<boolean>(DEFAULT_TRIM);
  const indent = ref<JsonIndent>(DEFAULT_INDENT);
  const outputs = ref<XmlToJsonOutputs | null>(null);
  const error = ref<XmlParseError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function opts(): XmlToJsonOptions {
    return {
      attributeNamePrefix: attributeNamePrefix.value,
      arrayMode: arrayMode.value,
      trimValues: trimValues.value,
      indent: indent.value,
    };
  }

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = xmlToJson(text, opts());
      outputs.value = {
        json: r.json,
        rootKeyCount: r.rootKeyCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as XmlParseError;
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

  function setArrayMode(m: ArrayMode): void {
    arrayMode.value = m;
  }
  function setIndent(i: JsonIndent): void {
    indent.value = i;
  }
  function setTrim(v: boolean): void {
    trimValues.value = v;
  }
  function setAttributePrefix(v: string): void {
    attributeNamePrefix.value = v;
  }

  watch(input, scheduleRun);
  watch(attributeNamePrefix, scheduleRun);
  watch(arrayMode, scheduleRun);
  watch(trimValues, scheduleRun);
  watch(indent, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.attributeNamePrefix === 'string') {
        attributeNamePrefix.value = p.attributeNamePrefix;
      }
      if (
        typeof p.arrayMode === 'string' &&
        (p.arrayMode === 'auto' || p.arrayMode === 'always')
      ) {
        arrayMode.value = p.arrayMode as ArrayMode;
      }
      if (typeof p.trimValues === 'boolean') trimValues.value = p.trimValues;
      if (
        typeof p.indent === 'number' &&
        (p.indent === 0 || p.indent === 2 || p.indent === 4)
      ) {
        indent.value = p.indent as JsonIndent;
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
    attributeNamePrefix,
    arrayMode,
    trimValues,
    indent,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setArrayMode,
    setIndent,
    setTrim,
    setAttributePrefix,
  };
}
