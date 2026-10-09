<script setup lang="ts">
/**
 * EtaCalculator - estimate remaining time and completion time for a task.
 *
 * Two input modes:
 *   - **count** - current + total values (e.g. 250 of 1000 rows).
 *   - **percent** - a single percentage in [0, 100].
 *
 * The speed (units/sec) is either supplied explicitly or derived from the
 * progress made since the start time. The tool ticks once per second to
 * refresh the elapsed/remaining/completion values live.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the fields
 * and sends `output` PostMessages whenever the snapshot changes.
 */
import {
  Clock,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Timer,
  TrendingUp,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import ResultRow from '@/components/ResultRow.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useEtaCalculator,
  formatDuration,
  formatDateTime,
  formatSpeed,
  type EtaMode,
} from './useEtaCalculator';

const {
  mode,
  current,
  total,
  percentage,
  startInput,
  speedInput,
  useExplicitSpeed,
  snapshot,
  running,
  start,
  stop,
  reset,
} = useEtaCalculator();

const elapsedText = computed(() =>
  snapshot.value ? formatDuration(snapshot.value.elapsedMs) : '-',
);
const remainingText = computed(() =>
  snapshot.value ? formatDuration(snapshot.value.remainingMs) : '-',
);
const completionText = computed(() =>
  snapshot.value ? formatDateTime(snapshot.value.completionMs) : '-',
);
const speedText = computed(() =>
  snapshot.value ? formatSpeed(snapshot.value.speed) : '-',
);
const progressPercent = computed(() =>
  snapshot.value
    ? `${snapshot.value.progressPercent.toFixed(1)}%`
    : '-',
);

const hasError = computed(
  () => snapshot.value !== null && !snapshot.value.ok,
);
const isComplete = computed(
  () => snapshot.value !== null && snapshot.value.ok && snapshot.value.complete,
);
const progressBarWidth = computed(() =>
  snapshot.value ? `${Math.min(100, Math.max(0, snapshot.value.progressPercent)).toFixed(2)}%` : '0%',
);

const { t } = useI18n();
const U = 'tools.eta-calculator.ui.';

const modeOptions = computed<Array<{ id: EtaMode; label: string }>>(() => [
  { id: 'count', label: t(U + 'modeCount') },
  { id: 'percent', label: t(U + 'modePercent') },
]);
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton
          :title="running ? t(U + 'pauseTitle') : t(U + 'resumeTitle')"
          @click="running ? stop() : start()"
        >
          <component :is="running ? Pause : Play" :size="14" />
          <span>{{ running ? t(U + 'pause') : t(U + 'resume') }}</span>
        </ToolButton>
        <ToolButton :title="t(U + 'resetTitle')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <SegmentedControl v-model="mode" :options="modeOptions" />

      <div v-if="mode === 'count'" class="qt-row">
        <ToolField
          v-model="current"
          :label="t(U + 'current')"
          type="number"
          placeholder="e.g. 250"
          min="0"
          step="any"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="total"
          :label="t(U + 'total')"
          type="number"
          placeholder="e.g. 1000"
          min="0"
          step="any"
          inputmode="decimal"
          grow
        />
      </div>

      <div v-else class="qt-row">
        <ToolField
          v-model="percentage"
          :label="t(U + 'percentage')"
          type="number"
          placeholder="e.g. 25"
          min="0"
          max="100"
          step="any"
          inputmode="decimal"
          grow
        />
      </div>

      <ToolField
        v-model="startInput"
        :label="t(U + 'startTime')"
        type="datetime-local"
      />

      <label class="qt-check">
        <input type="checkbox" v-model="useExplicitSpeed" />
        <span>{{ t(U + 'useExplicitSpeed') }}</span>
      </label>
      <ToolField
        v-if="useExplicitSpeed"
        v-model="speedInput"
        :label="t(U + 'speedLabel')"
        type="number"
        placeholder="e.g. 5.5"
        min="0"
        step="any"
        inputmode="decimal"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="
        snapshot === null
          ? t(U + 'descEmpty')
          : hasError
            ? t(U + 'descInvalid')
            : isComplete
              ? t(U + 'descComplete')
              : t(U + 'descLive')
      "
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="snapshot === null" kind="empty">
        {{ t(U + 'descEmpty') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-row qt-row--center" style="--qt-row-gap:10px;margin-bottom:12px;flex-wrap:nowrap">
          <div class="eta__progress-track">
            <div
              class="eta__progress-fill"
              :style="{ width: progressBarWidth }"
              :class="{ 'eta__progress-fill--done': isComplete }"
            />
          </div>
          <span style="font-size:13px;font-weight:700;color:var(--qt-text);min-width:56px;text-align:right">{{ progressPercent }}</span>
        </div>

        <div class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:10px">
          <ResultRow :label="t(U + 'elapsed')" :value="elapsedText" :icon="Timer" uppercase />
          <ResultRow :label="t(U + 'remaining')" :value="remainingText" :icon="Clock" uppercase />
          <ResultRow
            :label="t(U + 'completion')"
            :value="completionText"
            :icon="Gauge"
            uppercase
            size="sm"
          />
          <ResultRow
            :label="t(U + 'speedUnits')"
            :value="speedText"
            :icon="TrendingUp"
            uppercase
          />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Progress bar — track + fill (fill turns green when complete). */
.eta__progress-track {
  flex: 1;
  height: 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  overflow: hidden;
}
.eta__progress-fill {
  height: 100%;
  background: var(--qt-accent);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.eta__progress-fill--done {
  background: oklch(0.62 0.17 150);
}
</style>
