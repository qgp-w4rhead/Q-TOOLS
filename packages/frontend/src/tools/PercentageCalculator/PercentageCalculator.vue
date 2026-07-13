<script setup lang="ts">
/**
 * PercentageCalculator — three-mode percentage calculator.
 *
 * Modes:
 *   - **ofTotal**    — "X is what % of Y"
 *   - **percentValue** — "X% of Y is"
 *   - **change**     — "% increase/decrease from X to Y"
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the fields
 * and sends `output` PostMessages whenever the result changes.
 */
import { AlertCircle, RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  usePercentageCalculator,
  formatNumber,
  type PercentMode,
} from './usePercentageCalculator';

const {
  mode,
  xOfTotal,
  yOfTotal,
  pctValue,
  yValue,
  fromChange,
  toChange,
  snapshot,
  reset,
} = usePercentageCalculator();

const hasError = computed(
  () => snapshot.value !== null && !snapshot.value.ok,
);
const isEmpty = computed(() => snapshot.value === null);

const resultText = computed(() => {
  if (snapshot.value === null) return '—';
  if (!snapshot.value.ok) return '—';
  return formatNumber(snapshot.value.result);
});

const resultSuffix = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  if (mode.value === 'ofTotal' || mode.value === 'change') return '%';
  return '';
});

const directionLabel = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  if (mode.value !== 'change') return '';
  const dir = snapshot.value.direction;
  if (dir === 'increase') return 'increase';
  if (dir === 'decrease') return 'decrease';
  return 'no change';
});

const resultSentence = computed(() => {
  if (snapshot.value === null) return 'Enter values to compute a result.';
  if (!snapshot.value.ok) return snapshot.value.message ?? 'Invalid input.';
  const r = formatNumber(snapshot.value.result);
  if (mode.value === 'ofTotal') {
    const x = formatNumber(snapshot.value.inputs.x ?? NaN);
    const y = formatNumber(snapshot.value.inputs.y ?? NaN);
    return `${x} is ${r}% of ${y}`;
  }
  if (mode.value === 'percentValue') {
    const pct = formatNumber(snapshot.value.inputs.pct ?? NaN);
    const y = formatNumber(snapshot.value.inputs.y ?? NaN);
    return `${pct}% of ${y} is ${r}`;
  }
  const from = formatNumber(snapshot.value.inputs.from ?? NaN);
  const to = formatNumber(snapshot.value.inputs.to ?? NaN);
  const dir = snapshot.value.direction;
  const verb = dir === 'increase' ? 'an increase' : dir === 'decrease' ? 'a decrease' : 'no change';
  return `${from} → ${to} is ${verb} of ${r}%`;
});

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return `${formatNumber(snapshot.value.result)}${resultSuffix.value}`;
});

function setMode(next: PercentMode): void {
  mode.value = next;
}

