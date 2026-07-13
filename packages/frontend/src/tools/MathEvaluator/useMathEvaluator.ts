/**
 * useMathEvaluator — composable + pure logic for the math evaluator tool.
 *
 * Safely evaluates mathematical expression strings via the lazy-loaded
 * `expr-eval` parser. The parser supports `+ - * / ^ %`, parentheses, the
 * functions `sin cos tan log ln sqrt abs round floor ceil` (plus a few extras
 * exposed by the library), and the constants `pi` and `e`. Crucially, the
 * expression is **never** passed through `eval()` or `new Function()` —
 * `expr-eval` builds an AST and walks it, so arbitrary code execution is
 * impossible.
 *
 * Pure helpers (`loadExprEval`, `evaluateExpression`, `formatResult`,
 * `normaliseError`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useMathEvaluator()` composable wraps them in
 * reactive state, maintains a history of previous expressions, and wires up
 * the embed PostMessage protocol.
 *
 * Dependencies: `expr-eval` (lazy-loaded, listed in tech-stack.md).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

/** Result of a successful evaluation. */
export interface MathResult {
  /** The original expression string (trimmed). */
  expression: string;
  /** The numeric result. */
  result: number;
  /** Whether evaluation succeeded (always `true` for `MathResult`). */
  ok: true;
}

/** Normalised error from the evaluator. */
export interface MathError {
  /** The expression that failed (trimmed). */
  expression: string;
  /** Human-readable error message. */
  message: string;
  /** Whether evaluation succeeded (always `false` for `MathError`). */
  ok: false;
}

export type MathOutcome = MathResult | MathError;

/** A single history entry (most recent first). */
export interface MathHistoryEntry {
  expression: string;
  result: number;
  /** ISO timestamp of evaluation. */
  at: string;
}

/* -------------------------------------------------------------------------- */
/* Lazy-loaded expr-eval module cache                                          */
/* -------------------------------------------------------------------------- */

type ExprEvalModule = typeof import('expr-eval');

let exprEvalPromise: Promise<ExprEvalModule> | null = null;

/**
 * Lazily import the `expr-eval` module. The import is cached so repeated calls
 * share a single promise (and a single Vite chunk download, ~15 KB).
 */
export function loadExprEval(): Promise<ExprEvalModule> {
  if (!exprEvalPromise) {
    exprEvalPromise = import('expr-eval');
  }
  return exprEvalPromise;
}

/**
 * Reset the cached `expr-eval` promise. Exposed for unit tests so each test
 * can simulate a fresh load.
 */
export function _resetExprEvalCache(): void {
  exprEvalPromise = null;
}

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Evaluate a mathematical expression string.
 *
 * - Empty/whitespace input → returns a `MathError` with a friendly message
 *   (the caller decides whether to surface it or show an empty state).
 * - Otherwise the expression is parsed and evaluated by `expr-eval`. The
 *   parser supports `+ - * / ^ %`, parentheses, the functions listed in the
 *   module docstring, and the constants `pi` and `e`.
 *
 * Throws are caught and converted into a `MathError` return value, so this
 * function never throws for malformed input.
 */
export async function evaluateExpression(input: string): Promise<MathOutcome> {
  if (typeof input !== 'string') {
    return {
      expression: '',
      message: 'Input must be a string.',
      ok: false,
    };
  }
  const expression = input.trim();
  if (expression.length === 0) {
    return {
      expression: '',
      message: 'Enter an expression to evaluate.',
      ok: false,
    };
  }

  const mod = await loadExprEval();
  const Parser = mod.Parser;
  try {
    // Use a permissive Parser: enable all built-in operators and functions.
    // `expr-eval` defaults already include everything we need, but we
    // construct an instance so future option tweaks are localised.
    const parser = new Parser({
      allowMemberAccess: false,
      operators: {
        add: true,
        subtract: true,
        multiply: true,
        divide: true,
        power: true,
        remainder: true,
        factorial: true,
        sin: true,
        cos: true,
        tan: true,
        asin: true,
        acos: true,
        atan: true,
        sinh: true,
        cosh: true,
        tanh: true,
        asinh: true,
        acosh: true,
        atanh: true,
        sqrt: true,
        log: true,
        ln: true,
        lg: true,
        log10: true,
        log2: true,
        abs: true,
        ceil: true,
        floor: true,
        round: true,
        trunc: true,
        exp: true,
        cbrt: true,
        expm1: true,
        log1p: true,
        sign: true,
        min: true,
        max: true,
        random: false,
        in: false,
        assignment: false,
        fndef: false,
        comparison: false,
        concatenate: false,
        conditional: false,
        logical: false,
        length: false,
      },
    });
    // expr-eval exposes constants as `E` and `PI` (uppercase). The spec calls
    // for lowercase `pi` and `e`, so register those as aliases (keeping the
    // uppercase forms available too).
    parser.consts.pi = Math.PI;
    parser.consts.e = Math.E;
    // expr-eval's built-in `log` is the natural logarithm (same as `ln`). The
    // spec lists `log` and `ln` as distinct functions, so override `log` to be
    // the base-10 logarithm (matching the conventional math convention where
    // `log` = log10 and `ln` = natural log). `log10`/`log2`/`lg` remain as-is.
    // `log` is registered as a unary operator (not a function), so the override
    // must target `unaryOps`.
    parser.unaryOps.log = Math.log10;
    const value = parser.evaluate(expression);
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return {
        expression,
        message: 'Expression did not evaluate to a finite number.',
        ok: false,
      };
    }
    return { expression, result: value, ok: true };
  } catch (e) {
    return {
      expression,
      message: normaliseError(e),
      ok: false,
    };
  }
}

