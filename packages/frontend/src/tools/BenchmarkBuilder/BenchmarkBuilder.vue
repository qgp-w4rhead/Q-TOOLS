<script setup lang="ts">
/**
 * BenchmarkBuilder — measure the execution time of JavaScript code snippets.
 *
 * The user enters a code snippet (and optional setup code), configures the
 * number of iterations and warmup runs, then runs the benchmark. Results show
 * average, min, max, median, p95, p99, standard deviation, and ops/sec.
 *
 * Uses `performance.now()` for sub-millisecond timing. For large iteration
 * counts the timed loop is chunked so the UI stays responsive and the run can
 * be cancelled mid-flight.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the code and
 * configuration (and trigger `run`/`cancel`/`reset` actions), and sends
 * `output` PostMessages with the running state, progress, and results.
 */
import {
  Activity,
  AlertCircle,
  BarChart3,
  Gauge,
  Play,
  RotateCcw,
  Square,
  Zap,
} from 'lucide-vue-next';
import { computed } from 'vue';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useBenchmarkBuilder,
  formatDuration,
  formatNumber,
  PRESETS,
  type BenchmarkPreset,
  type BenchmarkStats,
} from './useBenchmarkBuilder';

const {
  code,
  setupCode,
  iterations,
  warmup,
  running,
  progress,
  outcome,
  run,
  cancel,
  reset,
  loadPreset,
} = useBenchmarkBuilder();

const hasError = computed(
  () => outcome.value !== null && !outcome.value.ok,
);
const stats = computed<BenchmarkStats | null>(() =>
  outcome.value && outcome.value.ok ? outcome.value.stats : null,
);
const progressBarWidth = computed(() =>
  `${Math.min(100, Math.max(0, progress.value * 100)).toFixed(1)}%`,
);

const avgText = computed(() =>
  stats.value ? formatDuration(stats.value.mean) : '—',
);
const minText = computed(() =>
  stats.value ? formatDuration(stats.value.min) : '—',
);
const maxText = computed(() =>
  stats.value ? formatDuration(stats.value.max) : '—',
);
const medianText = computed(() =>
  stats.value ? formatDuration(stats.value.median) : '—',
);
const p95Text = computed(() =>
  stats.value ? formatDuration(stats.value.p95) : '—',
);
const p99Text = computed(() =>
  stats.value ? formatDuration(stats.value.p99) : '—',
);
const stdDevText = computed(() =>
  stats.value ? formatDuration(stats.value.stdDev) : '—',
);
const opsText = computed(() =>
  stats.value ? formatNumber(stats.value.opsPerSec) : '—',
);
const totalText = computed(() =>
  stats.value ? formatDuration(stats.value.totalMs) : '—',
);
const countText = computed(() =>
  stats.value ? formatNumber(stats.value.count) : '—',
);

const copyAvg = computed(() => avgText.value);
const copyMin = computed(() => minText.value);
const copyMax = computed(() => maxText.value);
const copyMedian = computed(() => medianText.value);
const copyP95 = computed(() => p95Text.value);
const copyP99 = computed(() => p99Text.value);
const copyOps = computed(() => opsText.value);
const copyAll = computed(() => {
  if (!stats.value) return '';
  const s = stats.value;
  return [
    `count: ${s.count}`,
    `avg: ${formatDuration(s.mean)}`,
    `min: ${formatDuration(s.min)}`,
    `max: ${formatDuration(s.max)}`,
    `median: ${formatDuration(s.median)}`,
    `p95: ${formatDuration(s.p95)}`,
    `p99: ${formatDuration(s.p99)}`,
    `stdDev: ${formatDuration(s.stdDev)}`,
    `ops/sec: ${formatNumber(s.opsPerSec)}`,
    `total: ${formatDuration(s.totalMs)}`,
  ].join('\n');
});

function onCodeInput(e: Event): void {
  code.value = (e.target as HTMLTextAreaElement).value;
}
function onSetupInput(e: Event): void {
  setupCode.value = (e.target as HTMLTextAreaElement).value;
}
function onIterationsInput(e: Event): void {
  iterations.value = (e.target as HTMLInputElement).value;
}
function onWarmupInput(e: Event): void {
  warmup.value = (e.target as HTMLInputElement).value;
}

