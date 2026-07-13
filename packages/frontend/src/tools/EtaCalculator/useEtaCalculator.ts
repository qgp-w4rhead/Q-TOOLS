/**
 * useEtaCalculator — composable + pure logic for the ETA calculator tool.
 *
 * Estimates the remaining time and completion time for a task given its
 * progress and start time. Two input modes are supported:
 *
 *   - **count** — explicit `current` and `total` values (e.g. 250 of 1000
 *     rows processed). Progress is `current / total`.
 *   - **percent** — a single `percentage` value in [0, 100]. Internally this
 *     is treated as `current = percentage`, `total = 100`.
 *
 * The speed (units per second) is either supplied explicitly or derived from
 * the progress made since the start time:
 *
 *   - explicit speed → `remaining = (total - current) / speed`
 *   - derived speed  → `speed = current / elapsedSec`,
 *                      `remaining = (total - current) / speed`
 *
 * The composable ticks once per second to refresh the elapsed/remaining/
 * completion values live, and wires up the embed PostMessage protocol.
 *
 * No external dependencies — pure arithmetic + `Date` only.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type EtaMode = 'count' | 'percent';

/** Inputs to `computeEta`. All numeric fields are finite numbers. */
export interface EtaInput {
  /** Current progress count (>= 0). For percent mode this is the percentage. */
  current: number;
  /** Total count (> 0). For percent mode this is 100. */
  total: number;
  /** Start time as a Unix epoch millisecond timestamp. */
  startMs: number;
  /** "Now" as a Unix epoch millisecond timestamp (defaults to Date.now()). */
  nowMs?: number;
  /** Optional explicit speed in units per second. */
  speedUnitsPerSec?: number;
}

/** Result of an ETA computation. */
export interface EtaResult {
  /** `true` when the computation succeeded. */
  ok: boolean;
  /** Human-readable message when `ok === false`. */
  message?: string;
  /** Elapsed milliseconds since the start time. */
  elapsedMs: number;
  /** Remaining milliseconds until completion. `0` when already complete. */
  remainingMs: number;
  /** Estimated completion time as a Unix epoch millisecond timestamp. */
  completionMs: number;
  /** Effective speed in units per second (explicit or derived). */
  speed: number;
  /** Progress fraction in [0, 1]. */
  progress: number;
  /** Progress as a percentage in [0, 100]. */
  progressPercent: number;
  /** `true` when the task is fully complete (progress >= 1). */
  complete: boolean;
}

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Parse a string into a finite number. Returns `null` for empty/whitespace,
 * `NaN`, or non-finite values.
 */
