/**
 * useJsonPrettify — composable + pure logic for the JSON prettify & format tool.
 *
 * Parses JSON text with `JSON.parse` and re-serializes it with `JSON.stringify`
 * using a configurable indent (2 spaces, 4 spaces, or a tab). Also produces a
 * syntax-highlighted HTML rendering of the prettified JSON via a small
 * hand-rolled tokenizer — no external dependencies, no `eval`, no DOM.
 *
 * Pure helpers (`parseJsonInput`, `prettifyJson`, `highlightJson`,
 * `analyzeJson`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useJsonPrettify()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * Dependencies: none (uses only the JSON builtin + TextEncoder).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation mode for the prettified output. */
export type JsonIndent = 2 | 4 | 'tab';

/** Result of a successful JSON prettify operation. */
export interface JsonPrettifyResult {
  /** Prettified JSON text. */
  json: string;
  /** Number of bytes in the input JSON (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output JSON (UTF-8). */
  outputBytes: number;
  /** Number of object keys present in the parsed value (recursive). */
  keyCount: number;
  /** Maximum nesting depth of the parsed value (scalars = 0). */
  maxDepth: number;
}

/** Normalised error from the JSON parser. */
export interface JsonPrettifyError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
}

/** Options accepted by `prettifyJson`. */
export interface JsonPrettifyOptions {
  /** Indentation mode (default 2). */
  indent?: JsonIndent;
}

/**
 * Parse JSON text into a single JS value. Throws a normalised
 * `JsonPrettifyError` on failure.
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
 * Prettify JSON text.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - Otherwise the input is parsed and re-serialized with the chosen indent.
 */
export function prettifyJson(
  input: string,
  options: JsonPrettifyOptions = {},
): JsonPrettifyResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const value = parseJsonInput(input);
  if (value === undefined) {
    return { json: '', inputBytes, outputBytes: 0, keyCount: 0, maxDepth: 0 };
  }

  const indent = options.indent ?? 2;
  const indentArg: string | number = indent === 'tab' ? '\t' : indent;

  let json: string;
  try {
    json = JSON.stringify(value, null, indentArg) ?? 'null';
  } catch (e) {
    // JSON.stringify throws on cycles or BigInt holders.
    throw toError(e);
  }

  const { keyCount, maxDepth } = analyzeJson(value);
  return {
    json,
    inputBytes,
    outputBytes: new TextEncoder().encode(json).length,
    keyCount,
    maxDepth,
  };
}

/**
 * Walk a parsed JSON value and report the total number of object keys and the
 * maximum nesting depth. Scalars (string/number/boolean/null) have depth 0;
 * objects/arrays have depth 1 + the max depth of their children. Cycles (which
 * cannot arise from `JSON.parse` but might from a hand-built value) are
 * guarded with a WeakSet.
 */
