/**
 * useYamlPrettify - composable + pure logic for the YAML prettify & format tool.
 *
 * Parses YAML text (single document or multi-document `---` streams) via the
 * `yaml` package's `parseAllDocuments` and re-serializes each document via
 * `Document.toString` with a configurable indent (2 spaces, 4 spaces, or a
 * tab), optional flow style, and optional `---` directive markers. This
 * round-trips faithfully: comments, anchors/aliases, block scalars, multi-doc
 * streams, and key order all survive the parse → stringify cycle.
 *
 * A small hand-rolled, XSS-safe tokenizer (`highlightYaml`) produces a
 * syntax-highlighted HTML rendering of the formatted YAML - no external deps,
 * no DOM, every token is HTML-escaped before insertion.
 *
 * The `yaml` package is part of the initial bundle per `tech-stack.md`, so it
 * is statically imported here - no dynamic import, no separate Vite chunk.
 *
 * Pure helpers (`parseYamlDocuments`, `prettifyYaml`, `highlightYaml`,
 * `analyzeYaml`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useYamlPrettify()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * Dependencies: `yaml` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { parseAllDocuments, Document } from 'yaml';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation mode for the prettified YAML output. */
export type YamlIndent = 2 | 4 | 'tab';

/** Result of a successful YAML prettify operation. */
export interface YamlPrettifyResult {
  /** Pretified YAML text. */
  yaml: string;
  /** Number of YAML documents parsed (1 for a single doc, N for a stream). */
  documentCount: number;
  /** Number of bytes in the input YAML (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output YAML (UTF-8). */
  outputBytes: number;
  /** Number of mapping keys present in the parsed value (recursive). */
  keyCount: number;
  /** Maximum nesting depth of the parsed value (scalars = 0). */
  maxDepth: number;
}

/** Normalised error from the YAML parser. */
export interface YamlPrettifyError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
  /** Source position range, when available. */
  pos?: [number, number];
}

/** Options accepted by `prettifyYaml`. */
export interface YamlPrettifyOptions {
  /** Indentation mode (default 2). */
  indent?: YamlIndent;
  /** Force flow-style collections everywhere (default false → block style). */
  flow?: boolean;
  /**
   * Emit explicit `---` document-start markers. When `true`, every document
   * begins with `---`. When `false` (default), markers are emitted only for
   * multi-document streams (the `yaml` package's default behaviour).
   */
  directives?: boolean;
  /** Maximum line width before folding (0 disables folding). Default 80. */
  lineWidth?: number;
}

/**
 * Parse YAML text into an array of `Document.Parsed` (one entry per document
 * in a multi-document stream). Throws a normalised `YamlPrettifyError` on
 * failure.
 *
 * We use `parseAllDocuments` rather than `parse` so multi-document YAML
 * streams (`---` separators) are handled uniformly: a single-document input
 * yields a one-element array. Each `Document` may carry its own errors
 * (collected by the parser); we surface the first one as a `YamlPrettifyError`.
 */
export function parseYamlDocuments(input: string): Document.Parsed[] {
  if (typeof input !== 'string') {
    throw toYamlError(new Error('Input must be a string.'));
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];

  const docs = parseAllDocuments(input, {
    // Keep map key order as written in the source.
    keepSourceTokens: false,
  });

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    const err = doc.errors[0];
    if (err) throw toYamlError(err);
  }
  return docs;
}

/**
 * Prettify YAML text.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - Otherwise the input is parsed and each document is re-serialized with the
 *   chosen indent / style / directives options.
 */
