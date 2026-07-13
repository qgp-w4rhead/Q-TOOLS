/**
 * useTomlToYaml — composable + pure logic for the TOML → YAML converter.
 *
 * Parses TOML text via `smol-toml`'s `parse` and serializes the result to YAML
 * via the `yaml` package's `stringify`. Both packages are part of the initial
 * bundle per `tech-stack.md`, so they are statically imported here — no dynamic
 * import, no separate Vite chunk.
 *
 * `smol-toml` returns `TomlDate` instances (which extend `Date`) for TOML
 * date/time values and `BigInt` for integers that exceed `Number.MAX_SAFE_INTEGER`.
 * Neither is handled natively by the `yaml` serializer in a way that preserves
 * the original TOML semantics, so a `normalizeForYaml` pass converts:
 *   - `TomlDate` → its `toISOString()` string (preserves local-date / local-time
 *     / offset-datetime formatting exactly as authored in the TOML source).
 *   - `BigInt`   → `Number` when safe, otherwise its decimal string form.
 *
 * Pure helpers (`parseToml`, `normalizeForYaml`, `tomlToYaml`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `useTomlToYaml()` composable wraps them in reactive state and wires up the
 * embed PostMessage protocol.
 *
 * Dependencies: `smol-toml` + `yaml` (both initial bundle).
 */
import { ref, watch, type Ref } from 'vue';
import { parse as parseTomlText, TomlError, TomlDate } from 'smol-toml';
import { stringify as stringifyYaml } from 'yaml';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Indentation width for the YAML output. */
export type YamlIndent = 2 | 4;

/** Result of a successful TOML → YAML conversion. */
export interface TomlToYamlResult {
  /** Serialized YAML text. */
  yaml: string;
  /** Number of top-level keys in the parsed TOML table (0 for an empty table). */
  rootKeyCount: number;
  /** Number of bytes in the input TOML (UTF-8). */
  inputBytes: number;
  /** Number of bytes in the output YAML (UTF-8). */
  outputBytes: number;
}

/** Normalised error from the TOML parser or YAML serializer. */
export interface TomlToYamlError {
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
  /** Source stage that produced the error. */
  stage: 'toml' | 'yaml';
}

/** Options accepted by `tomlToYaml`. */
export interface TomlToYamlOptions {
  /** Indentation width (default 2). */
  indent?: YamlIndent;
  /** Force flow-style collections everywhere (default false → block style). */
  flow?: boolean;
  /** Maximum line width before folding (0 disables folding). Default 80. */
  lineWidth?: number;
}

/**
 * Parse TOML text into a plain JS object. Throws a normalised
 * `TomlToYamlError` (stage: 'toml') on failure.
 *
 * - Empty input → `null` (caller treats as "nothing to convert").
 * - `smol-toml`'s `parse` always returns a `TomlTable` (a plain object) for
 *   valid input; an empty TOML document parses to an empty object.
 */
export function parseToml(input: string): Record<string, unknown> | null {
  if (typeof input !== 'string') {
    throw toError(new Error('Input must be a string.'), 'toml');
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  try {
    return parseTomlText(trimmed) as Record<string, unknown>;
  } catch (e) {
    throw toError(e, 'toml');
  }
}

/**
 * Walk a parsed TOML value and convert `TomlDate` / `BigInt` instances into
 * YAML-safe primitives:
 *
 * - `TomlDate` → `toISOString()` string. `TomlDate` overrides `toISOString`
 *   to preserve the original TOML formatting (local date `YYYY-MM-DD`, local
 *   time `HH:MM:SS`, local datetime, or offset datetime with the authored
 *   timezone suffix). The `yaml` serializer would otherwise emit a generic
 *   `!!timestamp` from the underlying epoch, losing local-date/time semantics.
 * - `BigInt`   → `Number` when the value fits in `Number.MAX_SAFE_INTEGER`,
 *   otherwise its decimal string form. The `yaml` serializer does not handle
 *   `BigInt` natively.
 *
 * Arrays and plain objects are recursed; everything else is returned as-is.
 */
export function normalizeForYaml(value: unknown): unknown {
  if (value instanceof TomlDate) {
    return value.toISOString();
  }
  if (typeof value === 'bigint') {
    if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) {
      return Number(value);
    }
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeForYaml);
  }
  if (value !== null && typeof value === 'object') {
    // Avoid mutating the original parsed table; build a fresh object.
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeForYaml(v);
    }
    return out;
  }
  return value;
}

