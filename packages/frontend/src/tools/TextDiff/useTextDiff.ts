/**
 * useTextDiff — composable + pure logic for the text diff tool.
 *
 * Computes a visual line/word/character/sentence diff between two text blocks
 * using the lazy-loaded `diff` package (JsDiff). The library lands in its own
 * Vite chunk (~20 KB) and is cached after first use.
 *
 * Pure helpers (`loadDiff`, `computeDiff`, `buildUnifiedPatch`,
 * `formatInlineHtml`, `buildSideBySide`, `escapeHtml`, `summarizeChanges`) have
 * no Vue dependency and can be imported standalone for unit testing or reuse.
 * The `useTextDiff()` composable wraps them in reactive state and wires up the
 * embed PostMessage protocol.
 *
 * Dependencies: `diff` (lazy-loaded, listed in tech-stack.md).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

/** Token granularity for the diff. */
export type DiffGranularity = 'chars' | 'words' | 'lines' | 'sentences';

/** Output presentation mode. */
export type DiffViewMode = 'inline' | 'side-by-side' | 'unified';

/** A single change record (mirrors `diff`'s `Change` shape, but plain). */
export interface DiffChange {
  /** Concatenated token content (text). */
  value: string;
  /** `true` if inserted into the new text. */
  added: boolean;
  /** `true` if removed from the old text. */
  removed: boolean;
  /** Number of tokens (chars/words/lines/sentences) in this run. */
  count: number;
}

/** A row in the side-by-side view — one side may be empty (a pure add/remove). */
export interface SideBySideRow {
  /** Left-side line content, or `null` when the row is a pure insertion. */
  left: string | null;
  /** Right-side line content, or `null` when the row is a pure deletion. */
  right: string | null;
  /** Kind of change for highlight purposes. */
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  /** 1-based line number on the left side (0 when left is null). */
  leftNumber: number;
  /** 1-based line number on the right side (0 when right is null). */
  rightNumber: number;
}

/** Summary counts of change kinds. */
export interface DiffCounts {
  added: number;
  removed: number;
  unchanged: number;
}

/** Result of a successful diff computation. */
export interface TextDiffResult {
  /** Raw change records from the diff engine. */
  changes: DiffChange[];
  /** Side-by-side aligned rows (always line-based for alignment). */
  rows: SideBySideRow[];
  /** Inline highlighted HTML (escaped, span-wrapped). */
  inlineHtml: string;
  /** Unified-diff patch text. */
  unifiedPatch: string;
  /** Summary counts. */
  counts: DiffCounts;
  /** Number of bytes in the left input (UTF-8). */
  leftBytes: number;
  /** Number of bytes in the right input (UTF-8). */
  rightBytes: number;
}

/** Options accepted by the diff computation. */
export interface DiffOptions {
  /** Token granularity. */
  granularity: DiffGranularity;
  /** Ignore character case when comparing. */
  ignoreCase: boolean;
  /** Ignore leading/trailing whitespace on lines (line granularity only). */
  ignoreWhitespace: boolean;
}

/* -------------------------------------------------------------------------- */
/* Lazy-loaded `diff` module cache                                             */
/* -------------------------------------------------------------------------- */

type DiffModule = typeof import('diff');

let diffPromise: Promise<DiffModule> | null = null;

/**
 * Lazily import the `diff` module. The import is cached so repeated calls
 * share a single promise (and a single Vite chunk download, ~20 KB).
 */
export function loadDiff(): Promise<DiffModule> {
  if (!diffPromise) {
    diffPromise = import('diff');
  }
  return diffPromise;
}

/**
 * Reset the cached `diff` promise. Exposed for unit tests so each test can
 * simulate a fresh load.
 */
export function resetDiffCache(): void {
  diffPromise = null;
}

/* -------------------------------------------------------------------------- */
/* Pure helpers — no Vue dependency                                            */
/* -------------------------------------------------------------------------- */