function applyPreset(preset: BenchmarkPreset): void {
  loadPreset(preset);
}
</script>

<template>
  <div class="bench">
    <ToolInput
      title="Code snippet"
      description="Enter JavaScript code to benchmark. Use the optional setup block to prepare data (shared via ctx). Click a preset to load an example."
    >
      <template #actions>
        <button
          type="button"
          class="bench__btn bench__btn--ghost"
          title="Reset all fields"
          :disabled="running"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <div class="bench__presets">
        <span class="bench__presets-label">Presets:</span>
        <button
          v-for="preset in PRESETS"
          :key="preset.name"
          type="button"
          class="bench__preset-chip"
          :disabled="running"
          @click="applyPreset(preset)"
        >
          {{ preset.name }}
        </button>
      </div>

      <label class="bench__field">
        <span class="bench__label">Setup code (runs once, before warmup)</span>
        <textarea
          class="bench__textarea bench__textarea--setup"
          placeholder="ctx.arr = [1, 2, 3, 4, 5];"
          spellcheck="false"
          :value="setupCode"
          @input="onSetupInput"
        />
      </label>

      <label class="bench__field">
        <span class="bench__label">Code to benchmark (runs per iteration)</span>
        <textarea
          class="bench__textarea"
          placeholder="ctx.arr.map(x => x * x);"
          spellcheck="false"
          :value="code"
          @input="onCodeInput"
        />
      </label>

      <div class="bench__row">
        <label class="bench__field">
          <span class="bench__label">Iterations</span>
          <input
            type="number"
            class="bench__input"
            placeholder="e.g. 1000"
            min="1"
            step="1"
            :value="iterations"
            inputmode="numeric"
            @input="onIterationsInput"
          />
        </label>
        <label class="bench__field">
          <span class="bench__label">Warmup runs</span>
          <input
            type="number"
            class="bench__input"
            placeholder="e.g. 100"
            min="0"
            step="1"
            :value="warmup"
            inputmode="numeric"
            @input="onWarmupInput"
          />
        </label>
      </div>

      <div class="bench__actions">
        <button
          v-if="!running"
          type="button"
          class="bench__btn bench__btn--primary"
          @click="run"
        >
          <Play :size="14" />
          <span>Run benchmark</span>
        </button>
        <button
          v-else
          type="button"
          class="bench__btn bench__btn--danger"
          @click="cancel"
        >
          <Square :size="14" />
          <span>Cancel</span>
        </button>
      </div>

      <div v-if="running" class="bench__progress">
        <div class="bench__progress-track">
          <div
            class="bench__progress-fill"
            :style="{ width: progressBarWidth }"
          />
        </div>
        <span class="bench__progress-pct">{{ (progress * 100).toFixed(0) }}%</span>
      </div>
    </ToolInput>

    <ToolOutput
      title="Results"
      :description="
        outcome === null
          ? 'Run a benchmark to see the results.'
          : hasError
            ? 'The benchmark failed — see the error below.'
            : 'Benchmark results — timing statistics across all iterations.'
      "
    >
      <p v-if="hasError" class="bench__error">
        <AlertCircle :size="14" />
        <span>{{ outcome?.ok === false ? outcome.message : '' }}</span>
      </p>
      <p v-else-if="outcome === null" class="bench__empty">
        Run a benchmark to see the results.
      </p>
      <template v-else>
        <div class="bench__highlight">
          <div class="bench__highlight-stat">
            <div class="bench__stat-head">
              <Gauge :size="13" />
              <span>Average</span>
            </div>
            <div class="bench__highlight-value">{{ avgText }}</div>
            <CopyButton :text="copyAvg" label="Copy" icon-only />
          </div>
          <div class="bench__highlight-stat">
            <div class="bench__stat-head">
              <Zap :size="13" />
              <span>Ops / sec</span>
            </div>
            <div class="bench__highlight-value">{{ opsText }}</div>
            <CopyButton :text="copyOps" label="Copy" icon-only />
          </div>
        </div>

        <div class="bench__grid">
          <div class="bench__stat">
            <div class="bench__stat-head">
              <Activity :size="13" />
              <span>Min</span>
            </div>
            <div class="bench__stat-value">{{ minText }}</div>
            <CopyButton :text="copyMin" label="Copy" icon-only />
          </div>
          <div class="bench__stat">
            <div class="bench__stat-head">
              <Activity :size="13" />
              <span>Max</span>
            </div>
            <div class="bench__stat-value">{{ maxText }}</div>
            <CopyButton :text="copyMax" label="Copy" icon-only />
          </div>
          <div class="bench__stat">
            <div class="bench__stat-head">
              <BarChart3 :size="13" />
              <span>Median</span>
            </div>
            <div class="bench__stat-value">{{ medianText }}</div>
            <CopyButton :text="copyMedian" label="Copy" icon-only />
          </div>
          <div class="bench__stat">
            <div class="bench__stat-head">
              <BarChart3 :size="13" />
              <span>p95</span>
            </div>
            <div class="bench__stat-value">{{ p95Text }}</div>
            <CopyButton :text="copyP95" label="Copy" icon-only />
          </div>
          <div class="bench__stat">
            <div class="bench__stat-head">
              <BarChart3 :size="13" />
              <span>p99</span>
            </div>
            <div class="bench__stat-value">{{ p99Text }}</div>
            <CopyButton :text="copyP99" label="Copy" icon-only />
          </div>
          <div class="bench__stat">
            <div class="bench__stat-head">
              <Activity :size="13" />
              <span>Std dev</span>
            </div>
            <div class="bench__stat-value">{{ stdDevText }}</div>
          </div>
          <div class="bench__stat">
            <div class="bench__stat-head">
              <Gauge :size="13" />
              <span>Total time</span>
            </div>
            <div class="bench__stat-value">{{ totalText }}</div>
          </div>
          <div class="bench__stat">
            <div class="bench__stat-head">
              <BarChart3 :size="13" />
              <span>Samples</span>
            </div>
            <div class="bench__stat-value">{{ countText }}</div>
          </div>
        </div>

        <div class="bench__copy-all">
          <CopyButton :text="copyAll" label="Copy all stats" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.bench {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.bench__presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.bench__presets-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-muted);
  margin-right: 2px;
}
.bench__preset-chip {
  background: transparent;
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}
.bench__preset-chip:hover:not(:disabled) {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.bench__preset-chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bench__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bench__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.bench__textarea {
  width: 100%;
  min-height: 80px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  padding: 10px 12px;
  resize: vertical;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.bench__textarea--setup {
  min-height: 56px;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.bench__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.bench__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.bench__row .bench__field {
  flex: 1;
  min-width: 140px;
}
.bench__input {
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
.bench__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.bench__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.bench__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--qt-radius-sm);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.bench__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bench__btn--primary {
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  color: var(--qt-bg);
}
.bench__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}
.bench__btn--danger {
  background: var(--qt-danger);
  border: 1px solid var(--qt-danger);
  color: var(--qt-bg);
}
.bench__btn--danger:hover:not(:disabled) {
  opacity: 0.9;
}
.bench__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.bench__btn--ghost:hover:not(:disabled) {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.bench__btn:active:not(:disabled) {
  transform: translateY(1px);
}
.bench__progress {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bench__progress-track {
  flex: 1;
  height: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  overflow: hidden;
}
.bench__progress-fill {
  height: 100%;
  background: var(--qt-accent);
  border-radius: 999px;
  transition: width 0.15s ease;
}
.bench__progress-pct {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--qt-text);
  min-width: 40px;
  text-align: right;
}
.bench__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.bench__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.bench__highlight {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.bench__highlight-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--qt-surface);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  padding: 12px 14px;
}
.bench__highlight-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 22px;
  font-weight: 700;
  color: var(--qt-text);
  word-break: break-word;
}
.bench__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.bench__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
}
.bench__stat-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.bench__stat-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--qt-text);
  word-break: break-word;
}
.bench__copy-all {
  margin-top: 10px;
}
</style>