/**
 * Convert TOML text to a YAML string.
 *
 * - Empty input → empty result (caller shows the empty state).
 * - `flow: true` → all maps and sequences use flow style.
 */
export function tomlToYaml(
  input: string,
  options: TomlToYamlOptions = {},
): TomlToYamlResult {
  const inputBytes = new TextEncoder().encode(input).length;
  const obj = parseToml(input);
  if (obj === null) {
    return { yaml: '', rootKeyCount: 0, inputBytes, outputBytes: 0 };
  }

  const indent = options.indent ?? 2;
  const flow = options.flow ?? false;
  const lineWidth = options.lineWidth ?? 80;

  const normalized = normalizeForYaml(obj) as Record<string, unknown>;

  let yaml: string;
  try {
    yaml = stringifyYaml(normalized, {
      indent,
      collectionStyle: flow ? ('flow' as const) : ('block' as const),
      lineWidth,
    }).replace(/\n+$/, '\n');
  } catch (e) {
    throw toError(e, 'yaml');
  }

  return {
    yaml,
    rootKeyCount: Object.keys(obj).length,
    inputBytes,
    outputBytes: new TextEncoder().encode(yaml).length,
  };
}

/**
 * Convert a raw `smol-toml` `TomlError` (or any thrown value) into a
 * normalised `TomlToYamlError`. `TomlError` exposes `line` and `column`
 * directly.
 */
function toError(err: unknown, stage: 'toml' | 'yaml'): TomlToYamlError {
  if (err instanceof TomlError) {
    return {
      message: err.message,
      line: err.line,
      column: err.column,
      stage,
    };
  }
  if (err instanceof Error) {
    const anyErr = err as Error & { line?: number; column?: number };
    if (typeof anyErr.line === 'number' && typeof anyErr.column === 'number') {
      return { message: err.message, line: anyErr.line, column: anyErr.column, stage };
    }
    return { message: err.message, stage };
  }
  return { message: String(err), stage };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface TomlToYamlOutputs {
  yaml: string;
  rootKeyCount: number;
  inputBytes: number;
  outputBytes: number;
}

export const DEFAULT_INDENT: YamlIndent = 2;

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseTomlToYamlReturn {
  input: Ref<string>;
  indent: Ref<YamlIndent>;
  flow: Ref<boolean>;
  outputs: Ref<TomlToYamlOutputs | null>;
  error: Ref<TomlToYamlError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setIndent: (i: YamlIndent) => void;
  toggleFlow: () => void;
}

export function useTomlToYaml(): UseTomlToYamlReturn {
  const input = ref<string>('');
  const indent = ref<YamlIndent>(DEFAULT_INDENT);
  const flow = ref<boolean>(false);
  const outputs = ref<TomlToYamlOutputs | null>(null);
  const error = ref<TomlToYamlError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = tomlToYaml(text, {
        indent: indent.value,
        flow: flow.value,
      });
      outputs.value = {
        yaml: r.yaml,
        rootKeyCount: r.rootKeyCount,
        inputBytes: r.inputBytes,
        outputBytes: r.outputBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as TomlToYamlError;
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

  watch(input, scheduleRun);
  watch(indent, scheduleRun);
  watch(flow, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.indent === 'number' && (p.indent === 2 || p.indent === 4)) {
        indent.value = p.indent as YamlIndent;
      }
      if (typeof p.flow === 'boolean') flow.value = p.flow;
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
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setIndent,
    toggleFlow,
  };
}