export function prettifyYaml(
  input: string,
  options: YamlPrettifyOptions = {},
): YamlPrettifyResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const docs = parseYamlDocuments(input);
  if (docs.length === 0) {
    return { yaml: '', documentCount: 0, inputBytes, outputBytes: 0, keyCount: 0, maxDepth: 0 };
  }

  const indent = options.indent ?? 2;
  const flow = options.flow ?? false;
  const directives = options.directives ?? false;
  const lineWidth = options.lineWidth ?? 80;

  const indentArg: number = indent === 'tab' ? 1 : indent;
  // The `yaml` package uses `indent` (number) for spaces; tabs are not valid
  // YAML indentation, so when the user requests "tab" we emit 1-space indent
  // but render the highlighted output with tab expansion. To honour the user
  // request as closely as possible, we instead use 2 spaces for the serializer
  // and post-process the output to replace leading-space runs with tabs when
  // `indent === 'tab'`.
  const toStringOptions = {
    indent: indent === 'tab' ? 2 : indentArg,
    collectionStyle: flow ? ('flow' as const) : ('block' as const),
    lineWidth,
    directives,
  };

  let yaml: string;
  try {
    const parts = docs.map((doc) => doc.toString(toStringOptions));
    yaml = parts.join('\n').replace(/\n+$/, '\n');
  } catch (e) {
    throw toYamlError(e);
  }

  if (indent === 'tab') {
    // Replace each leading run of 2 spaces with a tab. The serializer emitted
    // 2 spaces per indent level, so this maps cleanly to one tab per level.
    yaml = yaml.replace(/^( {2})+/gm, (match) => '\t'.repeat(match.length / 2));
  }

  // Aggregate stats across all documents.
  let keyCount = 0;
  let maxDepth = 0;
  for (const doc of docs) {
    const stats = analyzeYaml(doc.toJS());
    keyCount += stats.keyCount;
    if (stats.maxDepth > maxDepth) maxDepth = stats.maxDepth;
  }

  return {
    yaml,
    documentCount: docs.length,
    inputBytes,
    outputBytes: new TextEncoder().encode(yaml).length,
    keyCount,
    maxDepth,
  };
}

/**
 * Walk a parsed YAML value and report the total number of mapping keys and the
 * maximum nesting depth. Scalars (string/number/boolean/null) have depth 0;
 * maps/sequences have depth 1 + the max depth of their children. Cycles (which
 * can arise from YAML aliases) are guarded with a WeakSet.
 */
export function analyzeYaml(value: unknown): {
  keyCount: number;
  maxDepth: number;
} {
  let keyCount = 0;
  let maxDepth = 0;
  const seen = new WeakSet<object>();

  function walk(v: unknown, depth: number): void {
    if (v === null || typeof v !== 'object') {
      if (depth > maxDepth) maxDepth = depth;
      return;
    }
    if (seen.has(v as object)) return;
    seen.add(v as object);
    if (depth > maxDepth) maxDepth = depth;
    if (Array.isArray(v)) {
      for (const item of v) walk(item, depth + 1);
    } else {
      const obj = v as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        keyCount += 1;
        walk(obj[key], depth + 1);
      }
    }
  }

  walk(value, 0);
  return { keyCount, maxDepth };
}

/* -------------------------------------------------------------------------- */
/* Syntax highlighting - hand-rolled tokenizer, XSS-safe                       */
/* -------------------------------------------------------------------------- */

/** CSS class names emitted by `highlightYaml`. Keep in sync with the .vue. */
export type YamlTokenClass =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'comment'
  | 'anchor'
  | 'alias'
  | 'tag'
  | 'punct'
  | 'directive';

/**
 * Syntax-highlight a formatted YAML string into safe HTML.
 *
 * The input MUST already be valid YAML (i.e. the output of `prettifyYaml`).
 * The tokenizer walks the string line-by-line, classifies each token, escapes
 * it for HTML, and wraps it in `<span class="qt-yaml-<class>">…</span>`.
 * Whitespace and newlines are preserved verbatim (escaped where needed) so the
 * caller can render the result inside a `<pre>`.
 *
 * Because every token's text is HTML-escaped before being inserted, the output
 * is safe to assign to `innerHTML` even if the original YAML contained strings
 * like `"<script>"`.
 *
 * The tokenizer is intentionally conservative: it recognises the common
 * constructs emitted by the `yaml` serializer (comments, document markers,
 * keys, quoted/plain strings, numbers, booleans, null, anchors, aliases,
 * tags, block-scalar indicators) and falls back to plain escaped text for
 * anything it does not recognise.
 */
export function highlightYaml(yaml: string): string {
  if (yaml.length === 0) return '';
  const lines = yaml.split('\n');
  const out: string[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    if (lineIdx > 0) out.push('\n');
    out.push(highlightLine(line));
  }
  return out.join('');
}

