/**
 * useYamlToToml - composable + pure logic for the YAML → TOML converter.
 *
 * Parses YAML text (single document only - TOML has no multi-document
 * support) and emits TOML via `smol-toml`'s `stringify`. Both `yaml` and
 * `smol-toml` are part of the initial bundle per `tech-stack.md`, so they
 * are statically imported here - no dynamic import, no separate Vite chunk.
 *
 * Pure helpers (`yamlToToml`, `parseYamlObject`) have no Vue dependency and
 * can be imported standalone for unit testing or reuse. The `useYamlToToml()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * Dependencies: `yaml`, `smol-toml` (both initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { parseAllDocuments, type Document } from 'yaml';
import { stringify as stringifyToml, TomlError } from 'smol-toml';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Result of a successful YAML → TOML conversion. */
export interface YamlToTomlResult {
  /** Serialized TOML text. */
  toml: string;
  /** Number of YAML documents parsed (always 1 - multi-doc streams error). */
  documentCount: number;
  /** Number of bytes in the input YAML (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output TOML (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the YAML parser or TOML serializer. */
export interface YamlToTomlError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
  /** Source stage that produced the error. */
  stage: 'yaml' | 'toml';
}

/**
 * Parse a single YAML document into a plain JS object suitable for TOML
 * serialization. Throws a normalised `YamlToTomlError` on failure.
 *
 * TOML's root is always a table, so:
 * - empty input → `null` (caller treats as "nothing to convert");
 * - multi-document YAML streams (`---` separators) → error (TOML has no
 *   multi-document form);
 * - single document that is not a plain object (`typeof !== 'object'` or
 *   `Array.isArray` or `null`) → error with a clear message.
 */
export function parseYamlObject(input: string): Record<string, unknown> | null {
  if (typeof input !== 'string') {
    throw toError(new Error('Input must be a string.'), 'yaml');
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const docs: Document.Parsed[] = parseAllDocuments(input, {
    keepSourceTokens: false,
  });

  if (docs.length === 0) return null;
  if (docs.length > 1) {
    throw toError(
      new Error(
        `Multi-document YAML streams (---) cannot be converted to TOML - TOML has no multi-document form. Found ${docs.length} documents.`,
      ),
      'yaml',
    );
  }

  const doc = docs[0]!;
  const err = doc.errors[0];
  if (err) throw toError(err, 'yaml');

  const value = doc.toJS();
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    const kind = Array.isArray(value) ? 'an array' : typeof value;
    throw toError(
      new Error(
        `TOML root must be a table (object). The YAML document parsed to ${kind}, which has no TOML representation at the top level.`,
      ),
      'toml',
    );
  }
  return value as Record<string, unknown>;
}

/**
 * Convert YAML text to a TOML string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - Multi-document YAML → error.
 * - Non-object YAML root → error.
 * - `numbersAsFloat: true` forces every number to render with a decimal part
 *   (e.g. `1.0` instead of `1`); useful when the source YAML distinguishes
 *   floats from integers and the caller wants to preserve that.
 */
export function yamlToToml(
  input: string,
  options: { numbersAsFloat?: boolean } = {},
): YamlToTomlResult {
  const obj = parseYamlObject(input);
  const inputBytes = new TextEncoder().encode(input).length;
  if (obj === null) {
    return { toml: '', documentCount: 0, inputBytes, outputBytes: 0 };
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
    documentCount: 1,
    inputBytes,
    outputBytes: new TextEncoder().encode(toml).length,
  };
}

/**
 * Convert a raw `yaml` package error or `smol-toml` `TomlError` into a
 * normalised `YamlToTomlError`. The `yaml` errors expose `linePos` (a
 * `[start, end]` pair of `{ line, col }` objects); `TomlError` exposes
 * `line` and `column` directly.
 */
function toError(err: unknown, stage: 'yaml' | 'toml'): YamlToTomlError {
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
      linePos?: Array<{ line: number; col: number }>;
    };
    if (Array.isArray(anyErr.linePos) && anyErr.linePos.length > 0) {
      const start = anyErr.linePos[0]!;
      return {
        message: err.message,
        line: start.line,
        column: start.col,
        stage,
      };
    }
    return { message: err.message, stage };
  }
  return { message: String(err), stage };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface YamlToTomlOutputs {
  toml: string;
  documentCount: number;
  inputBytes: number;
  outputBytes: number;
}

export interface UseYamlToTomlReturn {
  input: Ref<string>;
  numbersAsFloat: Ref<boolean>;
  outputs: Ref<YamlToTomlOutputs | null>;
  error: Ref<YamlToTomlError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  toggleNumbersAsFloat: () => void;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export function useYamlToToml(): UseYamlToTomlReturn {
  const input = ref<string>('');
  const numbersAsFloat = ref<boolean>(false);
  const outputs = ref<YamlToTomlOutputs | null>(null);
  const error = ref<YamlToTomlError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = yamlToToml(text, { numbersAsFloat: numbersAsFloat.value });
      outputs.value = {
        toml: r.toml,
        documentCount: r.documentCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as YamlToTomlError;
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
