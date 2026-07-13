/**
 * useJsonToXml — composable + pure logic for the JSON → XML converter.
 *
 * Builds XML text from a parsed JSON value via `fast-xml-parser`'s
 * `XMLBuilder`. The `fast-xml-parser` package is part of the initial
 * bundle per `tech-stack.md`, so it is statically imported here — no
 * dynamic import, no separate Vite chunk.
 *
 * Pure helpers (`parseJson`, `jsonToXml`, `buildBuilder`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse.
 * The `useJsonToXml()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * Dependencies: `fast-xml-parser` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { XMLBuilder } from 'fast-xml-parser';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation mode for the XML output (only used when `pretty` is true). */
export type XmlIndent = 2 | 4;

/** Options accepted by the pure `jsonToXml` helper. */
export interface JsonToXmlOptions {
  /**
   * Name of the root element to wrap the parsed JSON value under.
   *
   * - When non-empty, the entire parsed value is wrapped as
   *   `{ [rootName]: parsed }` before building. This guarantees a single
   *     root element (well-formed XML) regardless of the input shape.
   * - When empty, the parsed object is passed to the builder as-is. Its
   *   top-level keys become root elements — valid XML only if there is
   *   exactly one top-level key.
   *
   * Default `'root'`.
   */
  rootName: string;
  /** Prefix prepended to attribute names in the parsed object. Default `@_`. */
  attributeNamePrefix: string;
  /** Pretty-print the output (indent + newlines). Default `true`. */
  pretty: boolean;
  /** Indent size when `pretty` is true. Default `2`. */
  indent: XmlIndent;
}

/** Result of a successful JSON → XML conversion. */
export interface JsonToXmlResult {
  /** Generated XML string (empty when input parses to nothing). */
  xml: string;
  /** Number of top-level keys in the parsed JSON (0 for scalars/empty). */
  rootKeyCount: number;
  /** Number of bytes in the input JSON (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output XML (UTF-8). */
  outputBytes: number;
}

/** Normalised error from JSON parsing or XML building. */
export interface JsonToXmlError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
  /**
   * Source snippet extracted from V8 "Unexpected token" errors, used by
   * `enrichError` to derive a real line/column from the input text.
   * Present only for the newer V8 format that embeds a source snippet
   * instead of an explicit `at position N` clause.
   */
  snippet?: string;
  /** The unexpected token character, when extracted from a V8 error. */
  token?: string;
}

export const DEFAULT_ROOT_NAME = 'root';
export const DEFAULT_ATTRIBUTE_PREFIX = '@_';
export const DEFAULT_PRETTY = true;
export const DEFAULT_INDENT: XmlIndent = 2;
/** Internal text-node property name used by `fast-xml-parser`. */
export const TEXT_NODE_NAME = '#text';

/** Build a `fast-xml-parser` `XMLBuilder` instance from the given options. */
export function buildBuilder(opts: JsonToXmlOptions): XMLBuilder {
  return new XMLBuilder({
    attributeNamePrefix: opts.attributeNamePrefix,
    ignoreAttributes: false,
    // `format: true` → pretty-printed (newlines + indentBy).
    // `format: false` → compact single-line output.
    format: opts.pretty,
    indentBy: opts.pretty ? ' '.repeat(opts.indent) : '',
    // Emit `<tag/>` for empty values instead of `<tag></tag>`.
    suppressEmptyNode: true,
    // Emit `<tag/>` (self-closing) for unpaired nodes rather than `<tag />`.
    suppressUnpairedNode: true,
    // Property name under which mixed text content lives when the same tag
    // has both attributes and a text value.
    textNodeName: TEXT_NODE_NAME,
    // Encode XML entities (`&`, `<`, `>`, `"`, `'`) in values.
    processEntities: true,
  });
}

