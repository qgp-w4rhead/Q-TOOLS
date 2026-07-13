<script setup lang="ts">
/**
 * Chronometer — precision stopwatch with lap timing.
 *
 * Elapsed time is measured with `performance.now()` and the display refreshes
 * via `requestAnimationFrame` for smooth 60fps updates. Supports
 * start/pause/resume/reset and lap recording with best/worst split highlighting.
 *
 * Works in embed mode: receives `input` PostMessages with `action` (start,
 * pause, resume, stop, reset, lap) and sends `output` PostMessages with the
 * live elapsed time and laps.
 */
import { Flag, Pause, Play, RotateCcw, Square, Timer } from 'lucide-vue-next';
import { computed } from 'vue';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useChronometer,
  formatStopwatch,
  formatLapDelta,
} from './useChronometer';

const {
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
} = useChronometer();

const display = computed(() => formatStopwatch(elapsedMs.value));

/** Determine the best (shortest) and worst (longest) lap splits for
 * highlighting. Only meaningful when there are at least 2 laps. */
const bestLapIndex = computed(() => {
  if (laps.value.length < 2) return -1;
  let best = 0;
  for (let i = 1; i < laps.value.length; i++) {
    if ((laps.value[i]?.splitMs ?? 0) < (laps.value[best]?.splitMs ?? 0)) best = i;
  }
  return best;
});

const worstLapIndex = computed(() => {
  if (laps.value.length < 2) return -1;
  let worst = 0;
  for (let i = 1; i < laps.value.length; i++) {
    if ((laps.value[i]?.splitMs ?? 0) > (laps.value[worst]?.splitMs ?? 0)) worst = i;
  }
  return worst;
});

function lapClass(i: number): string {
  if (i === bestLapIndex.value) return 'chrono__lap--best';
  if (i === worstLapIndex.value) return 'chrono__lap--worst';
  return '';
}

const lapsText = computed(() =>
  laps.value
    .map(
      (l) =>
        `#${l.index}\t${formatLapDelta(l.splitMs)}\t${formatStopwatch(l.totalMs)}`,
    )
    .join('\n'),
);

const hasLaps = computed(() => laps.value.length > 0);

/** The primary action button label/icon depending on current state. */
const primaryLabel = computed(() => {
  if (running.value) return 'Pause';
  if (paused.value) return 'Resume';
  return 'Start';
});

function onPrimary(): void {
  if (running.value) pause();
  else if (paused.value) resume();
  else start();
}
</script>

<template>
  <div class="chrono">
    <ToolInput
      title="Chronometer"
      description="Precision stopwatch with lap timing. Uses performance.now() for sub-millisecond accuracy."
    >
      <template #actions>
        <button
          type="button"
          class="chrono__btn chrono__btn--ghost"
          title="Reset stopwatch and clear laps"
          :disabled="stopped"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <div class="chrono__display-wrap">
        <Timer :size="18" class="chrono__display-icon" />
        <div class="chrono__display" :class="{ 'chrono__display--running': running }">
          {{ display }}
        </div>
      </div>

      <div class="chrono__controls">
        <button
          type="button"
          class="chrono__btn chrono__btn--primary"
          @click="onPrimary"
        >
          <component :is="running ? Pause : Play" :size="15" />
          <span>{{ primaryLabel }}</span>
        </button>
        <button
          type="button"
          class="chrono__btn chrono__btn--ghost"
          :disabled="!canLap"
          title="Record a lap split"
          @click="lap"
        >
          <Flag :size="14" />
          <span>Lap</span>
        </button>
        <button
          type="button"
          class="chrono__btn chrono__btn--ghost"
          :disabled="stopped"
          title="Stop and freeze the timer"
          @click="stop"
        >
          <Square :size="14" />
          <span>Stop</span>
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      title="Laps"
      :description="
        hasLaps
          ? `${laps.length} lap${laps.length === 1 ? '' : 's'} recorded.`
          : 'No laps recorded yet. Press Lap while the timer is running.'
      "
    >
      <p v-if="!hasLaps" class="chrono__empty">
        No laps recorded yet. Press Lap while the timer is running.
      </p>
      <template v-else>
        <div class="chrono__laps">
          <div class="chrono__lap chrono__lap--head">
            <span>#</span>
            <span>Split</span>
            <span>Total</span>
          </div>
          <div
            v-for="(l, i) in laps"
            :key="l.index"
            class="chrono__lap"
            :class="lapClass(i)"
          >
            <span class="chrono__lap-index">#{{ l.index }}</span>
            <span class="chrono__lap-split">{{ formatLapDelta(l.splitMs) }}</span>
            <span class="chrono__lap-total">{{ formatStopwatch(l.totalMs) }}</span>
          </div>
        </div>
        <div class="chrono__laps-actions">
          <CopyButton :text="lapsText" label="Copy laps" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.chrono {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.chrono__display-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  padding: 18px 22px;
}
.chrono__display-icon {
  color: var(--qt-muted);
  flex-shrink: 0;
}
.chrono__display {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  flex: 1;
  text-align: center;
}
.chrono__display--running {
  color: var(--qt-accent);
}
.chrono__controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.chrono__btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: var(--qt-radius-sm);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  padding: 9px 16px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.chrono__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.chrono__btn--primary {
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  color: var(--qt-bg);
}
.chrono__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}
.chrono__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.chrono__btn--ghost:hover:not(:disabled) {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.chrono__btn:active:not(:disabled) {
  transform: translateY(1px);
}
.chrono__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.chrono__laps {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.chrono__lap {
  display: grid;
  grid-template-columns: 56px 1fr 1fr;
  gap: 10px;
  padding: 8px 12px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid var(--qt-border);
  align-items: center;
}
.chrono__lap:last-child {
  border-bottom: none;
}
.chrono__lap--head {
  background: var(--qt-bg);
  color: var(--qt-muted);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  font-family: inherit;
}
.chrono__lap--best {
  background: oklch(0.62 0.17 150 / 0.12);
}
.chrono__lap--best .chrono__lap-split {
  color: oklch(0.62 0.17 150);
  font-weight: 700;
}
.chrono__lap--worst {
  background: oklch(0.62 0.2 25 / 0.1);
}
.chrono__lap--worst .chrono__lap-split {
  color: oklch(0.62 0.2 25);
  font-weight: 700;
}
.chrono__lap-index {
  color: var(--qt-muted);
  font-weight: 600;
}
.chrono__lap-split {
  color: var(--qt-text);
  font-weight: 600;
}
.chrono__lap-total {
  color: var(--qt-text);
}
.chrono__laps-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
