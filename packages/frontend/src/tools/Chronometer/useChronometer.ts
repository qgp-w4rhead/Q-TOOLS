/**
 * useChronometer — composable + pure logic for the chronometer (stopwatch) tool.
 *
 * A precision stopwatch with lap timing. Elapsed time is measured with
 * `performance.now()` (monotonic, sub-millisecond) and the display is refreshed
 * via `requestAnimationFrame` for smooth 60fps updates.
 *
 * State machine:
 *
 *   stopped ──start──▶ running ──pause──▶ paused ──resume──▶ running
 *     ▲                  │                  │                   │
 *     │                  └──stop / reset────┴───────────────────┘
 *
 *   - `start()`  — begin timing from 0 (or resume from current elapsed if
 *                  stopped with elapsed > 0).
 *   - `pause()`  — freeze the display, keep elapsed accumulated.
 *   - `resume()` — continue from the paused elapsed.
 *   - `lap()`    — record the current elapsed as a lap; split = lap.total -
 *                  previous lap.total.
 *   - `reset()`  — stop, zero elapsed, clear laps.
 *
 * No external dependencies — `performance.now()` + `requestAnimationFrame` only.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

/** A single recorded lap. */
export interface Lap {
  /** 1-based lap index. */
  index: number;
  /** Total elapsed milliseconds at the moment the lap was recorded. */
  totalMs: number;
  /** Split milliseconds between this lap and the previous lap. */
  splitMs: number;
}

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Format an elapsed duration in milliseconds as `HH:MM:SS.mmm`.
 *
 * Hours are zero-padded to 2 digits but grow unbounded for durations longer
 * than 24 hours (e.g. `27:30:45.123`). Negative or non-finite values render
 * as `00:00:00.000`.
 *
 * Examples:
 *   - `0` → `00:00:00.000`
 *   - `1234` → `00:00:01.234`
 *   - `65432` → `00:01:05.432`
 *   - `3_723_456_789` → `01:03:23.456.789`? No — `103:23:45.789`
 */