/**
 * Parse JSON text into a plain JS value. Throws a normalised
 * `JsonToXmlError` on failure (with 1-based line/column extracted from the
 * V8 `SyntaxError` message when present).
 *
 * - Empty input → `null` (caller treats as "nothing to convert").
 * - Accepts any valid JSON value (object, array, string, number, boolean,
 *   null). Non-object roots are wrapped under the configured root element
 *   by `jsonToXml` so the resulting XML is always well-formed.
 */
export function parseJson(input: string): unknown {
  if (typeof input !== 'string') {
    throw toJsonError(new Error('Input must be a string.'));
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw toJsonError(e);
  }
}

/**
 * Convert JSON text to an XML string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - When `opts.rootName` is non-empty, the parsed value is wrapped under
 *   that name so the output has a single root element. When empty, the
 *   parsed object is passed to the builder directly (its top-level keys
 *   become root elements).
 * - Non-object roots (arrays, scalars) are always wrapped under
 *   `rootName` (defaulting to `'root'` if `rootName` is empty) because
 *   `XMLBuilder.build` requires an object input.
 */
export function jsonToXml(
  input: string,
  opts: JsonToXmlOptions,
): JsonToXmlResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const parsed = parseJson(input);
  if (parsed === null || parsed === undefined) {
    return { xml: '', rootKeyCount: 0, inputBytes, outputBytes: 0 };
  }

  // Determine the object to feed the builder.
  let rootKeyCount = 0;
  let feed: Record<string, unknown>;
  if (opts.rootName.trim().length > 0) {
    // Wrap the entire parsed value under the configured root name.
    feed = { [opts.rootName]: parsed };
    rootKeyCount = 1;
  } else if (
    parsed !== null &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed)
  ) {
    // No wrapping — use the parsed object directly. Its top-level keys
    // become root elements (valid XML only if there is exactly one).
    feed = parsed as Record<string, unknown>;
    rootKeyCount = Object.keys(feed).length;
  } else {
    // Non-object root with no configured root name: fall back to a
    // default root so the builder still produces well-formed XML.
    feed = { root: parsed };
    rootKeyCount = 1;
  }

  try {
    const builder = buildBuilder(opts);
    const xml = builder.build(feed);
    return {
      xml: typeof xml === 'string' ? xml : '',
      rootKeyCount,
      inputBytes,
      outputBytes: new TextEncoder().encode(
        typeof xml === 'string' ? xml : '',
      ).length,
    };
  } catch (e) {
    throw toJsonError(e);
  }
}

/**
 * Convert a raw `JSON.parse` / `XMLBuilder` error (or any thrown value)
 * into a normalised `JsonToXmlError`. V8 `SyntaxError` messages look like
 * `Unexpected token X in JSON at position N` or
 * `Expected property name '...' in JSON at position N`; we map `position`
 * to a 1-based line/column by scanning the input.
 */
function toJsonError(err: unknown): JsonToXmlError {
  if (err instanceof Error) {
    return normaliseJsonError(err.message);
  }
  return normaliseJsonError(String(err));
}

/**
 * Extract a 1-based line/column from a V8 JSON `SyntaxError` message.
 * Returns the cleaned message plus any numbers found.
 *
 * V8 emits two error formats:
 * 1. `Expected property name or '}' in JSON at position 1 (line 1 column 2)`
 *    — explicit position + line/column. We extract both.
 * 2. `Unexpected token '}', "...snippet..." is not valid JSON` (or
 *    `Unexpected token 'X', ..."trailing snippet" is not valid JSON` for
 *    long input) — no explicit position. We extract the token char and
 *    the source snippet so `enrichError` can derive a real line/column
 *    by locating the snippet in the original input.
 */