/** Highlight a single YAML line. */
function highlightLine(line: string): string {
  const out: string[] = [];

  // Capture leading indentation (spaces or tabs) and preserve verbatim.
  let i = 0;
  const n = line.length;
  while (i < n && (line.charCodeAt(i) === 0x20 || line.charCodeAt(i) === 0x09)) {
    out.push(line[i]!);
    i += 1;
  }

  if (i >= n) return out.join('');

  const rest = line.slice(i);

  // Full-line comment.
  if (rest.startsWith('#')) {
    pushSpan(out, 'comment', rest);
    return out.join('');
  }

  // Document markers: `---` and `...`.
  if (rest === '---' || rest === '...') {
    pushSpan(out, 'directive', rest);
    return out.join('');
  }
  if (rest.startsWith('--- ')) {
    pushSpan(out, 'directive', '---');
    out.push(' ');
    pushSpan(out, 'comment', rest.slice(4));
    return out.join('');
  }

  // Tag directive lines like `%YAML 1.2`.
  if (rest.startsWith('%')) {
    pushSpan(out, 'directive', rest);
    return out.join('');
  }

  // Sequence item dash: `- ` or `-` at end of line.
  if (rest.startsWith('- ') || rest === '-') {
    pushSpan(out, 'punct', '-');
    out.push(' ');
    out.push(highlightValue(rest.slice(2), true));
    return out.join('');
  }

  // Otherwise: a mapping key or a bare scalar.
  out.push(highlightValue(rest, false));
  return out.join('');
}

/**
 * Highlight the value portion of a line. When `allowKey` is true (sequence
 * item context), a `key:` pattern is still recognised; when false, the first
 * `key:`-style token is treated as a mapping key.
 */
function highlightValue(text: string, _allowKey: boolean): string {
  const out: string[] = [];
  let i = 0;
  const n = text.length;

  // Anchor and/or tag prefix: `&anchor`, `!tag`, `!<tag>`, `!tag value`.
  // Consume all leading anchors/tags.
  while (i < n) {
    const ch = text.charCodeAt(i);
    if (ch === 0x26 /* & */ || ch === 0x21 /* ! */) {
      // Read the anchor/tag token up to whitespace.
      const start = i;
      i += 1;
      // For `!<...>` read until `>`.
      if (i < n && text.charCodeAt(i) === 0x3c /* < */) {
        while (i < n && text.charCodeAt(i) !== 0x3e /* > */) i += 1;
        if (i < n) i += 1; // consume `>`
      } else {
        while (i < n && text.charCodeAt(i) !== 0x20 && text.charCodeAt(i) !== 0x09) i += 1;
      }
      const token = text.slice(start, i);
      pushSpan(out, ch === 0x26 ? 'anchor' : 'tag', token);
      // Skip whitespace.
      while (i < n && (text.charCodeAt(i) === 0x20 || text.charCodeAt(i) === 0x09)) {
        out.push(text[i]!);
        i += 1;
      }
      continue;
    }
    break;
  }

  if (i >= n) return out.join('');

  // Try to match a mapping key: a quoted string or a plain token followed by
  // `:` and (whitespace or end-of-line).
  const keyMatch = matchKey(text, i);
  if (keyMatch) {
    const { keyEnd, colonEnd } = keyMatch;
    const keyText = text.slice(i, keyEnd);
    // Render the key with its quotes, classified as 'key'.
    pushSpan(out, 'key', keyText);
    i = colonEnd;
    // Skip whitespace after colon.
    while (i < n && (text.charCodeAt(i) === 0x20 || text.charCodeAt(i) === 0x09)) {
      out.push(text[i]!);
      i += 1;
    }
    // The remainder is the value (may be empty for block content).
    if (i < n) {
      out.push(highlightScalar(text.slice(i)));
    }
    return out.join('');
  }

  // No key - treat the rest as a scalar value.
  out.push(highlightScalar(text.slice(i)));
  return out.join('');
}