export function formatStopwatch(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00:00.000';
  const totalMs = Math.floor(ms);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Format a lap split duration. Same format as `formatStopwatch` but typically
 * used for shorter durations. Falls back to `formatStopwatch` semantics.
 */
export function formatLapDelta(ms: number): string {
  return formatStopwatch(ms);
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + rAF loop + embed integration                  */
/* -------------------------------------------------------------------------- */

export interface UseChronometerReturn {
  /** `true` when the stopwatch is actively ticking. */
  running: Ref<boolean>;
  /** `true` when paused (was running, now frozen with elapsed > 0). */
  paused: Ref<boolean>;
  /** `true` when stopped and elapsed is 0 (no run started or reset). */
  stopped: Ref<boolean>;
  /** Current elapsed milliseconds (live-updating while running). */
  elapsedMs: Ref<number>;
  /** Recorded laps, newest last. */
  laps: Ref<Lap[]>;
  /** Begin or resume timing. */
  start: () => void;
  /** Pause timing (freeze display). */
  pause: () => void;
  /** Resume timing after a pause. */
  resume: () => void;
  /** Stop timing and keep elapsed (alias for pause when running). */
  stop: () => void;
  /** Record a lap at the current elapsed time. */
  lap: () => void;
  /** Stop, zero elapsed, and clear all laps. */
  reset: () => void;
  /** Whether a lap can be recorded (running or paused with elapsed > 0). */
  canLap: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

/**
 * Get a monotonic high-resolution timestamp in milliseconds.
 *
 * Falls back to `Date.now()` when `performance` is unavailable (very old
 * browsers or non-browser environments).
 */
function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function useChronometer(): UseChronometerReturn {
  const running = ref<boolean>(false);
  const paused = ref<boolean>(false);
  const elapsedMs = ref<number>(0);
  const laps = ref<Lap[]>([]);

  /** Timestamp captured at the start of the current run segment. The elapsed
   * time accumulated before this segment is stored in `accumulatedMs`. */
  let segmentStart = 0;
  /** Elapsed time accumulated across previous run segments (before the current
   * `segmentStart`). The live elapsed is `accumulatedMs + (now - segmentStart)`. */
  let accumulatedMs = 0;
  /** The `requestAnimationFrame` handle for the active loop, or 0 when idle. */
  let rafHandle = 0;

  const canLap = ref<boolean>(false);

  /** Read the live elapsed time without mutating reactive state. */
  function liveElapsed(): number {
    if (!running.value) return elapsedMs.value;
    return accumulatedMs + (nowMs() - segmentStart);
  }

  /** Synchronise `elapsedMs` with the live elapsed time. Called from rAF. */
  function syncElapsed(): void {
    elapsedMs.value = liveElapsed();
  }

  /** Start the requestAnimationFrame loop. */
  function startLoop(): void {
    if (rafHandle !== 0) return;
    const tick = (): void => {
      syncElapsed();
      rafHandle = requestAnimationFrame(tick);
    };
    rafHandle = requestAnimationFrame(tick);
  }

  /** Stop the requestAnimationFrame loop. */
  function stopLoop(): void {
    if (rafHandle !== 0) {
      cancelAnimationFrame(rafHandle);
      rafHandle = 0;
    }
  }

  function start(): void {
    if (running.value) return;
    segmentStart = nowMs();
    running.value = true;
    paused.value = false;
    startLoop();
  }

  function pause(): void {
    if (!running.value) return;
    // Freeze the accumulated elapsed.
    accumulatedMs = liveElapsed();
    stopLoop();
    running.value = false;
    paused.value = true;
    elapsedMs.value = accumulatedMs;
  }

  function resume(): void {
    if (running.value) return;
    if (!paused.value && elapsedMs.value === 0) {
      // Nothing to resume — start fresh.
      start();
      return;
    }
    segmentStart = nowMs();
    running.value = true;
    paused.value = false;
    startLoop();
  }

  /** Stop is an alias for pause when running; otherwise a no-op. */
  function stop(): void {
    if (running.value) pause();
  }

  function lap(): void {
    if (!running.value && !paused.value) return;
    if (elapsedMs.value <= 0 && laps.value.length === 0) return;
    const total = liveElapsed();
    const prevTotal = laps.value.length > 0 ? (laps.value[laps.value.length - 1]?.totalMs ?? 0) : 0;
    const split = Math.max(0, total - prevTotal);
    laps.value = [
      ...laps.value,
      { index: laps.value.length + 1, totalMs: total, splitMs: split },
    ];
  }

  function reset(): void {
    stopLoop();
    running.value = false;
    paused.value = false;
    accumulatedMs = 0;
    segmentStart = 0;
    elapsedMs.value = 0;
    laps.value = [];
  }

  // Derive `canLap` and `stopped` from the state.
  watch(
    [running, paused, elapsedMs],
    () => {
      canLap.value = running.value || (paused.value && elapsedMs.value > 0);
    },
    { immediate: true },
  );

  const stopped = ref<boolean>(true);
  watch(
    [running, paused, elapsedMs],
    () => {
      stopped.value = !running.value && !paused.value && elapsedMs.value === 0;
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stopLoop();
  });

  /* ---- Embed PostMessage integration ---- */
  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      const action =
        typeof p.action === 'string'
          ? p.action
          : typeof p.input === 'string'
            ? p.input
            : typeof p.value === 'string'
              ? p.value
              : '';
      switch (action.toLowerCase()) {
        case 'start':
          start();
          break;
        case 'pause':
          pause();
          break;
        case 'resume':
          resume();
          break;
        case 'stop':
          stop();
          break;
        case 'reset':
          reset();
          break;
        case 'lap':
          lap();
          break;
        default:
          break;
      }
      // Also accept explicit boolean flags.
      if (p.start === true) start();
      if (p.stop === true) stop();
      if (p.pause === true) pause();
      if (p.resume === true) resume();
      if (p.reset === true) reset();
      if (p.lap === true) lap();
    },
  });

  // Send output snapshots whenever state changes.
  watch(
    [running, paused, elapsedMs, laps],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        running: running.value,
        paused: paused.value,
        elapsedMs: elapsedMs.value,
        elapsed: formatStopwatch(elapsedMs.value),
        laps: laps.value.map((l) => ({
          index: l.index,
          totalMs: l.totalMs,
          splitMs: l.splitMs,
          total: formatStopwatch(l.totalMs),
          split: formatStopwatch(l.splitMs),
        })),
      });
    },
    { deep: true },
  );

  return {
    running,
    paused,
    stopped,
    elapsedMs,
    laps,
    canLap,
    start,
    pause,
    resume,
    stop,
    lap,
    reset,
    isEmbed,
    embedInput,
  };
}