function normaliseJsonError(raw: string): JsonToXmlError {
  let message = raw;
  let line: number | undefined;
  let column: number | undefined;
  let snippet: string | undefined;
  let token: string | undefined;

  // V8 style 1: "...in JSON at position N (line L column C)"
  const posMatch = /in JSON at position (\d+)(?:\s+\(line (\d+)\s+column (\d+)\))?/i.exec(raw);
  if (posMatch) {
    const pos = Number(posMatch[1]);
    column = pos + 1;
    line = 1;
    if (posMatch[2] && posMatch[3]) {
      line = Number(posMatch[2]);
      column = Number(posMatch[3]);
    }
    message = raw.replace(/in JSON at position \d+(?:\s+\(line \d+\s+column \d+\))?/i, '').trim();
  }

  // V8 style 2: "Unexpected token 'X', ...\"snippet\" is not valid JSON"
  // The snippet is the source text from the error position onward; when
  // the input is long it is prefixed with `...`. The snippet itself may
  // contain unescaped `"` characters (V8 does not escape them), so we
  // cannot use a simple regex. We locate the token, then the snippet
  // boundaries by finding the opening `"` after `, ` and the closing `"`
  // before ` is not valid JSON` at the end of the message.
  const tokIdx = raw.indexOf("Unexpected token '");
  if (tokIdx >= 0) {
    const tokStart = tokIdx + "Unexpected token '".length;
    const tokEnd = raw.indexOf("'", tokStart);
    if (tokEnd > tokStart) {
      token = raw.slice(tokStart, tokEnd);
      // Find the suffix ` is not valid JSON` at the end of the message.
      const suffix = ' is not valid JSON';
      const suffixIdx = raw.lastIndexOf(suffix);
      if (suffixIdx > tokEnd) {
        // The closing `"` of the snippet is just before the suffix.
        let snippetEnd = suffixIdx - 1;
        if (raw.charCodeAt(snippetEnd) === 0x22 /* " */) {
          // Find the opening `"` after `, ` following the token.
          const commaIdx = raw.indexOf(',', tokEnd);
          if (commaIdx >= 0) {
            let snippetStart = commaIdx + 1;
            // Skip whitespace and optional `...` prefix.
            while (snippetStart < snippetEnd && /\s/.test(raw[snippetStart] ?? '')) snippetStart++;
            const hasEllipsis = raw.slice(snippetStart, snippetStart + 3) === '...';
            if (hasEllipsis) snippetStart += 3;
            if (raw.charCodeAt(snippetStart) === 0x22 /* " */) {
              snippetStart++;
              snippet = raw.slice(snippetStart, snippetEnd);
              message = 'Unexpected token';
            }
          }
        }
      }
    }
  }

  message = message.replace(/[\s.;]+$/, '').trim();
  if (message.length === 0) message = raw;
  const err: JsonToXmlError = { message, line, column };
  if (snippet !== undefined) err.snippet = snippet;
  if (token !== undefined) err.token = token;
  return err;
}

/**
 * Re-compute line/column for a `JsonToXmlError` using the original input
 * text. This produces accurate 1-based line/column instead of the raw V8
 * position number or snippet-derived offset.
 *
 * Two strategies:
 * 1. If the error carries an absolute character position (from V8 style 1
 *    `at position N`), convert it to line/column by scanning the input.
 *    If the error already carries a real line (not `1`), it is left
 *    untouched.
 * 2. If the error carries a source `snippet` (from V8 style 2
 *    `Unexpected token`), locate the snippet in the input and compute
 *    line/column from the match position. When the snippet is the full
 *    input (short-input case, no `...` prefix in the original message),
 *    we fall back to scanning for the unexpected `token` character.
 */
