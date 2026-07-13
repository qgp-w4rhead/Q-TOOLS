/**
 * useJsonToToml — composable + pure logic for the JSON → TOML converter.
 *
 * Parses JSON text (single object only — TOML's root is always a table) and
 * emits TOML via `smol-toml`'s `stringify`. The `smol-toml` package is part
 * of the initial bundle per `tech-stack.md`, so it is statically imported
 * here — no dynamic import, no separate Vite chunk.
 *
 * Pure helpers (`parseJsonObject`, `jsonToToml`) have no Vue dependency and
 * can be imported standalone for unit testing or reuse. The `useJsonToToml()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * Dependencies: `smol-toml` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { stringify as stringifyToml, TomlError } from 'smol-toml';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Result of a successful JSON → TOML conversion. */
export interface JsonToTomlResult {
  /** Serialized TOML text. */
  toml: string;
  /** Number of top-level keys in the root table (0 for an empty object). */
  rootKeyCount: number;
  /** Number of bytes in the input JSON (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output TOML (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the JSON parser or TOML serializer. */
export interface JsonToTomlError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
  /** Source stage that produced the error. */
  stage: 'json' | 'toml';
}

/** Options accepted by `jsonToToml`. */
export interface JsonToTomlOptions {
  /**
   * Render every number with a decimal part (e.g. `1.0` instead of `1`).
   * Useful when the source JSON distinguishes floats from integers and the
   * caller wants to preserve that. Default false.
   */
  numbersAsFloat?: boolean;
}

/**
 * Parse JSON text into a plain JS object suitable for TOML serialization.
 * Throws a normalised `JsonToTomlError` (stage: 'json') on failure.
 *
 * TOML's root is always a table, so:
 * - empty input → `null` (caller treats as "nothing to convert");
 * - a top-level value that is not a plain object (`typeof !== 'object'`,
 *   `Array.isArray`, or `null`) → error with a clear message.
 */
export function parseJsonObject(input: string): Record<string, unknown> | null {
  if (typeof input !== 'string') {
    throw toError(new Error('Input must be a string.'), 'json');
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (e) {
    throw toError(e, 'json', trimmed);
  }

  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    const kind = Array.isArray(value) ? 'an array' : typeof value;
    throw toError(
      new Error(
        `TOML root must be a table (object). The JSON parsed to ${kind}, which has no TOML representation at the top level.`,
      ),
      'toml',
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Convert JSON text to a TOML string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - Non-object JSON root → error.
 * - `numbersAsFloat: true` forces every number to render with a decimal part
 *   (e.g. `1.0` instead of `1`); useful when the source JSON distinguishes
 *   floats from integers and the caller wants to preserve that.
 */
export function jsonToToml(
  input: string,
  options: JsonToTomlOptions = {},
): JsonToTomlResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const obj = parseJsonObject(input);
  if (obj === null) {
    return { toml: '', rootKeyCount: 0, inputBytes, outputBytes: 0 };
  }

  let toml: string;
  try {
    toml = stringifyToml(obj, {
      numbersAsFloat: options.numbersAsFloat ?? false,
    });
  } catch (e) {
    throw toError(e, 'toml');
  }

  return {
    toml,
    rootKeyCount: Object.keys(obj).length,
    inputBytes,
    outputBytes: new TextEncoder().encode(toml).length,
  };
}

/**
 * Convert a raw `JSON.parse` SyntaxError or `smol-toml` `TomlError` into a
 * normalised `JsonToTomlError`.
 *
 * V8/Node SyntaxErrors expose the failing character position in the message
 * ("at position N") and as `e.message`. We extract the position from the
 * message text and translate it to a 1-based line/column using the source
 * text (when provided). `TomlError` exposes `line` and `column` directly.
 */
function toError(err: unknown, stage: 'json' | 'toml', source?: string): JsonToTomlError {
  if (err instanceof TomlError) {
    return {
      message: err.message,
      line: err.line,
      column: err.column,
      stage: 'toml',
    };
  }
  if (err instanceof Error) {
    const anyErr = err as Error & {
      line?: number;
      column?: number;
    };
    // Prefer explicit line/column if the engine provides them.
    if (typeof anyErr.line === 'number' && typeof anyErr.column === 'number') {
      return { message: err.message, line: anyErr.line, column: anyErr.column, stage };
    }
    // Otherwise, try to extract a character position from the message.
    if (source !== undefined) {
      const pos = extractPosition(err.message);
      if (pos !== -1) {
        const { line, column } = posToLineCol(source, pos);
        return { message: err.message, line, column, stage };
      }
    }
    return { message: err.message, stage };
  }
  return { message: String(err), stage };
}

/** Extract the character position from a V8/Node SyntaxError message. */
function extractPosition(message: string): number {
  // Matches "at position N" (V8) — returns -1 if not found.
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

export interface JsonToTomlOutputs {
  toml: string;
  rootKeyCount: number;
  inputBytes: number;
  outputBytes: number;
}

export interface UseJsonToTomlReturn {
  input: Ref<string>;
  numbersAsFloat: Ref<boolean>;
  outputs: Ref<JsonToTomlOutputs | null>;
  error: Ref<JsonToTomlError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  toggleNumbersAsFloat: () => void;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export function useJsonToToml(): UseJsonToTomlReturn {
  const input = ref<string>('');
  const numbersAsFloat = ref<boolean>(false);
  const outputs = ref<JsonToTomlOutputs | null>(null);
  const error = ref<JsonToTomlError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = jsonToToml(text, { numbersAsFloat: numbersAsFloat.value });
      outputs.value = {
        toml: r.toml,
        rootKeyCount: r.rootKeyCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as JsonToTomlError;
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

  function toggleNumbersAsFloat(): void {
    numbersAsFloat.value = !numbersAsFloat.value;
  }

  watch(input, scheduleRun);
  watch(numbersAsFloat, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.numbersAsFloat === 'boolean') {
        numbersAsFloat.value = p.numbersAsFloat;
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
    numbersAsFloat,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    toggleNumbersAsFloat,
  };
}
