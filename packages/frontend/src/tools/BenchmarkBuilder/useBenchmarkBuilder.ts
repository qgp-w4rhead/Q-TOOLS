/**
 * useBenchmarkBuilder — composable + pure logic for the benchmark builder tool.
 *
 * Measures the execution time of a user-provided JavaScript code snippet across
 * a configurable number of iterations. Uses `performance.now()` for
 * sub-millisecond timing and reports average, min, max, median, p95, p99,
 * standard deviation, and operations per second.
 *
 * Execution model:
 *
 *   1. **Setup** (optional) — a separate `setupCode` string is compiled into a
 *      function and invoked once with a shared `ctx` object. The setup function
 *      can populate `ctx` with data the benchmark code operates on (e.g.
 *      `ctx.arr = [1, 2, 3]`).
 *   2. **Warmup** — the benchmark code is run `warmup` times without timing so
 *      the JIT can optimise the hot path.
 *   3. **Timed** — the benchmark code is run `iterations` times, each iteration
 *      timed individually with `performance.now()`. Per-iteration samples are
 *      collected for statistical analysis.
 *
 * For large iteration counts (>10 000) the timed loop is chunked: after every
 * `CHUNK_SIZE` iterations the function yields to the event loop via
 * `setTimeout(0)` so the UI stays responsive and the run can be cancelled.
 *
 * **Why `new Function()`?** The acceptance criteria require "Define a code
 * snippet to benchmark" and "No external dependencies". The only built-in way
 * to execute arbitrary user-provided JavaScript without a dependency is
 * `new Function()`. This is a developer tool — the user explicitly types their
 * own code to benchmark. The code is never rendered in the DOM or treated as
 * untrusted input; it is a sandboxed execution context for performance
 * measurement, the standard pattern for any online JS benchmark tool.
 *
 * No external dependencies — `performance.now()` + `new Function()` only.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

/** Inputs to `runBenchmark`. */
export interface BenchmarkInput {
  /** The JavaScript code snippet to benchmark (run per iteration). */
  code: string;
  /** Optional setup code run once before warmup. Receives a shared `ctx`. */
  setupCode?: string;
  /** Number of timed iterations (1 – 10 000 000). */
  iterations: number;
  /** Number of untimed warmup runs (0 – 1 000 000). */
  warmup: number;
  /** Called with progress 0–1 during the timed phase. Optional. */
  onProgress?: (progress: number) => void;
  /** Returns `true` to cancel a running benchmark. Checked between chunks. */
  shouldCancel?: () => boolean;
}

/** Statistical summary of a benchmark run. */
export interface BenchmarkStats {
  /** Number of timed samples collected. */
  count: number;
  /** Minimum per-iteration time in milliseconds. */
  min: number;
  /** Maximum per-iteration time in milliseconds. */
  max: number;
  /** Arithmetic mean per-iteration time in milliseconds. */
  mean: number;
  /** Median per-iteration time in milliseconds. */
  median: number;
  /** 95th percentile per-iteration time in milliseconds. */
  p95: number;
  /** 99th percentile per-iteration time in milliseconds. */
  p99: number;
  /** Sample standard deviation in milliseconds. */
  stdDev: number;
  /** Operations per second (1000 / mean). */
  opsPerSec: number;
  /** Total timed wall-clock duration in milliseconds. */
  totalMs: number;
}

/** Result of a successful benchmark run. */
export interface BenchmarkResult {
  ok: true;
  stats: BenchmarkStats;
  /** The code that was benchmarked. */
  code: string;
  /** The setup code (empty string if none). */
  setupCode: string;
  /** Number of iterations. */
  iterations: number;
  /** Number of warmup runs. */
  warmup: number;
  /** ISO timestamp of the run. */
  at: string;
}

/** Result of a failed benchmark run. */
export interface BenchmarkError {
  ok: false;
  /** Human-readable error message. */
  message: string;
  /** Stage where the error occurred: 'compile' | 'setup' | 'warmup' | 'timed'. */
  stage: BenchmarkStage;
}

export type BenchmarkStage = 'compile' | 'setup' | 'warmup' | 'timed';
export type BenchmarkOutcome = BenchmarkResult | BenchmarkError;

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Iterations per chunk before yielding to the event loop. */
const CHUNK_SIZE = 10_000;

/** Maximum allowed iterations. */
export const MAX_ITERATIONS = 10_000_000;
/** Maximum allowed warmup runs. */
export const MAX_WARMUP = 1_000_000;

/**
 * Parse a string into a positive integer within `[min, max]`. Returns `null`
 * for empty/whitespace, non-integer, out-of-range, or non-finite values.
 */
