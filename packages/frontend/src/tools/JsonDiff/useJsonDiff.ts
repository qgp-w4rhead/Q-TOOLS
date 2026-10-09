/**
 * useJsonDiff - composable + pure logic for the JSON diff tool.
 *
 * Walks two parsed JSON values and produces a flat, path-based list of
 * `DiffEntry` records describing what was added, removed, changed, or left
 * unchanged. The walker is a hand-rolled recursive comparison - no external
 * dependency (the milestone spec explicitly allows a custom implementation).
 *
 * Pure helpers (`parseJson`, `diffJson`, `deepEqualJson`, `formatJsonValue`)
 * have no Vue dependency and can be imported standalone for unit testing or
 * reuse. The `useJsonDiff()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * Dependencies: none.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Kind of difference recorded at a given path. */
export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

/** A single path-based diff record. */
export interface DiffEntry {
  /** Dotted path from the document root, e.g. `root.user.name` or `root.items[2]`. */
  path: string;
  /** Kind of difference. */
  type: DiffType;
  /** Value from the left document (absent for `added`). */
  oldValue?: unknown;
  /** Value from the right document (absent for `removed`). */
  newValue?: unknown;
}

/** Normalised error from the JSON parser. */
export interface JsonDiffError {
  /** Which input produced the error. */
  side: 'left' | 'right';
  message: string;
  /** 1-based line, when available. */
  line?: number;
  /** 1-based column, when available. */
  column?: number;
}

/** View mode for the diff output. */
export type DiffViewMode = 'inline' | 'side-by-side';

/** Result of a successful diff computation. */
export interface JsonDiffResult {
  /** All diff entries (including unchanged when `showUnchanged` was true at compute time). */
  entries: DiffEntry[];
  /** Counts per type (over all entries, ignoring the `showUnchanged` filter). */
  counts: Record<DiffType, number>;
  /** Pretty-printed left document (2-space indent). Empty string if left input was empty/invalid. */
  leftPretty: string;
  /** Pretty-printed right document. */
  rightPretty: string;
  /** Number of bytes in the left input (UTF-8). */
  leftBytes: number;
  /** Number of bytes in the right input (UTF-8). */
  rightBytes: number;
}

/**
 * Parse JSON text into a single JS value. Throws a normalised `JsonDiffError`
 * on failure. Empty/whitespace input parses to `undefined` (treated as an
 * empty document by the diff walker).
 */
export function parseJson(input: string, side: 'left' | 'right'): unknown {
  if (typeof input !== 'string') {
    throw toError(new Error('Input must be a string.'), side, input);
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw toError(e, side, input);
  }
}

/**
 * Deep equality for JSON values. Uses `JSON.stringify` after a structural
 * kind check so that, e.g., `1` and `"1"` are not equal, and `{a:1,b:2}`
 * equals `{b:2,a:1}` (key order independent - `JSON.stringify` sorts? No, it
 * does not, so we sort keys first via a canonicaliser).
 */
export function deepEqualJson(a: unknown, b: unknown): boolean {
  return canonicalString(a) === canonicalString(b);
}

/**
 * Produce a canonical JSON string with sorted object keys so that key order
 * does not affect equality. Handles `undefined` (treated as `null` for
 * comparison purposes - JSON has no undefined).
 */
function canonicalString(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value === undefined ? null : value;
}

/**
 * Pretty-print a JSON value with 2-space indentation. Returns `''` for
 * `undefined` (empty document).
 */
export function formatJsonValue(value: unknown): string {
  if (value === undefined) return '';
  return JSON.stringify(value, null, 2);
}

/**
 * Format a single value for display in a diff row. Objects/arrays are
 * pretty-printed (2-space); primitives use `JSON.stringify` (so strings are
 * quoted, `null` shows as `null`).
 */
export function formatDiffValue(value: unknown): string {
  if (value === undefined) return '';
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value);
}

/** Classify a JS value into a structural kind for comparison. */
function kindOf(value: unknown): 'object' | 'array' | 'primitive' | 'undefined' {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'object';
  return 'primitive';
}

/**
 * Compute a path-based diff between two parsed JSON values.
 *
 * - Both objects → recurse into the union of sorted keys.
 * - Both arrays → compare element-by-element; trailing elements in the longer
 *   array are `added`/`removed`.
 * - Same primitive kind → `unchanged` if deep-equal, else `changed`.
 * - Different kinds (e.g. object vs primitive, object vs array) → `changed`
 *   at that path (no recursion).
 * - One side `undefined` (empty document) → the entire other side is
 *   `added`/`removed` at the root.
 */
export function diffJson(left: unknown, right: unknown): DiffEntry[] {
  const entries: DiffEntry[] = [];
  walk(left, right, 'root', entries);
  return entries;
}

