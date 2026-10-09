/**
 * useXmlFormatter - composable + pure logic for the XML prettify & format tool.
 *
 * Parses XML text via `fast-xml-parser`'s `XMLParser` (with `preserveOrder:
 * true` so document order, comments, CDATA, and attributes are retained) and
 * re-serializes it via `XMLBuilder` using matching property names + `format:
 * true` + a configurable indent. This round-trips faithfully: the XML
 * declaration, comments, attributes, repeated tags, empty self-closing tags,
 * and CDATA sections all survive the parse → build cycle.
 *
 * The `fast-xml-parser` package is part of the initial bundle per
 * `tech-stack.md`, so it is statically imported here - no dynamic import, no
 * separate Vite chunk.
 *
 * Pure helpers (`formatXml`, `buildParser`, `buildBuilder`, `validateXml`,
 * `highlightXml`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useXmlFormatter()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * Dependencies: `fast-xml-parser` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation mode for the prettified XML output. */
export type XmlIndent = 2 | 4 | 'tab';

/** Options accepted by the pure `formatXml` helper. */
export interface XmlFormatterOptions {
  /** Indentation mode (default 2). */
  indent: XmlIndent;
  /** Trim surrounding whitespace from tag/attribute values. Default `true`. */
  trimValues: boolean;
  /** Preserve XML comments through the round-trip. Default `true`. */
  preserveComments: boolean;
  /** Preserve CDATA sections through the round-trip. Default `true`. */
  preserveCDATA: boolean;
  /** Emit `<tag/>` for empty nodes instead of `<tag></tag>`. Default `true`. */
  collapseEmpty: boolean;
}

/** Result of a successful XML format operation. */
export interface XmlFormatterResult {
  /** Pretty-printed XML string. */
  xml: string;
  /** Number of bytes in the input XML (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output XML (UTF-8). */
  outputBytes: number;
  /** Number of element tags in the document (opening tags, excluding decl/comments). */
  tagCount: number;
  /** Number of attributes across all tags. */
  attributeCount: number;
}

/** Normalised error from the XML parser. */
export interface XmlFormatterError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
}

/** Property names used to round-trip comments and CDATA through the parser. */
export const COMMENT_PROP = '#comment';
export const CDATA_PROP = '#cdata';
export const TEXT_PROP = '#text';
export const ATTR_PREFIX = '@_';

export const DEFAULT_INDENT: XmlIndent = 2;
export const DEFAULT_TRIM = true;
export const DEFAULT_PRESERVE_COMMENTS = true;
export const DEFAULT_PRESERVE_CDATA = true;
export const DEFAULT_COLLAPSE_EMPTY = true;

/**
 * Build a `fast-xml-parser` `XMLParser` instance from the given options.
 *
 * `preserveOrder: true` is always enabled - it is required for a faithful
 * round-trip (without it the parser collapses repeated tags into arrays keyed
 * by tag name, losing document order and interleaving with comments).
 */
export function buildParser(opts: XmlFormatterOptions): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    // Preserve comments + CDATA as named properties so the builder can emit
    // them back. When the user disables them, set the prop name to `false`
    // so fast-xml-parser drops those nodes at parse time (the builder then
    // never sees them and emits nothing).
    commentPropName: opts.preserveComments ? COMMENT_PROP : false,
    cdataPropName: opts.preserveCDATA ? CDATA_PROP : false,
    preserveOrder: true,
    trimValues: opts.trimValues,
    // Keep tag/attribute values as strings - a formatter should not coerce
    // `1` → number or `true` → boolean (the builder would re-emit them
    // unchanged anyway, but coercion can alter formatting like `1.0`).
    parseTagValue: false,
    parseAttributeValue: false,
    // Keep namespace prefixes in tag/attribute names (do not strip them).
    removeNSPrefix: false,
  });
}

/**
 * Build a `fast-xml-parser` `XMLBuilder` instance from the given options.
 *
 * The builder mirrors the parser's property names so comments, CDATA, and
 * attributes round-trip. When `preserveComments` / `preserveCDATA` are off,
 * the builder is given a `commentPropName` / `cdataPropName` that never
 * appears in the parsed tree, so those nodes are silently dropped.
 */
