<script setup lang="ts">
/**
 * EtaCalculator — estimate remaining time and completion time for a task.
 *
 * Two input modes:
 *   - **count** — current + total values (e.g. 250 of 1000 rows).
 *   - **percent** — a single percentage in [0, 100].
 *
 * The speed (units/sec) is either supplied explicitly or derived from the
 * progress made since the start time. The tool ticks once per second to
 * refresh the elapsed/remaining/completion values live.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the fields
 * and sends `output` PostMessages whenever the snapshot changes.
 */
import {
  AlertCircle,
  Clock,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Timer,
  TrendingUp,
} from 'lucide-vue-next';
import { computed } from 'vue';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
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
  snapshot.value ? formatDuration(snapshot.value.elapsedMs) : '—',
);
const remainingText = computed(() =>
  snapshot.value ? formatDuration(snapshot.value.remainingMs) : '—',
);
const completionText = computed(() =>
  snapshot.value ? formatDateTime(snapshot.value.completionMs) : '—',
);
const speedText = computed(() =>
  snapshot.value ? formatSpeed(snapshot.value.speed) : '—',
);
const progressPercent = computed(() =>
  snapshot.value
    ? `${snapshot.value.progressPercent.toFixed(1)}%`
    : '—',
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

function setMode(next: EtaMode): void {
  mode.value = next;
}

function onCurrentInput(e: Event): void {
  current.value = (e.target as HTMLInputElement).value;
}
function onTotalInput(e: Event): void {
  total.value = (e.target as HTMLInputElement).value;
}
function onPercentageInput(e: Event): void {
  percentage.value = (e.target as HTMLInputElement).value;
}
function onStartInput(e: Event): void {
  startInput.value = (e.target as HTMLInputElement).value;
}
function onSpeedInput(e: Event): void {
  speedInput.value = (e.target as HTMLInputElement).value;
}
function onUseExplicitSpeedChange(e: Event): void {
  useExplicitSpeed.value = (e.target as HTMLInputElement).checked;
}

const copyElapsed = computed(() => elapsedText.value);
const copyRemaining = computed(() => remainingText.value);
const copyCompletion = computed(() => completionText.value);
const copySpeed = computed(() => speedText.value);
</script>

<template>
  <div class="eta">
    <ToolInput
      title="Task progress"
      description="Enter progress (count or percentage) and a start time to estimate the remaining time and completion time."
    >
      <template #actions>
        <button
          type="button"
          class="eta__btn eta__btn--ghost"
          :title="running ? 'Pause live updates' : 'Resume live updates'"
          @click="running ? stop() : start()"
        >
          <component :is="running ? Pause : Play" :size="14" />
          <span>{{ running ? 'Pause' : 'Resume' }}</span>
        </button>
        <button
          type="button"
          class="eta__btn eta__btn--ghost"
          title="Reset all fields"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <div class="eta__mode">
        <button
          type="button"
          class="eta__mode-btn"
          :class="{ 'eta__mode-btn--active': mode === 'count' }"
          @click="setMode('count')"
        >
          Count (current / total)
        </button>
        <button
          type="button"
          class="eta__mode-btn"
          :class="{ 'eta__mode-btn--active': mode === 'percent' }"
          @click="setMode('percent')"
        >
          Percentage
        </button>
      </div>

      <div v-if="mode === 'count'" class="eta__row">
        <label class="eta__field">
          <span class="eta__label">Current</span>
          <input
            type="number"
            class="eta__input"
            placeholder="e.g. 250"
            min="0"
            step="any"
            :value="current"
            inputmode="decimal"
            @input="onCurrentInput"
          />
        </label>
        <label class="eta__field">
          <span class="eta__label">Total</span>
          <input
            type="number"
            class="eta__input"
            placeholder="e.g. 1000"
            min="0"
            step="any"
            :value="total"
            inputmode="decimal"
            @input="onTotalInput"
          />
        </label>
      </div>

      <div v-else class="eta__row">
        <label class="eta__field">
          <span class="eta__label">Percentage</span>
          <input
            type="number"
            class="eta__input"
            placeholder="e.g. 25"
            min="0"
            max="100"
            step="any"
            :value="percentage"
            inputmode="decimal"
            @input="onPercentageInput"
          />
        </label>
      </div>

      <label class="eta__field">
        <span class="eta__label">Start time</span>
        <input
          type="datetime-local"
          class="eta__input"
          :value="startInput"
          @input="onStartInput"
        />
      </label>

      <label class="eta__check">
        <input
          type="checkbox"
          :checked="useExplicitSpeed"
          @change="onUseExplicitSpeedChange"
        />
        <span>Use explicit speed (units / second)</span>
      </label>
      <label v-if="useExplicitSpeed" class="eta__field">
        <span class="eta__label">Speed (units / second)</span>
        <input
          type="number"
          class="eta__input"
          placeholder="e.g. 5.5"
          min="0"
          step="any"
          :value="speedInput"
          inputmode="decimal"
          @input="onSpeedInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="Estimate"
      :description="
        snapshot === null
          ? 'Enter progress and a start time to estimate the ETA.'
          : hasError
            ? 'Adjust the inputs to get a valid estimate.'
            : isComplete
              ? 'Task complete.'
              : 'Live estimate — updates every second.'
      "
    >
      <p v-if="hasError" class="eta__error">
        <AlertCircle :size="14" />
        <span>{{ snapshot?.message }}</span>
      </p>
      <p v-else-if="snapshot === null" class="eta__empty">
        Enter progress and a start time to estimate the ETA.
      </p>
      <template v-else>
        <div class="eta__progress">
          <div class="eta__progress-track">
            <div
              class="eta__progress-fill"
              :style="{ width: progressBarWidth }"
              :class="{ 'eta__progress-fill--done': isComplete }"
            />
          </div>
          <span class="eta__progress-pct">{{ progressPercent }}</span>
        </div>

        <div class="eta__grid">
          <div class="eta__stat">
            <div class="eta__stat-head">
              <Timer :size="13" />
              <span>Elapsed</span>
            </div>
            <div class="eta__stat-value">{{ elapsedText }}</div>
            <CopyButton :text="copyElapsed" label="Copy" icon-only />
          </div>
          <div class="eta__stat">
            <div class="eta__stat-head">
              <Clock :size="13" />
              <span>Remaining</span>
            </div>
            <div class="eta__stat-value">{{ remainingText }}</div>
            <CopyButton :text="copyRemaining" label="Copy" icon-only />
          </div>
          <div class="eta__stat">
            <div class="eta__stat-head">
              <Gauge :size="13" />
              <span>Completion</span>
            </div>
            <div class="eta__stat-value eta__stat-value--sm">
              {{ completionText }}
            </div>
            <CopyButton :text="copyCompletion" label="Copy" icon-only />
          </div>
          <div class="eta__stat">
            <div class="eta__stat-head">
              <TrendingUp :size="13" />
              <span>Speed (units/s)</span>
            </div>
            <div class="eta__stat-value">{{ speedText }}</div>
            <CopyButton :text="copySpeed" label="Copy" icon-only />
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.eta {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.eta__mode {
  display: inline-flex;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
  width: fit-content;
}
.eta__mode-btn {
  background: transparent;
  border: none;
  border-right: 1px solid var(--qt-border);
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.eta__mode-btn:last-child {
  border-right: none;
}
.eta__mode-btn:hover {
  color: var(--qt-text);
}
.eta__mode-btn--active {
  background: var(--qt-accent);
  color: var(--qt-bg);
}
.eta__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.eta__row .eta__field {
  flex: 1;
  min-width: 140px;
}
.eta__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.eta__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.eta__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.eta__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.eta__check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--qt-text);
  cursor: pointer;
}
.eta__check input {
  cursor: pointer;
}
.eta__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--qt-radius-sm);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
.eta__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.eta__btn--ghost:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.eta__btn:active {
  transform: translateY(0);
}
.eta__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.eta__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.eta__progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
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
.eta__progress-pct {
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
  min-width: 56px;
  text-align: right;
}
.eta__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.eta__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
}
.eta__stat-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.eta__stat-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--qt-text);
  word-break: break-word;
}
.eta__stat-value--sm {
  font-size: 13.5px;
  font-weight: 600;
}
</style>
