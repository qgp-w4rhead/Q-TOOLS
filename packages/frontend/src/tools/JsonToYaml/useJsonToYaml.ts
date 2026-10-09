/**
 * useJsonToYaml - composable + pure logic for the JSON → YAML converter.
 *
 * Parses JSON text (single value, or an array of values when multi-document
 * YAML output is requested) and serializes it to YAML via the `yaml` package's
 * `stringify` / `Document.toString`. The `yaml` package is part of the
 * initial bundle per `tech-stack.md`, so it is statically imported here -
 * no dynamic import, no separate Vite chunk.
 *
 * Pure helpers (`parseJsonInput`, `jsonToYaml`) have no Vue dependency and
 * can be imported standalone for unit testing or reuse. The `useJsonToYaml()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * Dependencies: `yaml` (initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { stringify as stringifyYaml, Document } from 'yaml';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation width for the YAML output. */
export type YamlIndent = 2 | 4;

/** Result of a successful JSON → YAML conversion. */
export interface JsonToYamlResult {
  /** Serialized YAML text. */
  yaml: string;
  /** Number of YAML documents emitted (1 for a single value, N for a stream). */
  documentCount: number;
  /** Number of bytes in the input JSON (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output YAML (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the JSON parser or YAML serializer. */
export interface JsonToYamlError {
  message: string;
  /** 1-based line, when available (JSON.parse SyntaxError carries this). */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
  /** Source stage that produced the error. */
  stage: 'json' | 'yaml';
}

/** Options accepted by `jsonToYaml`. */
export interface JsonToYamlOptions {
  /** Indentation width (default 2). */
  indent?: YamlIndent;
  /** Force flow-style collections everywhere (default false → block style). */
  flow?: boolean;
  /**
   * Treat a top-level JSON array as a multi-document YAML stream (one
   * `---`-separated document per element). Default false → the array is
   * emitted as a single YAML sequence.
   */
  multiDoc?: boolean;
  /** Maximum line width before folding (0 disables folding). Default 80. */
  lineWidth?: number;
}

/**
 * Parse JSON text into a single JS value. Throws a normalised
 * `JsonToYamlError` (stage: 'json') on failure.
 *
 * `JSON.parse` throws a `SyntaxError` whose message usually contains the
 * character position (e.g. "Unexpected token … in JSON at position 42"). We
 * convert the character position to a 1-based line/column for display.
 */
export function parseJsonInput(input: string): unknown {
  if (typeof input !== 'string') {
    throw toError(new Error('Input must be a string.'), 'json');
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw toError(e, 'json', trimmed);
  }
}

/**
 * Convert JSON text to a YAML string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - With `multiDoc: true`, a top-level JSON array is emitted as a
 *   multi-document YAML stream (one `---`-separated document per element).
 *   Non-array inputs are still emitted as a single document.
 * - With `flow: true`, all maps and sequences use flow style.
 */
export function jsonToYaml(
  input: string,
  options: JsonToYamlOptions = {},
): JsonToYamlResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const value = parseJsonInput(input);
  if (value === undefined) {
    return { yaml: '', documentCount: 0, inputBytes, outputBytes: 0 };
  }

  const indent = options.indent ?? 2;
  const flow = options.flow ?? false;
  const multiDoc = options.multiDoc ?? false;
  const lineWidth = options.lineWidth ?? 80;

  const toStringOptions = {
    indent,
    collectionStyle: flow ? ('flow' as const) : ('block' as const),
    lineWidth,
  };

  let yaml: string;
  let documentCount: number;

  try {
    if (multiDoc && Array.isArray(value)) {
      // Emit one YAML document per array element, separated by `---`.
      const parts: string[] = [];
      for (const item of value) {
        const doc = new Document(item);
        // `directives: true` ensures the leading `---` marker is included.
        parts.push(doc.toString({ ...toStringOptions, directives: true }));
      }
      yaml = parts.join('\n').replace(/\n+$/, '\n');
      documentCount = value.length;
    } else {
      yaml = stringifyYaml(value, toStringOptions).replace(/\n+$/, '\n');
      documentCount = 1;
    }
  } catch (e) {
    throw toError(e, 'yaml');
  }

  return {
    yaml,
    documentCount,
    inputBytes,
    outputBytes: new TextEncoder().encode(yaml).length,
  };
}

/**
 * Convert a raw `JSON.parse` SyntaxError or YAML serializer error into a
 * normalised `JsonToYamlError`.
 *
 * V8/Node SyntaxErrors expose the failing character position in the message
 * ("at position N") and as `e.message`. We extract the position from the
 * message text and translate it to a 1-based line/column using the source
 * text (when provided). Newer engines also expose `err.line`/`err.column`
 * directly on some errors - we prefer those when present.
 */
function toError(err: unknown, stage: 'json' | 'yaml', source?: string): JsonToYamlError {
  if (err instanceof Error) {
    const anyErr = err as Error & {
      line?: number;
      column?: number;
      pos?: number;
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
  // Matches "at position N" (V8) - returns -1 if not found.
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

export interface JsonToYamlOutputs {
  yaml: string;
  documentCount: number;
  inputBytes: number;
  outputBytes: number;
}

export const DEFAULT_INDENT: YamlIndent = 2;

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseJsonToYamlReturn {
  input: Ref<string>;
  indent: Ref<YamlIndent>;
  flow: Ref<boolean>;
  multiDoc: Ref<boolean>;
  outputs: Ref<JsonToYamlOutputs | null>;
  error: Ref<JsonToYamlError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setIndent: (i: YamlIndent) => void;
  toggleFlow: () => void;
  toggleMultiDoc: () => void;
}

export function useJsonToYaml(): UseJsonToYamlReturn {
  const input = ref<string>('');
  const indent = ref<YamlIndent>(DEFAULT_INDENT);
  const flow = ref<boolean>(false);
  const multiDoc = ref<boolean>(false);
  const outputs = ref<JsonToYamlOutputs | null>(null);
  const error = ref<JsonToYamlError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = jsonToYaml(text, {
        indent: indent.value,
        flow: flow.value,
        multiDoc: multiDoc.value,
      });
      outputs.value = {
        yaml: r.yaml,
        documentCount: r.documentCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as JsonToYamlError;
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

  function toggleMultiDoc(): void {
    multiDoc.value = !multiDoc.value;
  }

  watch(input, scheduleRun);
  watch(indent, scheduleRun);
  watch(flow, scheduleRun);
  watch(multiDoc, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.indent === 'number' && (p.indent === 2 || p.indent === 4)) {
        indent.value = p.indent as YamlIndent;
      }
      if (typeof p.flow === 'boolean') flow.value = p.flow;
      if (typeof p.multiDoc === 'boolean') multiDoc.value = p.multiDoc;
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
    multiDoc,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setIndent,
    toggleFlow,
    toggleMultiDoc,
  };
}