/**
 * Escape a string for safe insertion into HTML text content. Escapes `&`,
 * `<`, `>`, `"` and `'` so the result is safe inside both text nodes and
 * attribute values. Newlines are preserved (the caller wraps lines).
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Count UTF-8 bytes of a string without allocating a TextEncoder each call. */
const sharedEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
export function byteLength(s: string): number {
  if (sharedEncoder) return sharedEncoder.encode(s).length;
  // Fallback: approximate via char codes (good enough for ASCII/Latin-1).
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++; // skip low surrogate
    } else n += 3;
  }
  return n;
}

/**
 * Run the diff engine at the requested granularity and return raw change
 * records. The `diff` module must already be loaded.
 */
export function runDiff(
  mod: DiffModule,
  left: string,
  right: string,
  opts: DiffOptions,
): DiffChange[] {
  const { granularity, ignoreCase, ignoreWhitespace } = opts;
  switch (granularity) {
    case 'chars':
      return mod.diffChars(left, right, { ignoreCase }) as DiffChange[];
    case 'words':
      // diffWordsWithSpace keeps whitespace runs as their own tokens, which
      // produces a cleaner inline highlight than diffWords.
      return mod.diffWordsWithSpace(left, right, { ignoreCase }) as DiffChange[];
    case 'sentences':
      return mod.diffSentences(left, right) as DiffChange[];
    case 'lines':
    default: {
      const lineOpts: {
        ignoreWhitespace?: boolean;
        stripTrailingCr?: boolean;
        newlineIsToken?: boolean;
      } = {};
      if (ignoreWhitespace) lineOpts.ignoreWhitespace = true;
      // Use newlineIsToken so changes to blank lines are reported as their
      // own changes rather than merged into adjacent content — gives a more
      // intuitive side-by-side alignment.
      lineOpts.newlineIsToken = false;
      return mod.diffLines(left, right, lineOpts) as DiffChange[];
    }
  }
}

/**
 * Build the inline highlighted HTML for the change list. Each change run is
 * wrapped in a `<span>` tagged `td-add`, `td-del` or `td-keep`. The text is
 * HTML-escaped first, so the output is XSS-safe even with raw user input.
 *
 * Newlines inside a run are converted to `<br>` so the inline view renders as
 * a flowing stream. (The side-by-side view handles line alignment separately.)
 */
export function formatInlineHtml(changes: DiffChange[]): string {
  const out: string[] = [];
  for (const c of changes) {
    const cls = c.added ? 'td-add' : c.removed ? 'td-del' : 'td-keep';
    const escaped = escapeHtml(c.value).replace(/\r?\n/g, '<br>');
    out.push(`<span class="${cls}">${escaped}</span>`);
  }
  return out.join('');
}

/**
 * Build side-by-side aligned rows from line-granularity changes. The diff
 * engine returns runs of consecutive added/removed/unchanged lines; we pair
 * adjacent removed+added runs into "modified" rows when they appear together,
 * and emit pure adds/removes as one-sided rows.
 *
 * The input is expected to be line-granularity changes (each `value` is one or
 * more lines including their trailing newline). Non-line granularities are
 * converted to line changes via `diffLines` for the side-by-side view.
 */