export function parsePositiveInt(
  input: unknown,
  min: number,
  max: number,
): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < min || input > max) return null;
    return Math.floor(input);
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

/**
 * Format a duration in milliseconds as a compact human-readable string with
 * adaptive units.
 *
 * Examples:
 *   - `0.0001` → `100 ns`
 *   - `0.5` → `500 μs`
 *   - `1.234` → `1.234 ms`
 *   - `45.6` → `45.6 ms`
 *   - `1234` → `1.234 s`
 *   - `0` → `0 ms`
 *   - non-finite → `—`
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms === 0) return '0 ms';
  const abs = Math.abs(ms);
  if (abs < 0.001) return `${(ms * 1_000_000).toFixed(0)} ns`;
  if (abs < 1) return `${(ms * 1000).toFixed(0)} μs`;
  if (abs < 1000) return `${trimZeros(ms.toFixed(3))} ms`;
  return `${trimZeros((ms / 1000).toFixed(3))} s`;
}

/**
 * Format a number with thousands separators and up to 2 decimal places,
 * trimming trailing zeros. Returns `—` for non-finite values.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Number.isInteger(n)) {
    return n.toLocaleString('en-US');
  }
  const fixed = n.toFixed(2);
  const trimmed = trimZeros(fixed);
  const num = Number(trimmed);
  if (Number.isInteger(num)) return num.toLocaleString('en-US');
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Trim trailing zeros from a decimal string, keeping at least one decimal. */
function trimZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

/**
 * Compute the p-th percentile (0–100) from a **sorted** array of samples using
 * linear interpolation between closest ranks (the same method as NumPy's
 * `percentile` with `linear` interpolation).
 *
 * Returns `0` for an empty array.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] ?? 0;
  const clamped = Math.min(100, Math.max(0, p));
  const rank = (clamped / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loVal = sorted[lo] ?? 0;
  if (lo === hi) return loVal;
  const hiVal = sorted[hi] ?? 0;
  const frac = rank - lo;
  return loVal + (hiVal - loVal) * frac;
}

/**
 * Compute statistical summary from an array of per-iteration samples (in ms).
 * The samples array is sorted in place — pass a copy if you need the original
 * order preserved.
 */
export function computeStats(samples: number[]): BenchmarkStats {
  const count = samples.length;
  if (count === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      opsPerSec: 0,
      totalMs: 0,
    };
  }
  samples.sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < count; i++) sum += samples[i] ?? 0;
  const mean = sum / count;
  const min = samples[0] ?? 0;
  const max = samples[count - 1] ?? 0;
  const median = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const p99 = percentile(samples, 99);
  // Sample standard deviation.
  let varianceSum = 0;
  for (let i = 0; i < count; i++) {
    const diff = (samples[i] ?? 0) - mean;
    varianceSum += diff * diff;
  }
  const stdDev = count > 1 ? Math.sqrt(varianceSum / (count - 1)) : 0;
  const opsPerSec = mean > 0 ? 1000 / mean : 0;
  return {
    count,
    min,
    max,
    mean,
    median,
    p95,
    p99,
    stdDev,
    opsPerSec,
    totalMs: sum,
  };
}

/**
 * Yield to the event loop. Uses `setTimeout(0)` in browsers and Node. Returns
 * a promise that resolves on the next tick.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run a benchmark.
 *
 * Compiles `code` (and optional `setupCode`) into functions via `new Function()`.
 * The setup function receives a shared `ctx` object and runs once. The benchmark
 * function also receives `ctx` and runs `warmup` + `iterations` times.
 *
 * For `iterations > CHUNK_SIZE` the timed loop is chunked: after every
 * `CHUNK_SIZE` iterations the function awaits `yieldToEventLoop()` so the UI
 * stays responsive and `shouldCancel` can be checked.
 *
 * Returns a `BenchmarkOutcome` — either a `BenchmarkResult` with stats or a
 * `BenchmarkError` with a stage tag. Never throws for user-code errors.
 */