function onXOfTotal(e: Event): void {
  xOfTotal.value = (e.target as HTMLInputElement).value;
}
function onYOfTotal(e: Event): void {
  yOfTotal.value = (e.target as HTMLInputElement).value;
}
function onPctValue(e: Event): void {
  pctValue.value = (e.target as HTMLInputElement).value;
}
function onYValue(e: Event): void {
  yValue.value = (e.target as HTMLInputElement).value;
}
function onFromChange(e: Event): void {
  fromChange.value = (e.target as HTMLInputElement).value;
}
function onToChange(e: Event): void {
  toChange.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="pc">
    <ToolInput
      title="Percentage calculation"
      description="Pick a mode and enter values to compute the result."
    >
      <template #actions>
        <button
          type="button"
          class="pc__btn pc__btn--ghost"
          title="Reset all fields"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <div class="pc__mode">
        <button
          type="button"
          class="pc__mode-btn"
          :class="{ 'pc__mode-btn--active': mode === 'ofTotal' }"
          @click="setMode('ofTotal')"
        >
          X is what % of Y
        </button>
        <button
          type="button"
          class="pc__mode-btn"
          :class="{ 'pc__mode-btn--active': mode === 'percentValue' }"
          @click="setMode('percentValue')"
        >
          X% of Y is
        </button>
        <button
          type="button"
          class="pc__mode-btn"
          :class="{ 'pc__mode-btn--active': mode === 'change' }"
          @click="setMode('change')"
        >
          % change from X to Y
        </button>
      </div>

      <div v-if="mode === 'ofTotal'" class="pc__row">
        <label class="pc__field">
          <span class="pc__label">X (part)</span>
          <input
            type="number"
            class="pc__input"
            placeholder="e.g. 25"
            step="any"
            :value="xOfTotal"
            inputmode="decimal"
            @input="onXOfTotal"
          />
        </label>
        <label class="pc__field">
          <span class="pc__label">Y (total)</span>
          <input
            type="number"
            class="pc__input"
            placeholder="e.g. 200"
            step="any"
            :value="yOfTotal"
            inputmode="decimal"
            @input="onYOfTotal"
          />
        </label>
      </div>

      <div v-else-if="mode === 'percentValue'" class="pc__row">
        <label class="pc__field">
          <span class="pc__label">Percentage (X%)</span>
          <input
            type="number"
            class="pc__input"
            placeholder="e.g. 15"
            step="any"
            :value="pctValue"
            inputmode="decimal"
            @input="onPctValue"
          />
        </label>
        <label class="pc__field">
          <span class="pc__label">Y (base)</span>
          <input
            type="number"
            class="pc__input"
            placeholder="e.g. 200"
            step="any"
            :value="yValue"
            inputmode="decimal"
            @input="onYValue"
          />
        </label>
      </div>

      <div v-else class="pc__row">
        <label class="pc__field">
          <span class="pc__label">From (original)</span>
          <input
            type="number"
            class="pc__input"
            placeholder="e.g. 150"
            step="any"
            :value="fromChange"
            inputmode="decimal"
            @input="onFromChange"
          />
        </label>
        <label class="pc__field">
          <span class="pc__label">To (new)</span>
          <input
            type="number"
            class="pc__input"
            placeholder="e.g. 180"
            step="any"
            :value="toChange"
            inputmode="decimal"
            @input="onToChange"
          />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Result"
      :description="
        isEmpty
          ? 'Enter values to compute a result.'
          : hasError
            ? 'Adjust the inputs to get a valid result.'
            : 'Computed result.'
      "
    >
      <p v-if="hasError" class="pc__error">
        <AlertCircle :size="14" />
        <span>{{ snapshot?.message }}</span>
      </p>
      <p v-else-if="isEmpty" class="pc__empty">
        Enter values to compute a result.
      </p>
      <template v-else>
        <div class="pc__result">
          <span class="pc__result-value">{{ resultText }}<span class="pc__result-suffix">{{ resultSuffix }}</span></span>
          <CopyButton :text="copyText" label="Copy" icon-only />
        </div>
        <p class="pc__sentence">{{ resultSentence }}</p>
        <p v-if="directionLabel" class="pc__direction" :class="`pc__direction--${directionLabel.replace(' ', '-')}`">
          {{ directionLabel }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.pc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.pc__mode {
  display: inline-flex;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
  width: fit-content;
  flex-wrap: wrap;
}
.pc__mode-btn {
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
.pc__mode-btn:last-child {
  border-right: none;
}
.pc__mode-btn:hover {
  color: var(--qt-text);
}
.pc__mode-btn--active {
  background: var(--qt-accent);
  color: var(--qt-bg);
}
.pc__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.pc__row .pc__field {
  flex: 1;
  min-width: 140px;
}
.pc__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pc__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.pc__input {
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
.pc__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.pc__btn {
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
.pc__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.pc__btn--ghost:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.pc__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.pc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.pc__result {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pc__result-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 28px;
  font-weight: 700;
  color: var(--qt-text);
  word-break: break-word;
}
.pc__result-suffix {
  font-size: 18px;
  font-weight: 600;
  color: var(--qt-muted);
  margin-left: 2px;
}
.pc__sentence {
  margin: 8px 0 0;
  font-size: 13.5px;
  color: var(--qt-text);
  line-height: 1.4;
}
.pc__direction {
  margin: 6px 0 0;
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pc__direction--increase {
  color: oklch(0.62 0.17 150);
}
.pc__direction--decrease {
  color: var(--qt-danger);
}
.pc__direction--no-change {
  color: var(--qt-muted);
}
</style>
