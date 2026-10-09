<script setup lang="ts">
/**
 * Chronometer - precision stopwatch with lap timing.
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
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useChronometer,
  formatStopwatch,
  formatLapDelta,
} from './useChronometer';

const { t } = useI18n();
const U = 'tools.chronometer.ui.';

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
  if (running.value) return t(U + 'btnPause');
  if (paused.value) return t(U + 'btnResume');
  return t(U + 'btnStart');
});

function onPrimary(): void {
  if (running.value) pause();
  else if (paused.value) resume();
  else start();
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton
          :title="t(U + 'resetTitle')"
          :disabled="stopped"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:12px;background:var(--qt-bg);border:1px solid var(--qt-border);border-radius:var(--qt-radius);padding:18px 22px;flex-wrap:nowrap">
        <Timer :size="18" style="color:var(--qt-muted);flex-shrink:0" />
        <div class="chrono__display" :class="{ 'chrono__display--running': running }">
          {{ display }}
        </div>
      </div>

      <div class="qt-row">
        <ToolButton variant="primary" @click="onPrimary">
          <component :is="running ? Pause : Play" :size="15" />
          <span>{{ primaryLabel }}</span>
        </ToolButton>
        <ToolButton
          :disabled="!canLap"
          :title="t(U + 'lapTitle')"
          @click="lap"
        >
          <Flag :size="14" />
          <span>{{ t(U + 'btnLap') }}</span>
        </ToolButton>
        <ToolButton
          :disabled="stopped"
          :title="t(U + 'stopTitle')"
          @click="stop"
        >
          <Square :size="14" />
          <span>{{ t(U + 'btnStop') }}</span>
        </ToolButton>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="
        hasLaps
          ? t(laps.length === 1 ? U + 'descLapsOne' : U + 'descLaps', { n: laps.length })
          : t(U + 'descEmpty')
      "
    >
      <ToolAlert v-if="!hasLaps" kind="empty">
        {{ t(U + 'alertEmpty') }}
      </ToolAlert>
      <template v-else>
        <div class="chrono__laps">
          <div class="chrono__lap chrono__lap--head">
            <span>#</span>
            <span>{{ t(U + 'colSplit') }}</span>
            <span>{{ t(U + 'colTotal') }}</span>
          </div>
          <div
            v-for="(l, i) in laps"
            :key="l.index"
            class="chrono__lap"
            :class="lapClass(i)"
          >
            <span style="color:var(--qt-muted);font-weight:600">#{{ l.index }}</span>
            <span class="chrono__lap-split">{{ formatLapDelta(l.splitMs) }}</span>
            <span style="color:var(--qt-text)">{{ formatStopwatch(l.totalMs) }}</span>
          </div>
        </div>
        <div class="qt-row qt-row--end" style="margin-top:10px">
          <CopyButton :text="lapsText" :label="t(U + 'copyLaps')" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Hero timer readout — large mono digits; accent while running. */
.chrono__display {
  font-family: var(--qt-font-mono);
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

/* Lap table — fixed-column grid rows with head + best/worst highlight. */
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
  font-family: var(--qt-font-mono);
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
.chrono__lap-split {
  color: var(--qt-text);
  font-weight: 600;
}
</style>