/**
 * Attempt to match a mapping key at position `i` in `text`. Returns the end of
 * the key token and the end of the following colon (plus any trailing space
 * is NOT consumed), or `null` if no key match.
 *
 * A key is either:
 *   - a double-quoted string `"..."` (with `\\` escapes)
 *   - a single-quoted string `'...'` (with `''` escapes)
 *   - a plain token containing no `:`, no leading `- `, no `#`, no `{`/`[`
 * followed by `:` and then whitespace or end-of-line.
 */
function matchKey(
  text: string,
  start: number,
): { keyEnd: number; colonEnd: number } | null {
  const n = text.length;
  let keyEnd: number;

  const ch = text.charCodeAt(start);
  if (ch === 0x22 /* " */) {
    keyEnd = scanDoubleQuoted(text, start);
    if (keyEnd < 0) return null;
  } else if (ch === 0x27 /* ' */) {
    keyEnd = scanSingleQuoted(text, start);
    if (keyEnd < 0) return null;
  } else {
    // Plain key: read until `:` followed by whitespace/EOL or end of string.
    // Stop early on `#` (comment) or flow markers.
    let j = start;
    while (j < n) {
      const c = text.charCodeAt(j);
      if (c === 0x3a /* : */) {
        const next = j + 1;
        if (next >= n || text.charCodeAt(next) === 0x20 || text.charCodeAt(next) === 0x09) {
          break;
        }
        // `:` not followed by whitespace is part of the plain scalar.
        j += 1;
        continue;
      }
      if (c === 0x23 /* # */ || c === 0x7b /* { */ || c === 0x5b /* [ */) {
        return null;
      }
      j += 1;
    }
    if (j === start) return null;
    // Trim trailing whitespace from the plain key.
    keyEnd = j;
    while (keyEnd > start && (text.charCodeAt(keyEnd - 1) === 0x20 || text.charCodeAt(keyEnd - 1) === 0x09)) {
      keyEnd -= 1;
    }
    if (keyEnd === start) return null;
  }

  // Now expect `:` (possibly surrounded by whitespace) followed by whitespace
  // or end-of-line.
  let k = keyEnd;
  while (k < n && (text.charCodeAt(k) === 0x20 || text.charCodeAt(k) === 0x09)) k += 1;
  if (k >= n || text.charCodeAt(k) !== 0x3a /* : */) return null;
  const colonIdx = k;
  k += 1;
  // After the colon, require whitespace or end-of-line for it to be a key.
  if (k < n && text.charCodeAt(k) !== 0x20 && text.charCodeAt(k) !== 0x09) {
    return null;
  }
  return { keyEnd, colonEnd: colonIdx + 1 };
}

/** Scan a double-quoted string starting at `start` (the opening `"`). Returns the index after the closing `"`, or -1 if unterminated. */
function scanDoubleQuoted(text: string, start: number): number {
  const n = text.length;
  let i = start + 1;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 0x5c /* \ */) {
      i += 2;
      continue;
    }
    if (c === 0x22 /* " */) return i + 1;
    i += 1;
  }
  return -1;
}

/** Scan a single-quoted string starting at `start` (the opening `'`). Returns the index after the closing `'`, or -1 if unterminated. */
function scanSingleQuoted(text: string, start: number): number {
  const n = text.length;
  let i = start + 1;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 0x27 /* ' */) {
      if (i + 1 < n && text.charCodeAt(i + 1) === 0x27 /* ' */) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return -1;
}

/**
 * Highlight a scalar value portion (the part after a `key:` or after a
 * sequence `-`, or a bare top-level scalar). Recognises quoted strings,
 * anchors/aliases, comments, block-scalar indicators, numbers, booleans,
 * null, and plain strings.
 */