export function buildSideBySide(changes: DiffChange[]): SideBySideRow[] {
  // Split each change run into individual lines (drop trailing empty line from
  // the final newline).
  const tokens: Array<{ text: string; added: boolean; removed: boolean }> = [];
  for (const c of changes) {
    const lines = c.value.split('\n');
    // If the run ends with a newline, the split produces a trailing '' — drop it.
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    for (const line of lines) {
      tokens.push({ text: line, added: c.added, removed: c.removed });
    }
  }

  const rows: SideBySideRow[] = [];
  let leftNum = 0;
  let rightNum = 0;
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (!t.added && !t.removed) {
      // unchanged line
      leftNum++;
      rightNum++;
      rows.push({
        left: t.text,
        right: t.text,
        type: 'unchanged',
        leftNumber: leftNum,
        rightNumber: rightNum,
      });
      i++;
    } else if (t.removed) {
      // Look ahead: is the next run an add? → pair them as modified rows.
      const removedRun: string[] = [t.text];
      let j = i + 1;
      while (j < tokens.length && tokens[j]!.removed) {
        removedRun.push(tokens[j]!.text);
        j++;
      }
      const addedRun: string[] = [];
      while (j < tokens.length && tokens[j]!.added) {
        addedRun.push(tokens[j]!.text);
        j++;
      }
      const max = Math.max(removedRun.length, addedRun.length);
      for (let k = 0; k < max; k++) {
        const l = removedRun[k] ?? null;
        const r = addedRun[k] ?? null;
        if (l !== null) leftNum++;
        if (r !== null) rightNum++;
        rows.push({
          left: l,
          right: r,
          type: l !== null && r !== null ? 'modified' : l !== null ? 'removed' : 'added',
          leftNumber: l !== null ? leftNum : 0,
          rightNumber: r !== null ? rightNum : 0,
        });
      }
      i = j;
    } else {
      // pure added run (no preceding removed)
      const addedRun: string[] = [t.text];
      let j = i + 1;
      while (j < tokens.length && tokens[j]!.added) {
        addedRun.push(tokens[j]!.text);
        j++;
      }
      for (const r of addedRun) {
        rightNum++;
        rows.push({
          left: null,
          right: r,
          type: 'added',
          leftNumber: 0,
          rightNumber: rightNum,
        });
      }
      i = j;
    }
  }
  return rows;
}

/** Tally change counts (added/removed/unchanged) over a change list. */
export function summarizeChanges(changes: DiffChange[]): DiffCounts {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const c of changes) {
    if (c.added) added += c.count;
    else if (c.removed) removed += c.count;
    else unchanged += c.count;
  }
  return { added, removed, unchanged };
}

/**
 * Build a unified-diff patch string from the two inputs. The `diff` module
 * must already be loaded.
 */
export function buildUnifiedPatch(
  mod: DiffModule,
  left: string,
  right: string,
  fileName = 'text',
  opts: { ignoreWhitespace?: boolean } = {},
): string {
  const patchOpts: { ignoreWhitespace?: boolean; context?: number } = {
    context: 3,
  };
  if (opts.ignoreWhitespace) patchOpts.ignoreWhitespace = true;
  return mod.createPatch(fileName, left, right, undefined, undefined, patchOpts);
}

/**
 * Compute the full diff result for a pair of inputs. Loads the `diff` module
 * (cached) and dispatches to the appropriate granularity. The side-by-side
 * view is always built from line-granularity changes for clean alignment,
 * regardless of the chosen inline granularity.
 */