export async function runBenchmark(
  input: BenchmarkInput,
): Promise<BenchmarkOutcome> {
  const {
    code,
    setupCode = '',
    iterations,
    warmup,
    onProgress,
    shouldCancel,
  } = input;

  const trimmedCode = typeof code === 'string' ? code.trim() : '';
  if (trimmedCode.length === 0) {
    return {
      ok: false,
      message: 'Enter a code snippet to benchmark.',
      stage: 'compile',
    };
  }
  if (!Number.isFinite(iterations) || iterations < 1) {
    return {
      ok: false,
      message: 'Iterations must be at least 1.',
      stage: 'compile',
    };
  }
  if (!Number.isFinite(warmup) || warmup < 0) {
    return {
      ok: false,
      message: 'Warmup must be 0 or greater.',
      stage: 'compile',
    };
  }

  // Compile the benchmark function and (optional) setup function.
  let benchFn: (ctx: Record<string, unknown>) => unknown;
  let setupFn: ((ctx: Record<string, unknown>) => unknown) | null = null;
  try {
    // The benchmark function receives `ctx` and can use/modify it.
    benchFn = new Function('ctx', `"use strict";\n${trimmedCode}`) as (
      ctx: Record<string, unknown>,
    ) => unknown;
    const trimmedSetup = typeof setupCode === 'string' ? setupCode.trim() : '';
    if (trimmedSetup.length > 0) {
      setupFn = new Function('ctx', `"use strict";\n${trimmedSetup}`) as (
        ctx: Record<string, unknown>,
      ) => unknown;
    }
  } catch (e) {
    return {
      ok: false,
      message: `Compile error: ${normaliseError(e)}`,
      stage: 'compile',
    };
  }

  const ctx: Record<string, unknown> = {};

  // Run setup once.
  if (setupFn) {
    try {
      setupFn(ctx);
    } catch (e) {
      return {
        ok: false,
        message: `Setup error: ${normaliseError(e)}`,
        stage: 'setup',
      };
    }
  }

  // Warmup (untimed).
  try {
    for (let i = 0; i < warmup; i++) {
      benchFn(ctx);
      if (shouldCancel && shouldCancel()) {
        return {
          ok: false,
          message: 'Benchmark cancelled.',
          stage: 'warmup',
        };
      }
    }
  } catch (e) {
    return {
      ok: false,
      message: `Warmup error: ${normaliseError(e)}`,
      stage: 'warmup',
    };
  }

  // Timed phase.
  const samples: number[] = new Array(iterations);
  try {
    for (let i = 0; i < iterations; i++) {
      const t0 = performanceNow();
      benchFn(ctx);
      samples[i] = performanceNow() - t0;

      // Chunk: yield to event loop and check cancellation.
      if (
        iterations > CHUNK_SIZE &&
        (i + 1) % CHUNK_SIZE === 0
      ) {
        if (shouldCancel && shouldCancel()) {
          return {
            ok: false,
            message: 'Benchmark cancelled.',
            stage: 'timed',
          };
        }
        if (onProgress) onProgress((i + 1) / iterations);
        await yieldToEventLoop();
      }
    }
  } catch (e) {
    return {
      ok: false,
      message: `Runtime error: ${normaliseError(e)}`,
      stage: 'timed',
    };
  }

  if (onProgress) onProgress(1);

  const stats = computeStats(samples);
  return {
    ok: true,
    stats,
    code: trimmedCode,
    setupCode:
      typeof setupCode === 'string' ? setupCode.trim() : '',
    iterations,
    warmup,
    at: new Date().toISOString(),
  };
}

/**
 * Get a monotonic high-resolution timestamp in milliseconds. Falls back to
 * `Date.now()` when `performance` is unavailable.
 */
function performanceNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/** Convert a thrown value into a human-readable error message. */
export function normaliseError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/* -------------------------------------------------------------------------- */
/* Preset examples                                                            */
/* -------------------------------------------------------------------------- */

export interface BenchmarkPreset {
  /** Display name. */
  name: string;
  /** Setup code (may be empty). */
  setup: string;
  /** Benchmark code. */
  code: string;
  /** Recommended iterations. */
  iterations: number;
  /** Recommended warmup. */
  warmup: number;
}