function highlightScalar(text: string): string {
  const out: string[] = [];
  const n = text.length;
  let i = 0;

  // Alias: `*anchor` at start.
  if (i < n && text.charCodeAt(i) === 0x2a /* * */) {
    let j = i + 1;
    while (j < n && text.charCodeAt(j) !== 0x20 && text.charCodeAt(j) !== 0x09) j += 1;
    pushSpan(out, 'alias', text.slice(i, j));
    i = j;
    // Skip whitespace; trailing comment may follow.
    while (i < n && (text.charCodeAt(i) === 0x20 || text.charCodeAt(i) === 0x09)) {
      out.push(text[i]!);
      i += 1;
    }
    if (i < n && text.charCodeAt(i) === 0x23 /* # */) {
      pushSpan(out, 'comment', text.slice(i));
      return out.join('');
    }
    return out.join('');
  }

  // Double-quoted string.
  if (i < n && text.charCodeAt(i) === 0x22 /* " */) {
    const end = scanDoubleQuoted(text, i);
    if (end > 0) {
      pushSpan(out, 'string', text.slice(i, end));
      i = end;
      // Trailing comment?
      while (i < n && (text.charCodeAt(i) === 0x20 || text.charCodeAt(i) === 0x09)) {
        out.push(text[i]!);
        i += 1;
      }
      if (i < n && text.charCodeAt(i) === 0x23 /* # */) {
        pushSpan(out, 'comment', text.slice(i));
      } else if (i < n) {
        out.push(escapeHtml(text.slice(i)));
      }
      return out.join('');
    }
  }

  // Single-quoted string.
  if (i < n && text.charCodeAt(i) === 0x27 /* ' */) {
    const end = scanSingleQuoted(text, i);
    if (end > 0) {
      pushSpan(out, 'string', text.slice(i, end));
      i = end;
      while (i < n && (text.charCodeAt(i) === 0x20 || text.charCodeAt(i) === 0x09)) {
        out.push(text[i]!);
        i += 1;
      }
      if (i < n && text.charCodeAt(i) === 0x23 /* # */) {
        pushSpan(out, 'comment', text.slice(i));
      } else if (i < n) {
        out.push(escapeHtml(text.slice(i)));
      }
      return out.join('');
    }
  }

  // Flow collections `{ ... }` / `[ ... ]` - highlight as punct + scalars.
  if (i < n && (text.charCodeAt(i) === 0x7b /* { */ || text.charCodeAt(i) === 0x5b /* [ */)) {
    out.push(highlightFlow(text));
    return out.join('');
  }

  // Block scalar indicator: `|` or `>` optionally followed by `+`/`-`/digits,
  // then optional comment.
  if (i < n && (text.charCodeAt(i) === 0x7c /* | */ || text.charCodeAt(i) === 0x3e /* > */)) {
    let j = i + 1;
    while (j < n && text.charCodeAt(j) !== 0x20 && text.charCodeAt(j) !== 0x09 && text.charCodeAt(j) !== 0x23) {
      j += 1;
    }
    pushSpan(out, 'punct', text.slice(i, j));
    i = j;
    while (i < n && (text.charCodeAt(i) === 0x20 || text.charCodeAt(i) === 0x09)) {
      out.push(text[i]!);
      i += 1;
    }
    if (i < n && text.charCodeAt(i) === 0x23 /* # */) {
      pushSpan(out, 'comment', text.slice(i));
    }
    return out.join('');
  }

  // Plain scalar - may be number/boolean/null or a plain string, possibly
  // followed by a ` # comment`.
  let j = i;
  while (j < n && text.charCodeAt(j) !== 0x23 /* # */) j += 1;
  // Trim trailing whitespace from the scalar (before a possible comment).
  let scalarEnd = j;
  while (scalarEnd > i && (text.charCodeAt(scalarEnd - 1) === 0x20 || text.charCodeAt(scalarEnd - 1) === 0x09)) {
    scalarEnd -= 1;
  }
  const scalar = text.slice(i, scalarEnd);
  if (scalar.length > 0) {
    const cls = classifyPlainScalar(scalar);
    pushSpan(out, cls, scalar);
  }
  // Re-emit the trimmed whitespace.
  out.push(text.slice(scalarEnd, j));
  if (j < n && text.charCodeAt(j) === 0x23 /* # */) {
    pushSpan(out, 'comment', text.slice(j));
  }
  return out.join('');
}

