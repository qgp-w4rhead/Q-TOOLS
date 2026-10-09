/**
 * Shared helpers for the timeline components (TrimTimeline, ClipTimeline).
 *
 * Pure - no Vue dependency.
 */
import { formatDuration } from '@/utils/media';

export interface TimelineTick {
  /** Position in seconds. */
  t: number;
  /** Position as a 0-100 percentage of the duration. */
  pct: number;
  /** Human-readable label (`M:SS` / `H:MM:SS`). */
  label: string;
}

/** Candidate tick intervals (seconds) - first one giving ≤ 8 ticks wins. */
const TICK_STEPS = [
  0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
];

/**
 * Compute ruler ticks for a timeline of the given duration. Always includes
 * a tick at 0 and at the exact end of the media.
 */
export function computeTicks(duration: number): TimelineTick[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const step = TICK_STEPS.find((s) => duration / s <= 8) ?? 3600;
  const out: TimelineTick[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) {
    const c = Math.min(t, duration);
    out.push({ t: c, pct: (c / duration) * 100, label: formatDuration(c) });
    if (c >= duration) break;
  }
  // Always show the exact end of the media.
  if (out.length && duration - out[out.length - 1]!.t > step * 0.25) {
    out.push({ t: duration, pct: 100, label: formatDuration(duration) });
  }
  return out;
}