export function buildBuilder(opts: XmlFormatterOptions): XMLBuilder {
  const indentBy =
    opts.indent === 'tab' ? '\t' : ' '.repeat(opts.indent);
  return new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    // Mirror the parser's prop names. When the user disabled comments/CDATA,
    // the parser already dropped those nodes, so the builder never sees them.
    commentPropName: COMMENT_PROP,
    cdataPropName: CDATA_PROP,
    textNodeName: TEXT_PROP,
    preserveOrder: true,
    format: true,
    indentBy,
    // Emit `<tag/>` for empty nodes when collapseEmpty is on; otherwise
    // `<tag></tag>`.
    suppressEmptyNode: opts.collapseEmpty,
    suppressUnpairedNode: true,
    // Encode XML entities (`&`, `<`, `>`, `"`, `'`) in values.
    processEntities: true,
  });
}

/**
 * Validate XML text using `fast-xml-parser`'s `XMLValidator`. Returns `null`
 * if valid, or a normalised `XmlFormatterError` if malformed. `XMLValidator`
 * is deprecated in v5 in favour of the separate `fast-xml-validator` package,
 * but it remains functional and is part of the same `fast-xml-parser`
 * dependency already listed in `tech-stack.md` - no new dependency.
 */
export function validateXml(input: string): XmlFormatterError | null {
  const result = XMLValidator.validate(input);
  if (result === true) return null;
  const err = (
    result as { err: { code: string; msg: string; line: number; col: number } }
  ).err;
  return {
    message: err.msg,
    line: err.line,
    column: err.col,
  };
}

/**
 * Pretty-print (format) XML text.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - Pre-validates with `XMLValidator` to surface meaningful line/column
 *   errors for malformed XML (the `XMLParser` itself is lenient and silently
 *   accepts many malformed documents).
 * - Parses with `preserveOrder: true` and rebuilds with `format: true` so
 *   the output is indented while preserving document order, comments, CDATA,
 *   attributes, and the XML declaration.
 */
export function formatXml(
  input: string,
  opts: XmlFormatterOptions,
): XmlFormatterResult {
  if (typeof input !== 'string') {
    throw toXmlError(new Error('Input must be a string.'));
  }
  const inputBytes = new TextEncoder().encode(input).length;
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { xml: '', inputBytes, outputBytes: 0, tagCount: 0, attributeCount: 0 };
  }

  const validationError = validateXml(trimmed);
  if (validationError) throw validationError;

  let parsed: unknown;
  try {
    const parser = buildParser(opts);
    parsed = parser.parse(trimmed);
  } catch (e) {
    throw toXmlError(e);
  }

  let xml: string;
  try {
    const builder = buildBuilder(opts);
    const out = builder.build(parsed);
    xml = typeof out === 'string' ? out : '';
  } catch (e) {
    throw toXmlError(e);
  }

  const { tagCount, attributeCount } = countNodes(parsed);
  return {
    xml,
    inputBytes,
    outputBytes: new TextEncoder().encode(xml).length,
    tagCount,
    attributeCount,
  };
}

/**
 * Walk a `preserveOrder` parsed tree and count element tags + attributes.
 *
 * The `preserveOrder` shape is an array of nodes; each node is
 * `{ [tagName]: NodeChild[], ':@': Record<string, string> | undefined }`.
 * The `:@` key holds the tag's attributes (prefixed with `@_`). Children
 * are nested in the tag-name array. `#comment` / `#cdata` / `?xml` nodes
 * are skipped for tag counting but their text children are walked.
 */
function countNodes(parsed: unknown): {
  tagCount: number;
  attributeCount: number;
} {
  let tagCount = 0;
  let attributeCount = 0;

  function walk(node: unknown): void {
    if (!Array.isArray(node)) return;
    for (const entry of node) {
      if (entry === null || typeof entry !== 'object') continue;
      const rec = entry as Record<string, unknown>;
      for (const key of Object.keys(rec)) {
        if (key === ':@') {
          const attrs = rec[key] as Record<string, unknown> | undefined;
          if (attrs && typeof attrs === 'object') {
            attributeCount += Object.keys(attrs).length;
          }
          continue;
        }
        // Skip processing-instruction (`?xml`, `?xml-stylesheet`) and
        // comment/CDATA containers for tag counting, but still walk their
        // children to find nested elements (comments/CDATA only hold text).
        if (key === COMMENT_PROP || key === CDATA_PROP) continue;
        if (key === TEXT_PROP) continue;
        if (key.startsWith('?')) {
          // Processing instruction - not an element tag.
          continue;
        }
        tagCount += 1;
        walk(rec[key]);
      }
    }
  }

  walk(parsed);
  return { tagCount, attributeCount };
}