/** Highlight a flow collection `{ ... }` or `[ ... ]` (single-line). */
function highlightFlow(text: string): string {
  const out: string[] = [];
  const n = text.length;
  let i = 0;
  let depth = 0;

  while (i < n) {
    const ch = text.charCodeAt(i);

    // Whitespace - preserve.
    if (ch === 0x20 || ch === 0x09 || ch === 0x2c /* , */ || ch === 0x3a /* : */) {
      if (ch === 0x2c || ch === 0x3a) {
        pushSpan(out, 'punct', text[i]!);
      } else {
        out.push(text[i]!);
      }
      i += 1;
      continue;
    }

    // Comment inside flow (rare but valid).
    if (ch === 0x23 /* # */) {
      pushSpan(out, 'comment', text.slice(i));
      break;
    }

    // Flow braces/brackets.
    if (ch === 0x7b /* { */ || ch === 0x5b /* [ */) {
      pushSpan(out, 'punct', text[i]!);
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === 0x7d /* } */ || ch === 0x5d /* ] */) {
      pushSpan(out, 'punct', text[i]!);
      depth -= 1;
      i += 1;
      continue;
    }

    // Quoted strings.
    if (ch === 0x22 /* " */) {
      const end = scanDoubleQuoted(text, i);
      if (end > 0) {
        // Could be a key if followed by `:` - peek ahead.
        let k = end;
        while (k < n && (text.charCodeAt(k) === 0x20 || text.charCodeAt(k) === 0x09)) k += 1;
        const isKey = k < n && text.charCodeAt(k) === 0x3a;
        pushSpan(out, isKey ? 'key' : 'string', text.slice(i, end));
        i = end;
        continue;
      }
    }
    if (ch === 0x27 /* ' */) {
      const end = scanSingleQuoted(text, i);
      if (end > 0) {
        let k = end;
        while (k < n && (text.charCodeAt(k) === 0x20 || text.charCodeAt(k) === 0x09)) k += 1;
        const isKey = k < n && text.charCodeAt(k) === 0x3a;
        pushSpan(out, isKey ? 'key' : 'string', text.slice(i, end));
        i = end;
        continue;
      }
    }

    // Alias.
    if (ch === 0x2a /* * */) {
      let j = i + 1;
      while (j < n && text.charCodeAt(j) !== 0x20 && text.charCodeAt(j) !== 0x09 && text.charCodeAt(j) !== 0x2c && text.charCodeAt(j) !== 0x7d && text.charCodeAt(j) !== 0x5d) j += 1;
      pushSpan(out, 'alias', text.slice(i, j));
      i = j;
      continue;
    }
    // Anchor.
    if (ch === 0x26 /* & */) {
      let j = i + 1;
      while (j < n && text.charCodeAt(j) !== 0x20 && text.charCodeAt(j) !== 0x09 && text.charCodeAt(j) !== 0x2c) j += 1;
      pushSpan(out, 'anchor', text.slice(i, j));
      i = j;
      continue;
    }

    // Plain token - read until a delimiter.
    let j = i;
    while (j < n) {
      const c = text.charCodeAt(j);
      if (c === 0x2c /* , */ || c === 0x7d /* } */ || c === 0x5d /* ] */ || c === 0x20 || c === 0x09) break;
      // `:` followed by whitespace/EOL or delimiter → key boundary.
      if (c === 0x3a /* : */) {
        const next = j + 1;
        if (next >= n || text.charCodeAt(next) === 0x20 || text.charCodeAt(next) === 0x09 || text.charCodeAt(next) === 0x2c) break;
      }
      j += 1;
    }
    if (j === i) {
      // Single unknown char - emit escaped.
      out.push(escapeHtml(text[i]!));
      i += 1;
      continue;
    }
    const token = text.slice(i, j);
    // Peek: is this a key (followed by `:`)?
    let k = j;
    while (k < n && (text.charCodeAt(k) === 0x20 || text.charCodeAt(k) === 0x09)) k += 1;
    const isKey = k < n && text.charCodeAt(k) === 0x3a;
    pushSpan(out, isKey ? 'key' : classifyPlainScalar(token), token);
    i = j;
  }

  void depth;
  return out.join('');
}

/**
 * Classify a plain (unquoted) scalar token as number / boolean / null / string.
 * Conservative: anything not obviously a number, boolean, or null is treated
 * as a plain string.
 */