/** Built-in preset examples the user can load with one click. */
export const PRESETS: readonly BenchmarkPreset[] = [
  {
    name: 'Array.map (square)',
    setup: 'ctx.arr = Array.from({ length: 1000 }, (_, i) => i);',
    code: 'ctx.arr.map(x => x * x);',
    iterations: 10_000,
    warmup: 1_000,
  },
  {
    name: 'JSON.parse / stringify',
    setup:
      'ctx.obj = { a: 1, b: "hello", c: [1, 2, 3], d: { nested: true } };\nctx.json = JSON.stringify(ctx.obj);',
    code: 'JSON.parse(ctx.json);',
    iterations: 50_000,
    warmup: 5_000,
  },
  {
    name: 'Regex test',
    setup:
      'ctx.re = /^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$/i;\nctx.email = "user@example.com";',
    code: 'ctx.re.test(ctx.email);',
    iterations: 100_000,
    warmup: 10_000,
  },
  {
    name: 'Math.sqrt',
    setup: '',
    code: 'Math.sqrt(123456.789);',
    iterations: 1_000_000,
    warmup: 50_000,
  },
  {
    name: 'String split',
    setup: 'ctx.s = "the quick brown fox jumps over the lazy dog";',
    code: 'ctx.s.split(" ");',
    iterations: 100_000,
    warmup: 10_000,
  },
  {
    name: 'Object spread',
    setup: 'ctx.base = { a: 1, b: 2, c: 3 };',
    code: '{ ...ctx.base, d: 4 };',
    iterations: 100_000,
    warmup: 10_000,
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseBenchmarkBuilderReturn {
  code: Ref<string>;
  setupCode: Ref<string>;
  iterations: Ref<string>;
  warmup: Ref<string>;
  running: Ref<boolean>;
  progress: Ref<number>;
  outcome: Ref<BenchmarkOutcome | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  run: () => void;
  cancel: () => void;
  reset: () => void;
  loadPreset: (preset: BenchmarkPreset) => void;
}

export function useBenchmarkBuilder(): UseBenchmarkBuilderReturn {
  const code = ref<string>('');
  const setupCode = ref<string>('');
  const iterations = ref<string>('1000');
  const warmup = ref<string>('100');
  const running = ref<boolean>(false);
  const progress = ref<number>(0);
  const outcome = ref<BenchmarkOutcome | null>(null);

  let cancelFlag = false;

  async function run(): Promise<void> {
    if (running.value) return;
    const iterNum = parsePositiveInt(iterations.value, 1, MAX_ITERATIONS);
    const warmupNum = parsePositiveInt(warmup.value, 0, MAX_WARMUP);
    if (iterNum === null) {
      outcome.value = {
        ok: false,
        message: `Iterations must be an integer between 1 and ${MAX_ITERATIONS.toLocaleString('en-US')}.`,
        stage: 'compile',
      };
      return;
    }
    if (warmupNum === null) {
      outcome.value = {
        ok: false,
        message: `Warmup must be an integer between 0 and ${MAX_WARMUP.toLocaleString('en-US')}.`,
        stage: 'compile',
      };
      return;
    }

    running.value = true;
    progress.value = 0;
    cancelFlag = false;
    outcome.value = null;

    const result = await runBenchmark({
      code: code.value,
      setupCode: setupCode.value,
      iterations: iterNum,
      warmup: warmupNum,
      onProgress: (p) => {
        progress.value = p;
      },
      shouldCancel: () => cancelFlag,
    });

    running.value = false;
    progress.value = 1;
    outcome.value = result;
  }

  function cancel(): void {
    cancelFlag = true;
  }

  function reset(): void {
    cancelFlag = true;
    running.value = false;
    progress.value = 0;
    outcome.value = null;
  }

  function loadPreset(preset: BenchmarkPreset): void {
    code.value = preset.code;
    setupCode.value = preset.setup;
    iterations.value = String(preset.iterations);
    warmup.value = String(preset.warmup);
    outcome.value = null;
    progress.value = 0;
  }

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.code === 'string') {
        code.value = p.code;
      } else if (typeof p.snippet === 'string') {
        code.value = p.snippet;
      } else if (typeof p.input === 'string') {
        code.value = p.input;
      } else if (typeof p.value === 'string') {
        code.value = p.value;
      }
      if (typeof p.setup === 'string') {
        setupCode.value = p.setup;
      } else if (typeof p.setupCode === 'string') {
        setupCode.value = p.setupCode;
      }
      if (typeof p.iterations === 'string' || typeof p.iterations === 'number') {
        iterations.value = String(p.iterations);
      }
      if (typeof p.warmup === 'string' || typeof p.warmup === 'number') {
        warmup.value = String(p.warmup);
      }
      // Action triggers.
      const action =
        typeof p.action === 'string'
          ? p.action
          : typeof p.run === 'string'
            ? p.run
            : null;
      if (action === 'run' || p.run === true) {
        void run();
      } else if (action === 'cancel' || action === 'stop' || p.stop === true) {
        cancel();
      } else if (action === 'reset' || p.reset === true) {
        reset();
      }
    },
  });

  watch(outcome, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  // Also send live progress / running state in embed mode.
  watch([running, progress], () => {
    if (isEmbed.value) {
      sendOutput({
        running: running.value,
        progress: progress.value,
        ...(outcome.value ?? {}),
      });
    }
  });

  return {
    code,
    setupCode,
    iterations,
    warmup,
    running,
    progress,
    outcome,
    isEmbed,
    embedInput,
    run,
    cancel,
    reset,
    loadPreset,
  };
}