export function parseNumericInput(input: unknown): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Clamp a number to the inclusive `[min, max]` range. */
export function clampNumber(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Compute the ETA for a task.
 *
 * Edge cases handled:
 *   - `total <= 0` → error "Total must be greater than zero."
 *   - `current < 0` → treated as 0.
 *   - `current >= total` → complete; remaining = 0, completion = now.
 *   - `nowMs < startMs` → error "Start time is in the future."
 *   - elapsed is 0 and no explicit speed → error "Not enough elapsed time to
 *     derive a speed — enter an explicit speed or wait."
 *   - derived speed is 0 (current is 0) → error "No progress yet — enter an
 *     explicit speed or wait for progress."
 *   - explicit speed <= 0 → error "Speed must be greater than zero."
 */
export function computeEta(input: EtaInput): EtaResult {
  const { total, startMs } = input;
  const current = input.current < 0 ? 0 : input.current;
  const nowMs = input.nowMs ?? Date.now();

  if (!Number.isFinite(total) || total <= 0) {
    return failResult('Total must be greater than zero.', nowMs);
  }
  if (!Number.isFinite(startMs)) {
    return failResult('Start time is invalid.', nowMs);
  }
  if (nowMs < startMs) {
    return failResult('Start time is in the future.', nowMs);
  }

  const elapsedMs = nowMs - startMs;
  const progress = clampNumber(current / total, 0, 1);
  const progressPercent = progress * 100;
  const complete = current >= total;

  if (complete) {
    return {
      ok: true,
      elapsedMs,
      remainingMs: 0,
      completionMs: nowMs,
      speed: 0,
      progress,
      progressPercent,
      complete: true,
    };
  }

  let speed: number;
  if (input.speedUnitsPerSec !== undefined && Number.isFinite(input.speedUnitsPerSec)) {
    if (input.speedUnitsPerSec <= 0) {
      return failResult('Speed must be greater than zero.', nowMs, {
        elapsedMs,
        progress,
        progressPercent,
      });
    }
    speed = input.speedUnitsPerSec;
  } else {
    // Derive speed from progress / elapsed.
    if (current <= 0) {
      return failResult(
        'No progress yet — enter an explicit speed or wait for progress.',
        nowMs,
        { elapsedMs, progress, progressPercent },
      );
    }
    if (elapsedMs <= 0) {
      return failResult(
        'Not enough elapsed time to derive a speed — enter an explicit speed or wait.',
        nowMs,
        { elapsedMs, progress, progressPercent },
      );
    }
    speed = current / (elapsedMs / 1000);
    if (!Number.isFinite(speed) || speed <= 0) {
      return failResult(
        'Derived speed is not valid — enter an explicit speed.',
        nowMs,
        { elapsedMs, progress, progressPercent },
      );
    }
  }

  const remainingUnits = total - current;
  const remainingSec = remainingUnits / speed;
  const remainingMs = remainingSec * 1000;
  const completionMs = nowMs + remainingMs;

  return {
    ok: true,
    elapsedMs,
    remainingMs,
    completionMs,
    speed,
    progress,
    progressPercent,
    complete: false,
  };
}

/** Build a failure `EtaResult` with optional partial fields. */
function failResult(
  message: string,
  nowMs: number,
  partial?: { elapsedMs?: number; progress?: number; progressPercent?: number },
): EtaResult {
  return {
    ok: false,
    message,
    elapsedMs: partial?.elapsedMs ?? 0,
    remainingMs: 0,
    completionMs: nowMs,
    speed: 0,
    progress: partial?.progress ?? 0,
    progressPercent: partial?.progressPercent ?? 0,
    complete: false,
  };
}

/**
 * Format a duration in milliseconds as a compact human-readable string.
 *
 * Examples: `0s`, `45s`, `12m 34s`, `1h 23m`, `1d 4h 30m`.
 * Negative durations render as `—`.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Format a Unix epoch millisecond timestamp as a locale-aware date/time string.
 * Returns `—` for non-finite values.
 */
export function formatDateTime(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

/**
 * Format a speed (units per second) with up to 2 decimal places, trimming
 * trailing zeros. Returns `—` for non-finite or non-positive values.
 */
export function formatSpeed(unitsPerSec: number): string {
  if (!Number.isFinite(unitsPerSec) || unitsPerSec <= 0) return '—';
  const fixed = unitsPerSec.toFixed(2);
  return fixed.replace(/\.?0+$/, '');
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + live tick + embed integration                */
/* -------------------------------------------------------------------------- */

export interface UseEtaCalculatorReturn {
  mode: Ref<EtaMode>;
  current: Ref<string>;
  total: Ref<string>;
  percentage: Ref<string>;
  startInput: Ref<string>;
  speedInput: Ref<string>;
  useExplicitSpeed: Ref<boolean>;
  snapshot: Ref<EtaResult | null>;
  running: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/** Tick interval (ms) for live updates. */
const TICK_MS = 1000;

/**
 * Convert a `datetime-local` input string (`YYYY-MM-DDTHH:mm`) into a Unix
 * epoch millisecond timestamp. Returns `NaN` for empty/invalid input.
 */
function parseDatetimeLocal(value: string): number {
  if (typeof value !== 'string' || value.trim().length === 0) return NaN;
  // `new Date('YYYY-MM-DDTHH:mm')` is parsed as local time in modern browsers.
  const ms = new Date(value).getTime();
  return ms;
}

/** Format a Unix epoch millisecond timestamp as a `datetime-local` string. */
function toDatetimeLocal(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function useEtaCalculator(): UseEtaCalculatorReturn {
  const mode = ref<EtaMode>('count');
  const current = ref<string>('');
  const total = ref<string>('');
  const percentage = ref<string>('');
  const startInput = ref<string>(toDatetimeLocal(Date.now()));
  const speedInput = ref<string>('');
  const useExplicitSpeed = ref<boolean>(false);
  const snapshot = ref<EtaResult | null>(null);
  const running = ref<boolean>(true);

  let tickTimer: ReturnType<typeof setInterval> | undefined;

  /** Compute the current ETA snapshot synchronously. */
  function recompute(): void {
    const startMs = parseDatetimeLocal(startInput.value);
    const nowMs = Date.now();

    let curNum: number | null;
    let totalNum: number | null;
    if (mode.value === 'percent') {
      const pct = parseNumericInput(percentage.value);
      curNum = pct;
      totalNum = 100;
    } else {
      curNum = parseNumericInput(current.value);
      totalNum = parseNumericInput(total.value);
    }

    if (curNum === null || totalNum === null) {
      snapshot.value = null;
      return;
    }

    let speedOpt: number | undefined;
    if (useExplicitSpeed.value) {
      const s = parseNumericInput(speedInput.value);
      if (s !== null) speedOpt = s;
    }

    snapshot.value = computeEta({
      current: curNum,
      total: totalNum,
      startMs,
      nowMs,
      speedUnitsPerSec: speedOpt,
    });
  }

  function start(): void {
    if (tickTimer) clearInterval(tickTimer);
    running.value = true;
    recompute();
    tickTimer = setInterval(() => {
      if (running.value) recompute();
    }, TICK_MS);
  }

  function stop(): void {
    running.value = false;
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = undefined;
    }
  }

  function reset(): void {
    current.value = '';
    total.value = '';
    percentage.value = '';
    speedInput.value = '';
    useExplicitSpeed.value = false;
    startInput.value = toDatetimeLocal(Date.now());
    snapshot.value = null;
    recompute();
  }

  // Recompute synchronously whenever any input changes.
  watch(
    [mode, current, total, percentage, startInput, speedInput, useExplicitSpeed],
    () => {
      recompute();
    },
  );

  start();
  onBeforeUnmount(() => {
    if (tickTimer) clearInterval(tickTimer);
  });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.mode === 'count' || p.mode === 'percent') {
        mode.value = p.mode as EtaMode;
      }
      if (typeof p.current === 'string' || typeof p.current === 'number') {
        current.value = String(p.current);
      }
      if (typeof p.total === 'string' || typeof p.total === 'number') {
        total.value = String(p.total);
      }
      if (
        typeof p.percentage === 'string' ||
        typeof p.percentage === 'number'
      ) {
        percentage.value = String(p.percentage);
      }
      if (
        typeof p.progress === 'string' ||
        typeof p.progress === 'number'
      ) {
        // Treat `progress` as a percentage shorthand.
        percentage.value = String(p.progress);
        if (mode.value !== 'percent') mode.value = 'percent';
      }
      if (typeof p.start === 'string') {
        startInput.value = p.start;
      } else if (typeof p.startTime === 'string') {
        startInput.value = p.startTime;
      } else if (typeof p.startMs === 'number') {
        startInput.value = toDatetimeLocal(p.startMs);
      }
      if (typeof p.speed === 'string' || typeof p.speed === 'number') {
        speedInput.value = String(p.speed);
        useExplicitSpeed.value = true;
      }
    },
  });

  watch(snapshot, (s) => {
    if (isEmbed.value) {
      sendOutput(s ?? {});
    }
  });

  return {
    mode,
    current,
    total,
    percentage,
    startInput,
    speedInput,
    useExplicitSpeed,
    snapshot,
    running,
    isEmbed,
    embedInput,
    start,
    stop,
    reset,
  };
}

/** Exposed for unit tests so they can format/parse datetime-local values. */
export const _datetimeLocal = { parseDatetimeLocal, toDatetimeLocal };
