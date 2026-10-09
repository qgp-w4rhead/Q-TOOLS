<script setup lang="ts">
/**
 * BenchmarkBuilder - measure the execution time of JavaScript code snippets.
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
  BarChart3,
  Gauge,
  Play,
  RotateCcw,
  Square,
  Zap,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useBenchmarkBuilder,
  formatDuration,
  formatNumber,
  PRESETS,
  type BenchmarkPreset,
  type BenchmarkStats,
} from './useBenchmarkBuilder';

const { t } = useI18n();
const U = 'tools.benchmark-builder.ui.';

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
  stats.value ? formatDuration(stats.value.mean) : '-',
);
const minText = computed(() =>
  stats.value ? formatDuration(stats.value.min) : '-',
);
const maxText = computed(() =>
  stats.value ? formatDuration(stats.value.max) : '-',
);
const medianText = computed(() =>
  stats.value ? formatDuration(stats.value.median) : '-',
);
const p95Text = computed(() =>
  stats.value ? formatDuration(stats.value.p95) : '-',
);
const p99Text = computed(() =>
  stats.value ? formatDuration(stats.value.p99) : '-',
);
const stdDevText = computed(() =>
  stats.value ? formatDuration(stats.value.stdDev) : '-',
);
const opsText = computed(() =>
  stats.value ? formatNumber(stats.value.opsPerSec) : '-',
);
const totalText = computed(() =>
  stats.value ? formatDuration(stats.value.totalMs) : '-',
);
const countText = computed(() =>
  stats.value ? formatNumber(stats.value.count) : '-',
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
function applyPreset(preset: BenchmarkPreset): void {
  loadPreset(preset);
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
          :disabled="running"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
        <span style="font-size:12px;font-weight:600;color:var(--qt-muted);margin-right:2px">{{ t(U + 'presets') }}</span>
        <button
          v-for="preset in PRESETS"
          :key="preset.name"
          type="button"
          class="qt-chip"
          :disabled="running"
          @click="applyPreset(preset)"
        >
          {{ preset.name }}
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'setupLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:56px;font-size:12.5px;line-height:1.5;padding:10px 12px;color:var(--qt-muted)"
          :placeholder="t(U + 'phSetup')"
          spellcheck="false"
          :value="setupCode"
          @input="onSetupInput"
        />
      </label>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'codeLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:80px;font-size:13px;line-height:1.5;padding:10px 12px"
          :placeholder="t(U + 'phCode')"
          spellcheck="false"
          :value="code"
          @input="onCodeInput"
        />
      </label>

      <div class="qt-row">
        <ToolField
          v-model="iterations"
          :label="t(U + 'iterLabel')"
          type="number"
          :placeholder="t(U + 'phIter')"
          min="1"
          step="1"
          inputmode="numeric"
          grow
        />
        <ToolField
          v-model="warmup"
          :label="t(U + 'warmupLabel')"
          type="number"
          :placeholder="t(U + 'phWarmup')"
          min="0"
          step="1"
          inputmode="numeric"
          grow
        />
      </div>

      <div class="qt-row">
        <ToolButton v-if="!running" variant="primary" @click="run">
          <Play :size="14" />
          <span>{{ t(U + 'run') }}</span>
        </ToolButton>
        <button
          v-else
          type="button"
          class="qt-btn qt-btn--danger"
          style="padding:8px 14px"
          @click="cancel"
        >
          <Square :size="14" />
          <span>{{ t(U + 'cancel') }}</span>
        </button>
      </div>

      <div v-if="running" class="qt-progress">
        <div class="qt-progress-track">
          <div
            class="qt-progress-fill"
            :style="{ width: progressBarWidth }"
          />
        </div>
        <span class="qt-progress-pct">{{ (progress * 100).toFixed(0) }}%</span>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="
        outcome === null
          ? t(U + 'descEmpty')
          : hasError
            ? t(U + 'descError')
            : t(U + 'descOk')
      "
    >
      <ToolAlert v-if="hasError" kind="error">
        {{ outcome?.ok === false ? outcome.message : '' }}
      </ToolAlert>
      <ToolAlert v-else-if="outcome === null" kind="empty">
        {{ t(U + 'descEmpty') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:10px;margin-bottom:12px">
          <div class="qt-panel" style="border-color:var(--qt-accent);display:flex;flex-direction:column;gap:4px">
            <div class="qt-stat-head">
              <Gauge :size="13" />
              <span>{{ t(U + 'statAvg') }}</span>
            </div>
            <div class="qt-value" style="font-size:22px">{{ avgText }}</div>
            <CopyButton :text="copyAvg" label="Copy" icon-only />
          </div>
          <div class="qt-panel" style="border-color:var(--qt-accent);display:flex;flex-direction:column;gap:4px">
            <div class="qt-stat-head">
              <Zap :size="13" />
              <span>{{ t(U + 'statOps') }}</span>
            </div>
            <div class="qt-value" style="font-size:22px">{{ opsText }}</div>
            <CopyButton :text="copyOps" label="Copy" icon-only />
          </div>
        </div>

        <div class="qt-grid" style="--qt-grid-min:160px;--qt-grid-gap:10px">
          <div class="qt-result" style="padding:10px 12px">
            <div class="qt-stat-head">
              <Activity :size="13" />
              <span>{{ t(U + 'statMin') }}</span>
            </div>
            <div class="qt-value">{{ minText }}</div>
            <CopyButton :text="copyMin" label="Copy" icon-only />
          </div>
          <div class="qt-result" style="padding:10px 12px">
            <div class="qt-stat-head">
              <Activity :size="13" />
              <span>{{ t(U + 'statMax') }}</span>
            </div>
            <div class="qt-value">{{ maxText }}</div>
            <CopyButton :text="copyMax" label="Copy" icon-only />
          </div>
          <div class="qt-result" style="padding:10px 12px">
            <div class="qt-stat-head">
              <BarChart3 :size="13" />
              <span>{{ t(U + 'statMedian') }}</span>
            </div>
            <div class="qt-value">{{ medianText }}</div>
            <CopyButton :text="copyMedian" label="Copy" icon-only />
          </div>
          <div class="qt-result" style="padding:10px 12px">
            <div class="qt-stat-head">
              <BarChart3 :size="13" />
              <span>p95</span>
            </div>
            <div class="qt-value">{{ p95Text }}</div>
            <CopyButton :text="copyP95" label="Copy" icon-only />
          </div>
          <div class="qt-result" style="padding:10px 12px">
            <div class="qt-stat-head">
              <BarChart3 :size="13" />
              <span>p99</span>
            </div>
            <div class="qt-value">{{ p99Text }}</div>
            <CopyButton :text="copyP99" label="Copy" icon-only />
          </div>
          <div class="qt-result" style="padding:10px 12px">
            <div class="qt-stat-head">
              <Activity :size="13" />
              <span>{{ t(U + 'statStdDev') }}</span>
            </div>
            <div class="qt-value">{{ stdDevText }}</div>
          </div>
          <div class="qt-result" style="padding:10px 12px">
            <div class="qt-stat-head">
              <Gauge :size="13" />
              <span>{{ t(U + 'statTotal') }}</span>
            </div>
            <div class="qt-value">{{ totalText }}</div>
          </div>
          <div class="qt-result" style="padding:10px 12px">
            <div class="qt-stat-head">
              <BarChart3 :size="13" />
              <span>{{ t(U + 'statSamples') }}</span>
            </div>
            <div class="qt-value">{{ countText }}</div>
          </div>
        </div>

        <div style="margin-top:10px">
          <CopyButton :text="copyAll" :label="t(U + 'copyAll')" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>
