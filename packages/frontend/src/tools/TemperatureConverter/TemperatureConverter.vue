<script setup lang="ts">
/**
 * TemperatureConverter — convert a temperature value between eight scales.
 *
 * Scales: Celsius, Fahrenheit, Kelvin, Rankine, Delisle, Newton, Réaumur,
 * Rømer. Enter a value + unit and every other scale updates live.
 *
 * Works in embed mode: receives `input`/`value`/`unit` PostMessages to
 * pre-fill the fields and sends `output` PostMessages whenever the
 * conversions change.
 */
import { AlertTriangle, RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useTemperatureConverter,
  formatNumber,
  UNIT_ORDER,
  UNIT_META,
  type TemperatureUnit,
} from './useTemperatureConverter';

const {
  inputValue,
  inputUnit,
  outputs,
  belowAbsoluteZero,
  reset,
} = useTemperatureConverter();

const isEmpty = computed(() => parseInput() === null);

function parseInput(): number | null {
  const trimmed = inputValue.value.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function onInput(e: Event): void {
  inputValue.value = (e.target as HTMLInputElement).value;
}

function onUnit(e: Event): void {
  const next = (e.target as HTMLSelectElement).value as TemperatureUnit;
  inputUnit.value = next;
}

const inputSymbol = computed(() => UNIT_META[inputUnit.value].symbol);

const outputRows = computed(() =>
  UNIT_ORDER.filter((u) => u !== inputUnit.value).map((u) => ({
    unit: u,
    meta: UNIT_META[u],
    result: outputs.value[u],
    text: formatResultText(u),
  })),
);

function formatResultText(u: TemperatureUnit): string {
  const r = outputs.value[u];
  if (r === null) return '—';
  if (!r.ok) return '—';
  return formatNumber(r.result);
}

function copyText(u: TemperatureUnit): string {
  const r = outputs.value[u];
  if (r === null || !r.ok) return '';
  return `${formatNumber(r.result)} ${UNIT_META[u].symbol}`;
}
</script>

<template>
  <div class="tc">
    <ToolInput
      title="Temperature value"
      description="Enter a temperature and pick its unit — every other scale updates live."
    >
      <template #actions>
        <button
          type="button"
          class="tc__btn tc__btn--ghost"
          title="Reset all fields"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <div class="tc__row">
        <label class="tc__field tc__field--value">
          <span class="tc__label">Value</span>
          <div class="tc__input-wrap">
            <input
              type="number"
              class="tc__input"
              placeholder="e.g. 25"
              step="any"
              :value="inputValue"
              inputmode="decimal"
              @input="onInput"
            />
            <span class="tc__input-suffix">{{ inputSymbol }}</span>
          </div>
        </label>
        <label class="tc__field tc__field--unit">
          <span class="tc__label">Unit</span>
          <select class="tc__select" :value="inputUnit" @change="onUnit">
            <option v-for="u in UNIT_ORDER" :key="u" :value="u">
              {{ UNIT_META[u].name }} ({{ UNIT_META[u].symbol }})
            </option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Conversions"
      :description="
        isEmpty
          ? 'Enter a value to see all conversions.'
          : belowAbsoluteZero
            ? 'Below absolute zero — values are mathematically valid but physically impossible.'
            : 'Live conversions across all eight temperature scales.'
      "
    >
      <p v-if="belowAbsoluteZero && !isEmpty" class="tc__warn">
        <AlertTriangle :size="14" />
        <span>Below absolute zero (0 K) — physically impossible.</span>
      </p>
      <p v-else-if="isEmpty" class="tc__empty">
        Enter a value to see all conversions.
      </p>
      <ul v-else class="tc__grid">
        <li v-for="row in outputRows" :key="row.unit" class="tc__cell">
          <div class="tc__cell-head">
            <span class="tc__cell-name">{{ row.meta.name }}</span>
            <span class="tc__cell-symbol">{{ row.meta.symbol }}</span>
          </div>
          <div class="tc__cell-body">
            <span class="tc__cell-value">{{ row.text }}</span>
            <CopyButton
              :text="copyText(row.unit)"
              label="Copy"
              icon-only
            />
          </div>
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.tc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.tc__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.tc__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tc__field--value {
  flex: 2;
  min-width: 180px;
}
.tc__field--unit {
  flex: 1;
  min-width: 160px;
}
.tc__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.tc__input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.tc__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 38px 8px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.tc__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.tc__input-suffix {
  position: absolute;
  right: 10px;
  color: var(--qt-muted);
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
}
.tc__select {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.tc__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.tc__btn {
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
.tc__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.tc__btn--ghost:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.tc__warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--qt-warning, #c47f00);
  font-size: 13.5px;
  line-height: 1.4;
}
.tc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.tc__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.tc__cell {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tc__cell-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}
.tc__cell-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.tc__cell-symbol {
  font-size: 12px;
  color: var(--qt-muted);
  font-weight: 700;
}
.tc__cell-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tc__cell-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--qt-text);
  word-break: break-word;
}
</style>