/**
 * Convert a thrown value into a human-readable error message. `expr-eval`
 * throws `Error` instances with descriptive messages (e.g. "Unexpected end of
 * expression" or "Unknown variable: foo").
 */
export function normaliseError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Format a numeric result for display.
 *
 * - Integers render without a decimal point.
 * - Finite floats render with up to 12 significant digits, trimming trailing
 *   zeros.
 * - `Infinity` / `-Infinity` render as `∞` / `-∞`.
 * - `NaN` renders as `NaN`.
 */
export function formatResult(n: number): string {
  if (Number.isNaN(n)) return 'NaN';
  if (n === Infinity) return '∞';
  if (n === -Infinity) return '-∞';
  if (Number.isInteger(n)) return n.toString();
  // Trim trailing zeros while keeping up to 12 significant digits.
  const fixed = n.toFixed(12);
  return fixed.replace(/\.?0+$/, '');
}

/* -------------------------------------------------------------------------- */
/* History helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Maximum number of history entries retained. */
export const MAX_HISTORY = 50;

/**
 * Insert a new entry at the front of the history list, dropping the oldest
 * entry when the cap is reached. Returns a new array (immutable update).
 */
export function addHistory(
  history: readonly MathHistoryEntry[],
  entry: MathHistoryEntry,
): MathHistoryEntry[] {
  const next = [entry, ...history];
  if (next.length > MAX_HISTORY) {
    next.length = MAX_HISTORY;
  }
  return next;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseMathEvaluatorReturn {
  input: Ref<string>;
  outcome: Ref<MathOutcome | null>;
  loading: Ref<boolean>;
  history: Ref<readonly MathHistoryEntry[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  clearHistory: () => void;
  reuseExpression: (expr: string) => void;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 200;

export function useMathEvaluator(): UseMathEvaluatorReturn {
  const input = ref<string>('');
  const outcome = ref<MathOutcome | null>(null);
  const loading = ref<boolean>(false);
  const history = ref<readonly MathHistoryEntry[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  // Token used to ignore stale async results when the user types quickly.
  let runToken = 0;

  async function run(): Promise<void> {
    const text = input.value;
    if (text.trim().length === 0) {
      outcome.value = null;
      loading.value = false;
      return;
    }
    const token = ++runToken;
    loading.value = true;
    try {
      const r = await evaluateExpression(text);
      if (token !== runToken) return; // a newer run superseded us
      outcome.value = r;
      if (r.ok) {
        history.value = addHistory(history.value, {
          expression: r.expression,
          result: r.result,
          at: new Date().toISOString(),
        });
      }
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

  function clearHistory(): void {
    history.value = [];
  }

  function reuseExpression(expr: string): void {
    input.value = expr;
    recompute();
  }

  watch(input, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.expression === 'string') {
        input.value = p.expression;
      } else if (typeof p.expr === 'string') {
        input.value = p.expr;
      } else if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      } else if (typeof p.evaluate === 'string') {
        input.value = p.evaluate;
      }
    },
  });

  watch(outcome, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    outcome,
    loading,
    history,
    isEmbed,
    embedInput,
    recompute,
    clearHistory,
    reuseExpression,
  };
}