function classifyPlainScalar(token: string): YamlTokenClass {
  if (token.length === 0) return 'string';
  // Null: `~` or `null` (case-insensitive in YAML 1.2 core schema: `null`/`Null`/`NULL`).
  if (token === '~' || token === 'null' || token === 'Null' || token === 'NULL') return 'null';
  // Booleans: `true`/`false` (YAML 1.2 core schema).
  if (token === 'true' || token === 'True' || token === 'TRUE') return 'boolean';
  if (token === 'false' || token === 'False' || token === 'FALSE') return 'boolean';
  // Numbers: integer, float, scientific notation, hex, octal, binary, +/- inf, NaN.
  if (/^[-+]?(\d+|0x[0-9a-fA-F]+|0o[0-7]+|0b[01]+)$/.test(token)) return 'number';
  if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(token)) return 'number';
  if (token === '.inf' || token === '.Inf' || token === '.INF' || token === '-.inf' || token === '-.Inf' || token === '-.INF') return 'number';
  if (token === '.nan' || token === '.NaN' || token === '.NAN') return 'number';
  return 'string';
}

/** Push an HTML-escaped `<span>` into the output buffer. */
function pushSpan(out: string[], cls: YamlTokenClass, text: string): void {
  out.push('<span class="qt-yaml-');
  out.push(cls);
  out.push('">');
  out.push(escapeHtml(text));
  out.push('</span>');
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
 * Convert a raw `yaml` package error (YAMLParseError / YAMLWarning) into a
 * normalised `YamlPrettifyError`. The `yaml` errors expose `linePos` (a
 * `[start, end]` pair of `{ line, col }` objects) and a `message` string.
 */
function toYamlError(err: unknown): YamlPrettifyError {
  if (err instanceof Error) {
    const anyErr = err as Error & {
      linePos?: Array<{ line: number; col: number }>;
      pos?: [number, number];
    };
    if (Array.isArray(anyErr.linePos) && anyErr.linePos.length > 0) {
      const start = anyErr.linePos[0]!;
      return {
        message: err.message,
        line: start.line,
        column: start.col,
        pos: anyErr.pos,
      };
    }
    return { message: err.message, pos: anyErr.pos };
  }
  return { message: String(err) };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface YamlPrettifyOutputs {
  yaml: string;
  documentCount: number;
  inputBytes: number;
  outputBytes: number;
  keyCount: number;
  maxDepth: number;
}

export const DEFAULT_INDENT: YamlIndent = 2;

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseYamlPrettifyReturn {
  input: Ref<string>;
  indent: Ref<YamlIndent>;
  flow: Ref<boolean>;
  directives: Ref<boolean>;
  showRaw: Ref<boolean>;
  outputs: Ref<YamlPrettifyOutputs | null>;
  error: Ref<YamlPrettifyError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setIndent: (i: YamlIndent) => void;
  toggleFlow: () => void;
  toggleDirectives: () => void;
  toggleShowRaw: () => void;
}

export function useYamlPrettify(): UseYamlPrettifyReturn {
  const input = ref<string>('');
  const indent = ref<YamlIndent>(DEFAULT_INDENT);
  const flow = ref<boolean>(false);
  const directives = ref<boolean>(false);
  const showRaw = ref<boolean>(false);
  const outputs = ref<YamlPrettifyOutputs | null>(null);
  const error = ref<YamlPrettifyError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = prettifyYaml(text, {
        indent: indent.value,
        flow: flow.value,
        directives: directives.value,
      });
      outputs.value = {
        yaml: r.yaml,
        documentCount: r.documentCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
        keyCount: r.keyCount,
        maxDepth: r.maxDepth,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as YamlPrettifyError;
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

  function setIndent(i: YamlIndent): void {
    indent.value = i;
  }

  function toggleFlow(): void {
    flow.value = !flow.value;
  }

  function toggleDirectives(): void {
    directives.value = !directives.value;
  }

  function toggleShowRaw(): void {
    showRaw.value = !showRaw.value;
  }

  watch(input, scheduleRun);
  watch(indent, scheduleRun);
  watch(flow, scheduleRun);
  watch(directives, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.yaml === 'string') {
        input.value = p.yaml;
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
      if (typeof p.flow === 'boolean') flow.value = p.flow;
      if (typeof p.directives === 'boolean') directives.value = p.directives;
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
    flow,
    directives,
    showRaw,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setIndent,
    toggleFlow,
    toggleDirectives,
    toggleShowRaw,
  };
}