/* -------------------------------------------------------------------------- */
/* Syntax highlighting - hand-rolled tokenizer, XSS-safe                       */
/* -------------------------------------------------------------------------- */

/** CSS class names emitted by `highlightXml`. Keep in sync with the .vue. */
export type XmlTokenClass =
  | 'tag'
  | 'attr'
  | 'string'
  | 'comment'
  | 'cdata'
  | 'decl'
  | 'text';

/**
 * Syntax-highlight a formatted XML string into safe HTML.
 *
 * The input MUST already be valid XML (i.e. the output of `formatXml`). The
 * tokenizer walks the string char-by-char, classifies each token, escapes it
 * for HTML, and wraps it in `<span class="qt-xml-<class>">…</span>`.
 * Whitespace and newlines are preserved verbatim (escaped where needed) so
 * the caller can render the result inside a `<pre>`.
 *
 * Because every token's text is HTML-escaped before being inserted, the
 * output is safe to assign to `innerHTML` even if the original XML contained
 * strings like `"<script>"`.
 */
export function highlightXml(xml: string): string {
  if (xml.length === 0) return '';
  const out: string[] = [];
  let i = 0;
  const n = xml.length;

  function pushSpan(cls: XmlTokenClass, text: string): void {
    out.push('<span class="qt-xml-');
    out.push(cls);
    out.push('">');
    out.push(escapeHtml(text));
    out.push('</span>');
  }

  function isNameStart(c: number): boolean {
    return (
      (c >= 0x41 && c <= 0x5a) /* A-Z */ ||
      (c >= 0x61 && c <= 0x7a) /* a-z */ ||
      c === 0x5f /* _ */ ||
      c === 0x3a /* : */
    );
  }
  function isNamePart(c: number): boolean {
    return (
      isNameStart(c) ||
      (c >= 0x30 && c <= 0x39) /* 0-9 */ ||
      c === 0x2d /* - */ ||
      c === 0x2e /* . */
    );
  }

  /** Find the index just past the closing `>` of the tag starting at `start`. */
  function findTagEnd(s: string, start: number): number {
    let j = start + 1;
    let inStr: string | null = null;
    while (j < s.length) {
      const c = s.charCodeAt(j);
      if (inStr !== null) {
        if (c === inStr.charCodeAt(0)) inStr = null;
        j += 1;
        continue;
      }
      if (c === 0x22 /* " */ || c === 0x27 /* ' */) {
        inStr = s[j]!;
        j += 1;
        continue;
      }
      if (c === 0x3e /* > */) return j + 1;
      j += 1;
    }
    return s.length;
  }

  /**
   * Emit highlighted spans for a single tag token (from `<` to `>`). The
   * tag name, attributes (name), and attribute string values each get their
   * own span class; punctuation (`<`, `>`, `/`, `=`, whitespace) is emitted
   * as plain escaped text. `tagNameEmitted` tracks whether the tag name has
   * already been emitted for the current tag (so subsequent names are
   * treated as attribute names).
   */
  function emitTagSpans(tag: string): void {
    let j = 0;
    const len = tag.length;
    let tagNameEmitted = false;
    while (j < len) {
      const c = tag.charCodeAt(j);

      // Whitespace - preserve verbatim.
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
        out.push(tag[j]!);
        j += 1;
        continue;
      }

      // Opening punctuation: `<`, `</`, `/>`, `>`
      if (c === 0x3c /* < */) {
        if (tag.charCodeAt(j + 1) === 0x2f /* / */) {
          out.push(escapeHtml('</'));
          j += 2;
        } else {
          out.push(escapeHtml('<'));
          j += 1;
        }
        continue;
      }
      if (c === 0x2f /* / */ && tag.charCodeAt(j + 1) === 0x3e /* > */) {
        out.push(escapeHtml('/>'));
        j += 2;
        continue;
      }
      if (c === 0x3e /* > */) {
        out.push(escapeHtml('>'));
        j += 1;
        continue;
      }
      if (c === 0x2f /* / */) {
        out.push(escapeHtml('/'));
        j += 1;
        continue;
      }
      if (c === 0x3d /* = */) {
        out.push(escapeHtml('='));
        j += 1;
        continue;
      }

      // String literal (attribute value).
      if (c === 0x22 /* " */ || c === 0x27 /* ' */) {
        const start = j;
        j += 1;
        while (j < len) {
          const cc = tag.charCodeAt(j);
          if (cc === c) {
            j += 1;
            break;
          }
          j += 1;
        }
        pushSpan('string', tag.slice(start, j));
        continue;
      }

      // Name (tag name or attribute name): letters, digits, `:`, `-`, `_`, `.`
      if (isNameStart(c)) {
        const start = j;
        while (j < len && isNamePart(tag.charCodeAt(j))) j += 1;
        // The first name in a tag is the tag name; subsequent names are
        // attribute names.
        if (!tagNameEmitted) {
          pushSpan('tag', tag.slice(start, j));
          tagNameEmitted = true;
        } else {
          pushSpan('attr', tag.slice(start, j));
        }
        continue;
      }

      // Anything else - escape and emit as plain text.
      out.push(escapeHtml(tag[j]!));
      j += 1;
    }
  }

  while (i < n) {
    const ch = xml.charCodeAt(i);

    // Whitespace and newlines - preserve verbatim (already HTML-safe).
    if (
      ch === 0x20 /* space */ ||
      ch === 0x09 /* tab */ ||
      ch === 0x0a /* \n */ ||
      ch === 0x0d /* \r */
    ) {
      out.push(xml[i]!);
      i += 1;
      continue;
    }

    // Comment: <!-- ... -->
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      const stop = end === -1 ? n : end + 3;
      pushSpan('comment', xml.slice(i, stop));
      i = stop;
      continue;
    }

    // CDATA: <![CDATA[ ... ]]>
    if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i + 9);
      const stop = end === -1 ? n : end + 3;
      pushSpan('cdata', xml.slice(i, stop));
      i = stop;
      continue;
    }

    // Processing instruction / XML declaration: <?...?>
    if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i + 2);
      const stop = end === -1 ? n : end + 2;
      pushSpan('decl', xml.slice(i, stop));
      i = stop;
      continue;
    }

    // Tag: <tag ...> or </tag> or <tag/>
    if (ch === 0x3c /* < */) {
      const end = findTagEnd(xml, i);
      emitTagSpans(xml.slice(i, end));
      i = end;
      continue;
    }

    // Plain text between tags.
    const next = xml.indexOf('<', i);
    const stop = next === -1 ? n : next;
    pushSpan('text', xml.slice(i, stop));
    i = stop;
  }

  return out.join('');
}