function walk(left: unknown, right: unknown, path: string, out: DiffEntry[]): void {
  const lk = kindOf(left);
  const rk = kindOf(right);

  // One side is an empty document (undefined).
  if (lk === 'undefined' && rk === 'undefined') {
    out.push({ path, type: 'unchanged', oldValue: undefined, newValue: undefined });
    return;
  }
  if (lk === 'undefined') {
    out.push({ path, type: 'added', newValue: right });
    return;
  }
  if (rk === 'undefined') {
    out.push({ path, type: 'removed', oldValue: left });
    return;
  }

  // Both arrays → index-by-index comparison.
  if (lk === 'array' && rk === 'array') {
    const la = left as unknown[];
    const ra = right as unknown[];
    const max = Math.max(la.length, ra.length);
    for (let i = 0; i < max; i++) {
      const childPath = `${path}[${i}]`;
      if (i >= la.length) {
        out.push({ path: childPath, type: 'added', newValue: ra[i] });
      } else if (i >= ra.length) {
        out.push({ path: childPath, type: 'removed', oldValue: la[i] });
      } else {
        walk(la[i], ra[i], childPath, out);
      }
    }
    return;
  }

  // Both objects → recurse into the union of sorted keys.
  if (lk === 'object' && rk === 'object') {
    const lo = left as Record<string, unknown>;
    const ro = right as Record<string, unknown>;
    const keys = new Set<string>([...Object.keys(lo), ...Object.keys(ro)]);
    for (const key of Array.from(keys).sort()) {
      const childPath = `${path}.${key}`;
      const hasL = Object.prototype.hasOwnProperty.call(lo, key);
      const hasR = Object.prototype.hasOwnProperty.call(ro, key);
      if (hasL && hasR) {
        walk(lo[key], ro[key], childPath, out);
      } else if (hasR) {
        out.push({ path: childPath, type: 'added', newValue: ro[key] });
      } else {
        out.push({ path: childPath, type: 'removed', oldValue: lo[key] });
      }
    }
    return;
  }

  // Different kinds, or both primitives.
  if (deepEqualJson(left, right)) {
    out.push({ path, type: 'unchanged', oldValue: left, newValue: right });
  } else {
    out.push({ path, type: 'changed', oldValue: left, newValue: right });
  }
}

/**
 * Compute the full diff result for two JSON text inputs. Throws a
 * `JsonDiffError` if either input fails to parse.
 */
export function computeJsonDiff(leftText: string, rightText: string): JsonDiffResult {
  const left = parseJson(leftText, 'left');
  const right = parseJson(rightText, 'right');
  const entries = diffJson(left, right);
  const counts: Record<DiffType, number> = {
    added: 0,
    removed: 0,
    changed: 0,
    unchanged: 0,
  };
  for (const e of entries) counts[e.type] += 1;
  return {
    entries,
    counts,
    leftPretty: formatJsonValue(left),
    rightPretty: formatJsonValue(right),
    leftBytes: new TextEncoder().encode(leftText).length,
    rightBytes: new TextEncoder().encode(rightText).length,
  };
}

/**
 * Normalise a raw `JSON.parse` SyntaxError into a `JsonDiffError` with a
 * 1-based line/column when the position can be extracted from the message.
 */
function toError(err: unknown, side: 'left' | 'right', source?: string): JsonDiffError {
  if (err instanceof Error) {
    const anyErr = err as Error & { line?: number; column?: number };
    if (typeof anyErr.line === 'number' && typeof anyErr.column === 'number') {
      return { side, message: err.message, line: anyErr.line, column: anyErr.column };
    }
    if (source !== undefined) {
      const pos = extractPosition(err.message);
      if (pos !== -1) {
        const { line, column } = posToLineCol(source, pos);
        return { side, message: err.message, line, column };
      }
    }
    return { side, message: err.message };
  }
  return { side, message: String(err) };
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

export interface JsonDiffOutputs {
  entries: DiffEntry[];
  counts: Record<DiffType, number>;
  leftPretty: string;
  rightPretty: string;
  leftBytes: number;
  rightBytes: number;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseJsonDiffReturn {
  leftInput: Ref<string>;
  rightInput: Ref<string>;
  viewMode: Ref<DiffViewMode>;
  showUnchanged: Ref<boolean>;
  outputs: Ref<JsonDiffOutputs | null>;
  error: Ref<JsonDiffError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setViewMode: (m: DiffViewMode) => void;
  toggleShowUnchanged: () => void;
  swapInputs: () => void;
}

export function useJsonDiff(): UseJsonDiffReturn {
  const leftInput = ref<string>('');
  const rightInput = ref<string>('');
  const viewMode = ref<DiffViewMode>('inline');
  const showUnchanged = ref<boolean>(false);
  const outputs = ref<JsonDiffOutputs | null>(null);
  const error = ref<JsonDiffError | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const leftText = leftInput.value;
    const rightText = rightInput.value;
    if (leftText.trim().length === 0 && rightText.trim().length === 0) {
      outputs.value = null;
      error.value = null;
      return;
    }
    try {
      const r = computeJsonDiff(leftText, rightText);
      outputs.value = {
        entries: r.entries,
        counts: r.counts,
        leftPretty: r.leftPretty,
        rightPretty: r.rightPretty,
        leftBytes: r.leftBytes,
        rightBytes: r.rightBytes,
      };
      error.value = null;
    } catch (e) {
      outputs.value = null;
      error.value = e as JsonDiffError;
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

  function setViewMode(m: DiffViewMode): void {
    viewMode.value = m;
  }

  function toggleShowUnchanged(): void {
    showUnchanged.value = !showUnchanged.value;
  }

  function swapInputs(): void {
    const tmp = leftInput.value;
    leftInput.value = rightInput.value;
    rightInput.value = tmp;
  }

  watch(leftInput, scheduleRun);
  watch(rightInput, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.left === 'string') leftInput.value = p.left;
      if (typeof p.right === 'string') rightInput.value = p.right;
      if (typeof p.leftInput === 'string') leftInput.value = p.leftInput;
      if (typeof p.rightInput === 'string') rightInput.value = p.rightInput;
      if (p.viewMode === 'inline' || p.viewMode === 'side-by-side') {
        viewMode.value = p.viewMode;
      }
      if (typeof p.showUnchanged === 'boolean') showUnchanged.value = p.showUnchanged;
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    leftInput,
    rightInput,
    viewMode,
    showUnchanged,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setViewMode,
    toggleShowUnchanged,
    swapInputs,
  };
}