export async function computeDiff(
  left: string,
  right: string,
  opts: DiffOptions,
): Promise<TextDiffResult> {
  const mod = await loadDiff();
  const changes = runDiff(mod, left, right, opts);
  // Side-by-side always uses line granularity for alignment.
  const lineChanges =
    opts.granularity === 'lines'
      ? changes
      : (runDiff(mod, left, right, {
          granularity: 'lines',
          ignoreCase: opts.ignoreCase,
          ignoreWhitespace: opts.ignoreWhitespace,
        }) as DiffChange[]);
  const rows = buildSideBySide(lineChanges);
  const inlineHtml = formatInlineHtml(changes);
  const unifiedPatch = buildUnifiedPatch(mod, left, right, 'text', {
    ignoreWhitespace: opts.ignoreWhitespace,
  });
  const counts = summarizeChanges(changes);
  return {
    changes,
    rows,
    inlineHtml,
    unifiedPatch,
    counts,
    leftBytes: byteLength(left),
    rightBytes: byteLength(right),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface TextDiffOutputs {
  changes: DiffChange[];
  rows: SideBySideRow[];
  inlineHtml: string;
  unifiedPatch: string;
  counts: DiffCounts;
  leftBytes: number;
  rightBytes: number;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 150;

export interface UseTextDiffReturn {
  leftInput: Ref<string>;
  rightInput: Ref<string>;
  granularity: Ref<DiffGranularity>;
  viewMode: Ref<DiffViewMode>;
  ignoreCase: Ref<boolean>;
  ignoreWhitespace: Ref<boolean>;
  outputs: Ref<TextDiffOutputs | null>;
  loading: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setGranularity: (g: DiffGranularity) => void;
  setViewMode: (m: DiffViewMode) => void;
  swapInputs: () => void;
}

export function useTextDiff(): UseTextDiffReturn {
  const leftInput = ref<string>('');
  const rightInput = ref<string>('');
  const granularity = ref<DiffGranularity>('lines');
  const viewMode = ref<DiffViewMode>('side-by-side');
  const ignoreCase = ref<boolean>(false);
  const ignoreWhitespace = ref<boolean>(false);
  const outputs = ref<TextDiffOutputs | null>(null);
  const loading = ref<boolean>(false);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  // Guard against out-of-order async completions when inputs change quickly.
  let runToken = 0;

  async function run(): Promise<void> {
    const leftText = leftInput.value;
    const rightText = rightInput.value;
    if (leftText.trim().length === 0 && rightText.trim().length === 0) {
      outputs.value = null;
      loading.value = false;
      return;
    }
    const token = ++runToken;
    loading.value = true;
    try {
      const r = await computeDiff(leftText, rightText, {
        granularity: granularity.value,
        ignoreCase: ignoreCase.value,
        ignoreWhitespace: ignoreWhitespace.value,
      });
      if (token !== runToken) return; // stale
      outputs.value = {
        changes: r.changes,
        rows: r.rows,
        inlineHtml: r.inlineHtml,
        unifiedPatch: r.unifiedPatch,
        counts: r.counts,
        leftBytes: r.leftBytes,
        rightBytes: r.rightBytes,
      };
    } catch (e) {
      if (token !== runToken) return;
      outputs.value = null;
      // Surface the error via the loading flag reset; the diff library rarely
      // throws for plain string inputs, but we never want to leave the spinner
      // spinning.
      console.error('[TextDiff] compute failed:', e);
    } finally {
      if (token === runToken) loading.value = false;
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    void run();
  }

  function setGranularity(g: DiffGranularity): void {
    granularity.value = g;
  }

  function setViewMode(m: DiffViewMode): void {
    viewMode.value = m;
  }

  function swapInputs(): void {
    const tmp = leftInput.value;
    leftInput.value = rightInput.value;
    rightInput.value = tmp;
  }

  watch(leftInput, scheduleRun);
  watch(rightInput, scheduleRun);
  watch(granularity, scheduleRun);
  watch(ignoreCase, scheduleRun);
  watch(ignoreWhitespace, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.left === 'string') leftInput.value = p.left;
      if (typeof p.right === 'string') rightInput.value = p.right;
      if (typeof p.leftInput === 'string') leftInput.value = p.leftInput;
      if (typeof p.rightInput === 'string') rightInput.value = p.rightInput;
      if (typeof p.text1 === 'string') leftInput.value = p.text1;
      if (typeof p.text2 === 'string') rightInput.value = p.text2;
      if (typeof p.input === 'string') leftInput.value = p.input;
      if (typeof p.value === 'string') leftInput.value = p.value;
      if (typeof p.content === 'string') leftInput.value = p.content;
      if (
        p.granularity === 'chars' ||
        p.granularity === 'words' ||
        p.granularity === 'lines' ||
        p.granularity === 'sentences'
      ) {
        granularity.value = p.granularity;
      }
      if (
        p.viewMode === 'inline' ||
        p.viewMode === 'side-by-side' ||
        p.viewMode === 'unified'
      ) {
        viewMode.value = p.viewMode;
      }
      if (typeof p.ignoreCase === 'boolean') ignoreCase.value = p.ignoreCase;
      if (typeof p.ignoreWhitespace === 'boolean')
        ignoreWhitespace.value = p.ignoreWhitespace;
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
    granularity,
    viewMode,
    ignoreCase,
    ignoreWhitespace,
    outputs,
    loading,
    isEmbed,
    embedInput,
    recompute,
    setGranularity,
    setViewMode,
    swapInputs,
  };
}