/** Escape `&`, `<`, `>`, `"` for safe insertion into HTML text. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* -------------------------------------------------------------------------- */
/* Error helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Convert a raw `fast-xml-parser` error (or any thrown value) into a
 * normalised `XmlFormatterError`. `fast-xml-parser` errors typically embed
 * line/column in the message (e.g. `"...Line: 3 Column: 12"`); we extract
 * them when present.
 */
function toXmlError(err: unknown): XmlFormatterError {
  if (err instanceof Error) {
    const { message, line, column } = extractLineColumn(err.message);
    return { message, line, column };
  }
  if (
    err !== null &&
    typeof err === 'object' &&
    typeof (err as XmlFormatterError).message === 'string'
  ) {
    // Already normalised (e.g. from `validateXml`).
    return err as XmlFormatterError;
  }
  const { message, line, column } = extractLineColumn(String(err));
  return { message, line, column };
}

/**
 * Extract a 1-based line/column from a `fast-xml-parser` error message.
 * Messages look like: `Issue: foo. Line: 3 Column: 12` or
 * `...at line 3, column 12`. Returns the cleaned message and any numbers
 * found.
 */
function extractLineColumn(raw: string): {
  message: string;
  line?: number;
  column?: number;
} {
  let line: number | undefined;
  let column: number | undefined;
  let message = raw;

  const lc = /Line:\s*(\d+)\s+Column:\s*(\d+)/i.exec(raw);
  if (lc) {
    line = Number(lc[1]);
    column = Number(lc[2]);
    message = raw.replace(/Line:\s*\d+\s+Column:\s*\d+/i, '').trim();
  } else {
    const lc2 = /at line (\d+),?\s*column (\d+)/i.exec(raw);
    if (lc2) {
      line = Number(lc2[1]);
      column = Number(lc2[2]);
      message = raw.replace(/at line \d+,?\s*column \d+/i, '').trim();
    }
  }

  message = message.replace(/[\s.;]+$/, '').trim();
  if (message.length === 0) message = raw;
  return { message, line, column };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface XmlFormatterOutputs {
  xml: string;
  inputBytes: number;
  outputBytes: number;
  tagCount: number;
  attributeCount: number;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseXmlFormatterReturn {
  input: Ref<string>;
  indent: Ref<XmlIndent>;
  trimValues: Ref<boolean>;
  preserveComments: Ref<boolean>;
  preserveCDATA: Ref<boolean>;
  collapseEmpty: Ref<boolean>;
  showRaw: Ref<boolean>;
  outputs: Ref<XmlFormatterOutputs | null>;
  error: Ref<XmlFormatterError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setIndent: (i: XmlIndent) => void;
  setTrim: (v: boolean) => void;
  setPreserveComments: (v: boolean) => void;
  setPreserveCDATA: (v: boolean) => void;
  setCollapseEmpty: (v: boolean) => void;
  toggleShowRaw: () => void;
}

export function useXmlFormatter(): UseXmlFormatterReturn {
  const input = ref<string>('');
  const indent = ref<XmlIndent>(DEFAULT_INDENT);
  const trimValues = ref<boolean>(DEFAULT_TRIM);
  const preserveComments = ref<boolean>(DEFAULT_PRESERVE_COMMENTS);
  const preserveCDATA = ref<boolean>(DEFAULT_PRESERVE_CDATA);
  const collapseEmpty = ref<boolean>(DEFAULT_COLLAPSE_EMPTY);
  const showRaw = ref<boolean>(false);
  const outputs = ref<XmlFormatterOutputs | null>(null);
  const error = ref<XmlFormatterError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function opts(): XmlFormatterOptions {
    return {
      indent: indent.value,
      trimValues: trimValues.value,
      preserveComments: preserveComments.value,
      preserveCDATA: preserveCDATA.value,
      collapseEmpty: collapseEmpty.value,
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
      const r = formatXml(text, opts());
      outputs.value = {
        xml: r.xml,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
        tagCount: r.tagCount,
        attributeCount: r.attributeCount,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as XmlFormatterError;
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

  function setIndent(i: XmlIndent): void {
    indent.value = i;
  }
  function setTrim(v: boolean): void {
    trimValues.value = v;
  }
  function setPreserveComments(v: boolean): void {
    preserveComments.value = v;
  }
  function setPreserveCDATA(v: boolean): void {
    preserveCDATA.value = v;
  }
  function setCollapseEmpty(v: boolean): void {
    collapseEmpty.value = v;
  }
  function toggleShowRaw(): void {
    showRaw.value = !showRaw.value;
  }

  watch(input, scheduleRun);
  watch(indent, scheduleRun);
  watch(trimValues, scheduleRun);
  watch(preserveComments, scheduleRun);
  watch(preserveCDATA, scheduleRun);
  watch(collapseEmpty, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.xml === 'string') {
        input.value = p.xml;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      } else if (typeof p.content === 'string') {
        input.value = p.content;
      }
      if (typeof p.indent === 'number' && (p.indent === 2 || p.indent === 4)) {
        indent.value = p.indent;
      } else if (p.indent === 'tab') {
        indent.value = 'tab';
      }
      if (typeof p.trimValues === 'boolean') trimValues.value = p.trimValues;
      if (typeof p.preserveComments === 'boolean') {
        preserveComments.value = p.preserveComments;
      }
      if (typeof p.preserveCDATA === 'boolean') {
        preserveCDATA.value = p.preserveCDATA;
      }
      if (typeof p.collapseEmpty === 'boolean') {
        collapseEmpty.value = p.collapseEmpty;
      }
      if (typeof p.showRaw === 'boolean') showRaw.value = p.showRaw;
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    indent,
    trimValues,
    preserveComments,
    preserveCDATA,
    collapseEmpty,
    showRaw,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setIndent,
    setTrim,
    setPreserveComments,
    setPreserveCDATA,
    setCollapseEmpty,
    toggleShowRaw,
  };
}
