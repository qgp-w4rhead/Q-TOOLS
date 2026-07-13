/**
 * useTomlToJson — composable + pure logic for the TOML → JSON converter.
 *
 * Parses TOML text via `smol-toml`'s `parse` and emits pretty-printed (or
 * compact) JSON. The `smol-toml` package is part of the initial bundle per
 * `tech-stack.md`, so it is statically imported here — no dynamic import, no
 * separate Vite chunk.
 *
 * Pure helpers (`parseToml`, `tomlToJson`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useTomlToJson()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * Dependencies: `smol-toml` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { parse as parseTomlText, TomlError } from 'smol-toml';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation mode for the JSON output. */
export type JsonIndent = 2 | 4 | 0;

/** Result of a successful TOML → JSON conversion. */
export interface TomlToJsonResult {
  /** Pretty-printed (or compact) JSON string. */
  json: string;
  /** Number of top-level keys in the parsed TOML table (0 for an empty table). */
  rootKeyCount: number;
  /** Number of bytes in the input TOML (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output JSON (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the TOML parser. */
export interface TomlParseError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
}

/**
 * Parse TOML text into a plain JS object. Throws a normalised `TomlParseError`
 * on failure.
 *
 * - Empty input → `null` (caller treats as "nothing to convert").
 * - `smol-toml`'s `parse` always returns a `TomlTable` (a plain object) for
 *   valid input; an empty TOML document parses to an empty object.
 */
export function parseToml(input: string): Record<string, unknown> | null {
  if (typeof input !== 'string') {
    throw toTomlError(new Error('Input must be a string.'));
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  try {
    return parseTomlText(trimmed) as Record<string, unknown>;
  } catch (e) {
    throw toTomlError(e);
  }
}

/**
 * Convert TOML text to a JSON string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - `indent: 0` → compact, single-line JSON.
 *
 * TOML dates/times (`TomlDate`, which extends `Date`) are serialized to ISO
 * strings by `JSON.stringify`'s default `Date` handling.
 */
export function tomlToJson(
  input: string,
  indent: JsonIndent = 2,
): TomlToJsonResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const obj = parseToml(input);
  if (obj === null) {
    return { json: '', rootKeyCount: 0, inputBytes, outputBytes: 0 };
  }

  const json = JSON.stringify(obj, null, indent === 0 ? undefined : indent);
  return {
    json,
    rootKeyCount: Object.keys(obj).length,
    inputBytes,
    outputBytes: new TextEncoder().encode(json).length,
  };
}

/**
 * Convert a raw `smol-toml` `TomlError` (or any thrown value) into a
 * normalised `TomlParseError`. `TomlError` exposes `line` and `column`
 * directly.
 */
function toTomlError(err: unknown): TomlParseError {
  if (err instanceof TomlError) {
    return {
      message: err.message,
      line: err.line,
      column: err.column,
    };
  }
  if (err instanceof Error) {
    const anyErr = err as Error & { line?: number; column?: number };
    if (typeof anyErr.line === 'number' && typeof anyErr.column === 'number') {
      return { message: err.message, line: anyErr.line, column: anyErr.column };
    }
    return { message: err.message };
  }
  return { message: String(err) };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface TomlToJsonOutputs {
  json: string;
  rootKeyCount: number;
  inputBytes: number;
  outputBytes: number;
}

export const DEFAULT_INDENT: JsonIndent = 2;

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseTomlToJsonReturn {
  input: Ref<string>;
  indent: Ref<JsonIndent>;
  outputs: Ref<TomlToJsonOutputs | null>;
  error: Ref<TomlParseError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setIndent: (i: JsonIndent) => void;
}

export function useTomlToJson(): UseTomlToJsonReturn {
  const input = ref<string>('');
  const indent = ref<JsonIndent>(DEFAULT_INDENT);
  const outputs = ref<TomlToJsonOutputs | null>(null);
  const error = ref<TomlParseError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = tomlToJson(text, indent.value);
      outputs.value = {
        json: r.json,
        rootKeyCount: r.rootKeyCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as TomlParseError;
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

  watch(input, scheduleRun);
  watch(indent, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.indent === 'number' && (p.indent === 0 || p.indent === 2 || p.indent === 4)) {
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
    indent,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setIndent,
  };
}
