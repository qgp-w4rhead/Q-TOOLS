/**
 * useJsonMinify - composable + pure logic for the JSON minify tool.
 *
 * Parses JSON text with `JSON.parse` and re-serializes it with
 * `JSON.stringify(value)` (no indent argument) → single-line, whitespace-free
 * minified JSON. Also reports byte savings so the user can see how much space
 * was reclaimed.
 *
 * Pure helpers (`parseJsonInput`, `minifyJson`, `analyzeJson`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `useJsonMinify()` composable wraps them in reactive state and wires up the
 * embed PostMessage protocol.
 *
 * Dependencies: none (uses only the JSON builtin + TextEncoder).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Result of a successful JSON minify operation. */
export interface JsonMinifyResult {
  /** Minified JSON text. */
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
export interface JsonMinifyError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
}

/**
 * Parse JSON text into a single JS value. Throws a normalised
 * `JsonMinifyError` on failure.
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
 * Minify JSON text.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - Otherwise the input is parsed and re-serialized with no indent (single
 *   line, no whitespace).
 */
export function minifyJson(input: string): JsonMinifyResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const value = parseJsonInput(input);
  if (value === undefined) {
    return { json: '', inputBytes, outputBytes: 0, keyCount: 0, maxDepth: 0 };
  }

  let json: string;
  try {
    json = JSON.stringify(value) ?? 'null';
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
/* Error helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Convert a raw `JSON.parse` SyntaxError (or stringify error) into a
 * normalised `JsonMinifyError`.
 *
 * V8/Node SyntaxErrors expose the failing character position in the message
 * ("at position N"). We extract the position and translate it to a 1-based
 * line/column using the source text (when provided).
 */
function toError(err: unknown, source?: string): JsonMinifyError {
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
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface JsonMinifyOutputs {
  json: string;
  inputBytes: number;
  outputBytes: number;
  keyCount: number;
  maxDepth: number;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseJsonMinifyReturn {
  input: Ref<string>;
  outputs: Ref<JsonMinifyOutputs | null>;
  error: Ref<JsonMinifyError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useJsonMinify(): UseJsonMinifyReturn {
  const input = ref<string>('');
  const outputs = ref<JsonMinifyOutputs | null>(null);
  const error = ref<JsonMinifyError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = minifyJson(text);
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
      error.value = e as JsonMinifyError;
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

  watch(input, scheduleRun);

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
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
  };
}