export function analyzeJson(value: unknown): {
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
/* Syntax highlighting — hand-rolled tokenizer, XSS-safe                       */
/* -------------------------------------------------------------------------- */

/** CSS class names emitted by `highlightJson`. Keep in sync with the .vue. */
export type JsonTokenClass =
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'punct';

/**
 * Syntax-highlight a prettified JSON string into safe HTML.
 *
 * The input MUST already be valid JSON (i.e. the output of `JSON.stringify`).
 * The tokenizer walks the string char-by-char, classifies each token, escapes
 * it for HTML, and wraps it in `<span class="qt-json-<class>">…</span>`.
 * Whitespace and newlines are preserved verbatim (escaped where needed) so the
 * caller can render the result inside a `<pre>`.
 *
 * Because every token's text is HTML-escaped before being inserted, the output
 * is safe to assign to `innerHTML` even if the original JSON contained strings
 * like `"<script>"`.
 */
export function highlightJson(json: string): string {
  if (json.length === 0) return '';
  const out: string[] = [];
  let i = 0;
  const n = json.length;

  function pushSpan(cls: JsonTokenClass, text: string): void {
    out.push('<span class="qt-json-');
    out.push(cls);
    out.push('">');
    out.push(escapeHtml(text));
    out.push('</span>');
  }

  while (i < n) {
    const ch = json.charCodeAt(i);

    // Whitespace and newlines — preserve verbatim (already HTML-safe).
    if (ch === 0x20 /* space */ || ch === 0x09 /* tab */ || ch === 0x0a /* \n */ || ch === 0x0d /* \r */) {
      out.push(json[i]!);
      i += 1;
      continue;
    }

    // Structural punctuation: { } [ ] : ,
    if (
      ch === 0x7b /* { */ || ch === 0x7d /* } */ ||
      ch === 0x5b /* [ */ || ch === 0x5d /* ] */ ||
      ch === 0x3a /* : */ || ch === 0x2c /* , */
    ) {
      pushSpan('punct', json[i]!);
      i += 1;
      continue;
    }

    // String literal — could be a key (followed by optional ws then ':') or a
    // plain string value.
    if (ch === 0x22 /* " */) {
      const start = i;
      i += 1; // skip opening quote
      while (i < n) {
        const c = json.charCodeAt(i);
        if (c === 0x5c /* backslash */) {
          // Skip the escaped char (whatever it is).
          i += 2;
          continue;
        }
        if (c === 0x22 /* " */) {
          i += 1; // include closing quote
          break;
        }
        i += 1;
      }
      const text = json.slice(start, i);
      // Look ahead: optional whitespace then ':' → key, else value.
      let j = i;
      while (j < n) {
        const c = json.charCodeAt(j);
        if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) {
          j += 1;
          continue;
        }
        break;
      }
      const isKey = j < n && json.charCodeAt(j) === 0x3a /* : */;
      pushSpan(isKey ? 'key' : 'string', text);
      continue;
    }

    // Numbers: digits, '-', '+', '.', 'e', 'E'.
    if (
      (ch >= 0x30 && ch <= 0x39) /* 0-9 */ ||
      ch === 0x2d /* - */ || ch === 0x2b /* + */ ||
      ch === 0x2e /* . */ ||
      ch === 0x65 /* e */ || ch === 0x45 /* E */
    ) {
      const start = i;
      while (i < n) {
        const c = json.charCodeAt(i);
        if (
          (c >= 0x30 && c <= 0x39) ||
          c === 0x2d || c === 0x2b || c === 0x2e ||
          c === 0x65 || c === 0x45
        ) {
          i += 1;
        } else {
          break;
        }
      }
      pushSpan('number', json.slice(start, i));
      continue;
    }

    // Literals: true / false / null.
    if (ch === 0x74 /* t */ && json.startsWith('true', i)) {
      pushSpan('boolean', 'true');
      i += 4;
      continue;
    }
    if (ch === 0x66 /* f */ && json.startsWith('false', i)) {
      pushSpan('boolean', 'false');
      i += 5;
      continue;
    }
    if (ch === 0x6e /* n */ && json.startsWith('null', i)) {
      pushSpan('null', 'null');
      i += 4;
      continue;
    }

    // Unknown char — escape and emit as plain text so we never break the HTML
    // structure even if the input wasn't strictly valid JSON.
    out.push(escapeHtml(json[i]!));
    i += 1;
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
 * Convert a raw `JSON.parse` SyntaxError (or stringify error) into a
 * normalised `JsonPrettifyError`.
 *
 * V8/Node SyntaxErrors expose the failing character position in the message
 * ("at position N"). We extract the position and translate it to a 1-based
 * line/column using the source text (when provided).
 */
function toError(err: unknown, source?: string): JsonPrettifyError {
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

export interface JsonPrettifyOutputs {
  json: string;
  inputBytes: number;
  outputBytes: number;
  keyCount: number;
  maxDepth: number;
}

export const DEFAULT_INDENT: JsonIndent = 2;

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseJsonPrettifyReturn {
  input: Ref<string>;
  indent: Ref<JsonIndent>;
  showRaw: Ref<boolean>;
  outputs: Ref<JsonPrettifyOutputs | null>;
  error: Ref<JsonPrettifyError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setIndent: (i: JsonIndent) => void;
  toggleShowRaw: () => void;
}

export function useJsonPrettify(): UseJsonPrettifyReturn {
  const input = ref<string>('');
  const indent = ref<JsonIndent>(DEFAULT_INDENT);
  const showRaw = ref<boolean>(false);
  const outputs = ref<JsonPrettifyOutputs | null>(null);
  const error = ref<JsonPrettifyError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = prettifyJson(text, { indent: indent.value });
      outputs.value = {
        json: r.json,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
        keyCount: r.keyCount,
        maxDepth: r.maxDepth,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as JsonPrettifyError;
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

  function setIndent(i: JsonIndent): void {
    indent.value = i;
  }

  function toggleShowRaw(): void {
    showRaw.value = !showRaw.value;
  }

  watch(input, scheduleRun);
  watch(indent, scheduleRun);

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
      if (typeof p.indent === 'number' && (p.indent === 2 || p.indent === 4)) {
        indent.value = p.indent;
      } else if (p.indent === 'tab') {
        indent.value = 'tab';
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
    showRaw,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setIndent,
    toggleShowRaw,
  };
}