export function enrichError(
  error: JsonToXmlError,
  input: string,
): JsonToXmlError {
  // Strategy 1: absolute position from V8 style 1.
  if (error.column != null && (!error.line || error.line === 1) && !error.snippet) {
    const pos = error.column - 1;
    if (pos >= 0 && pos <= input.length) {
      const { line, col } = posToLineCol(input, pos);
      return { message: error.message, line, column: col };
    }
  }
  // If style 1 already gave us a real line/column, keep them.
  if (error.line && error.line !== 1 && error.column != null && !error.snippet) {
    return error;
  }

  // Strategy 2: V8 style 2 "Unexpected token" — no explicit position, but
  // we have the unexpected token character. V8's embedded snippet is a
  // window around the error (not necessarily starting at it), so we scan
  // the full input for the first occurrence of the token character outside
  // of a string literal. The JSON parser reads left-to-right and fails at
  // the first character that breaks the grammar, so the first
  // out-of-string occurrence of the token char is the error position.
  if (error.token && error.token.length === 1) {
    const tok = error.token;
    let inString = false;
    let escape = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === 0x5c /* \ */) {
        escape = true;
        continue;
      }
      if (ch === 0x22 /* " */) {
        inString = !inString;
        continue;
      }
      if (!inString && input[i] === tok) {
        const { line, col } = posToLineCol(input, i);
        return { message: error.message, line, column: col, snippet: error.snippet, token: error.token };
      }
    }
  }
  return error;
}

/** Convert a 0-based character position into a 1-based line/column pair. */
function posToLineCol(input: string, pos: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < pos && i < input.length; i++) {
    if (input.charCodeAt(i) === 0x0a /* \n */) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface JsonToXmlOutputs {
  xml: string;
  rootKeyCount: number;
  inputBytes: number;
  outputBytes: number;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseJsonToXmlReturn {
  input: Ref<string>;
  rootName: Ref<string>;
  attributeNamePrefix: Ref<string>;
  pretty: Ref<boolean>;
  indent: Ref<XmlIndent>;
  outputs: Ref<JsonToXmlOutputs | null>;
  error: Ref<JsonToXmlError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setRootName: (v: string) => void;
  setAttributePrefix: (v: string) => void;
  setPretty: (v: boolean) => void;
  setIndent: (i: XmlIndent) => void;
}

export function useJsonToXml(): UseJsonToXmlReturn {
  const input = ref<string>('');
  const rootName = ref<string>(DEFAULT_ROOT_NAME);
  const attributeNamePrefix = ref<string>(DEFAULT_ATTRIBUTE_PREFIX);
  const pretty = ref<boolean>(DEFAULT_PRETTY);
  const indent = ref<XmlIndent>(DEFAULT_INDENT);
  const outputs = ref<JsonToXmlOutputs | null>(null);
  const error = ref<JsonToXmlError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function opts(): JsonToXmlOptions {
    return {
      rootName: rootName.value,
      attributeNamePrefix: attributeNamePrefix.value,
      pretty: pretty.value,
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
      const r = jsonToXml(text, opts());
      outputs.value = {
        xml: r.xml,
        rootKeyCount: r.rootKeyCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      // `parseJson` trims the input before `JSON.parse`, so error positions
      // are relative to the trimmed text — pass the same trimmed text to
      // `enrichError` for accurate line/column.
      const err = enrichError(e as JsonToXmlError, text.trim());
      error.value = err;
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

  function setRootName(v: string): void {
    rootName.value = v;
  }
  function setAttributePrefix(v: string): void {
    attributeNamePrefix.value = v;
  }
  function setPretty(v: boolean): void {
    pretty.value = v;
  }
  function setIndent(i: XmlIndent): void {
    indent.value = i;
  }

  watch(input, scheduleRun);
  watch(rootName, scheduleRun);
  watch(attributeNamePrefix, scheduleRun);
  watch(pretty, scheduleRun);
  watch(indent, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.rootName === 'string') rootName.value = p.rootName;
      if (typeof p.attributeNamePrefix === 'string') {
        attributeNamePrefix.value = p.attributeNamePrefix;
      }
      if (typeof p.pretty === 'boolean') pretty.value = p.pretty;
      if (
        typeof p.indent === 'number' &&
        (p.indent === 2 || p.indent === 4)
      ) {
        indent.value = p.indent as XmlIndent;
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
    rootName,
    attributeNamePrefix,
    pretty,
    indent,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setRootName,
    setAttributePrefix,
    setPretty,
    setIndent,
  };
}
