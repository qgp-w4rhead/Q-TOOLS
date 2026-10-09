/**
 * useYamlToJson - composable + pure logic for the YAML → JSON converter.
 *
 * Parses YAML text (single document or multi-document streams) and emits
 * pretty-printed (or compact) JSON. The `yaml` package is part of the
 * initial bundle per `tech-stack.md`, so it is statically imported here -
 * no dynamic import, no separate Vite chunk.
 *
 * Pure helpers (`yamlToJson`, `parseYamlDocuments`) have no Vue dependency
 * and can be imported standalone for unit testing or reuse. The
 * `useYamlToJson()` composable wraps them in reactive state and wires up
 * the embed PostMessage protocol.
 *
 * Dependencies: `yaml` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { parseAllDocuments, type Document } from 'yaml';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation mode for the JSON output. */
export type JsonIndent = 2 | 4 | 0;

/** Result of a successful YAML → JSON conversion. */
export interface YamlToJsonResult {
  /** Pretty-printed (or compact) JSON string. */
  json: string;
  /** Number of YAML documents parsed (1 for a single doc, N for a stream). */
  documentCount: number;
  /** Number of bytes in the input YAML (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output JSON (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the YAML parser. */
export interface YamlParseError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
  /** Source position range, when available. */
  pos?: [number, number];
}

/**
 * Parse YAML text into an array of JS values (one entry per document in a
 * multi-document stream). Throws a normalised `YamlParseError` on failure.
 *
 * We use `parseAllDocuments` rather than `parse` so multi-document YAML
 * streams (`---` separators) are handled uniformly: a single-document
 * input yields a one-element array. Each `Document` may carry its own
 * errors (collected by the parser); we surface the first one as a
 * `YamlParseError`.
 */
export function parseYamlDocuments(input: string): unknown[] {
  if (typeof input !== 'string') {
    throw toYamlError(new Error('Input must be a string.'));
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];

  const docs: Document.Parsed[] = parseAllDocuments(input, {
    // Keep map key order as written in the source.
    keepSourceTokens: false,
    // Resolve anchors/aliases; default behaviour is fine.
  });

  const out: unknown[] = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    // The `yaml` package collects errors on each Document. Surface the
    // first one so the user sees a precise line/column.
    const err = doc.errors[0];
    if (err) throw toYamlError(err);
    // Warnings are non-fatal; we ignore them for the converter.
    out.push(doc.toJS());
  }
  return out;
}

/**
 * Convert YAML text to a JSON string.
 *
 * - Multi-document YAML streams produce a JSON array (one element per doc).
 * - Single-document YAML produces a single JSON value (object/array/scalar)
 *   unless `forceArray` is set, in which case it is wrapped in an array.
 * - `indent: 0` → compact, single-line JSON.
 */
export function yamlToJson(
  input: string,
  indent: JsonIndent = 2,
  forceArray = false,
): YamlToJsonResult {
  const docs = parseYamlDocuments(input);
  if (docs.length === 0) {
    return {
      json: '',
      documentCount: 0,
      inputBytes: new TextEncoder().encode(input).length,
      outputBytes: 0,
    };
  }

  // Single-document input → emit the bare value (object/array/scalar)
  // unless the caller explicitly wants an array. Multi-document streams
  // always emit a JSON array.
  const value =
    docs.length === 1 && !forceArray ? docs[0] : docs;

  const json = JSON.stringify(value, null, indent === 0 ? undefined : indent);
  return {
    json,
    documentCount: docs.length,
    inputBytes: new TextEncoder().encode(input).length,
    outputBytes: new TextEncoder().encode(json).length,
  };
}

/**
 * Convert a raw `yaml` package error (YAMLParseError / YAMLWarning) into a
 * normalised `YamlParseError`. The `yaml` errors expose `linePos` (a
 * `[start, end]` pair of `{ line, col }` objects) and a `message` string.
 */
function toYamlError(err: unknown): YamlParseError {
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

export interface YamlToJsonOutputs {
  json: string;
  documentCount: number;
  inputBytes: number;
  outputBytes: number;
}

export const DEFAULT_INDENT: JsonIndent = 2;

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseYamlToJsonReturn {
  input: Ref<string>;
  indent: Ref<JsonIndent>;
  forceArray: Ref<boolean>;
  outputs: Ref<YamlToJsonOutputs | null>;
  error: Ref<YamlParseError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setIndent: (i: JsonIndent) => void;
}

export function useYamlToJson(): UseYamlToJsonReturn {
  const input = ref<string>('');
  const indent = ref<JsonIndent>(DEFAULT_INDENT);
  const forceArray = ref<boolean>(false);
  const outputs = ref<YamlToJsonOutputs | null>(null);
  const error = ref<YamlParseError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = yamlToJson(text, indent.value, forceArray.value);
      outputs.value = {
        json: r.json,
        documentCount: r.documentCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = toYamlError(e);
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
  watch(forceArray, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.indent === 'number' && (p.indent === 0 || p.indent === 2 || p.indent === 4)) {
        indent.value = p.indent as JsonIndent;
      }
      if (typeof p.forceArray === 'boolean') forceArray.value = p.forceArray;
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
    forceArray,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setIndent,
  };
}
