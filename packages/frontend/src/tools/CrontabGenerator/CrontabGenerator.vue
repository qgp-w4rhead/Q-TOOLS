<script setup lang="ts">
/**
 * CrontabGenerator — visual cron expression builder.
 *
 * Five field editors (minute, hour, day-of-month, month, day-of-week), each
 * with a mode selector (every / specific / range / step / range-step) and the
 * appropriate value inputs. The composed cron expression and a plain-English
 * description update live. A raw-expression input lets advanced users paste an
 * existing cron string and edit it visually.
 *
 * Works in embed mode: receives `input` PostMessages with `{ expression }` or
 * `{ fields: { ... } }` and sends `output` PostMessages with
 * `{ expression, description }` whenever the expression changes.
 */
import { computed, ref } from 'vue';
import { AlertCircle, RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useCrontabGenerator,
  FIELD_ORDER,
  FIELD_BOUNDS,
  parseCronExpression,
  type CronFieldName,
  type CronFieldMode,
} from './useCrontabGenerator';

const {
  fields,
  expression,
  description,
  validation,
  isValid,
  setFieldMode,
  setFieldValue,
  reset,
} = useCrontabGenerator();

const MODE_OPTIONS: { value: CronFieldMode; label: string }[] = [
  { value: 'every', label: 'Every' },
  { value: 'specific', label: 'Specific' },
  { value: 'range', label: 'Range' },
  { value: 'step', label: 'Every N' },
  { value: 'rangeStep', label: 'Range / N' },
];

/** Raw expression text input — applied on Enter or button click. */
const rawExpression = ref('');
const rawError = ref('');

function applyRaw(): void {
  const trimmed = rawExpression.value.trim();
  if (!trimmed) {
    rawError.value = 'Enter a cron expression (5 whitespace-separated fields).';
    return;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    rawError.value = `Expected 5 fields, got ${parts.length}.`;
    return;
  }
  try {
    const parsed = parseCronExpression(trimmed);
    fields.value = parsed;
    rawError.value = '';
  } catch (e) {
    rawError.value = (e as Error).message;
  }
}

/** Add a value to a "specific" field's value list (first unused value). */
function addSpecificValue(name: CronFieldName): void {
  const b = FIELD_BOUNDS[name];
  const current = fields.value[name];
  // Pick the first value in the field's range that isn't already selected.
  let next = b.min;
  for (let v = b.min; v <= b.max; v++) {
    if (!current.values.includes(v)) {
      next = v;
      break;
    }
  }
  setFieldValue(name, 'values', [...current.values, next]);
}

function removeSpecificValue(name: CronFieldName, v: number): void {
  const current = fields.value[name];
  setFieldValue(
    name,
    'values',
    current.values.filter((x) => x !== v),
  );
}

function onSpecificValueInput(
  name: CronFieldName,
  index: number,
  e: Event,
): void {
  const v = Number((e.target as HTMLInputElement).value);
  const current = fields.value[name];
  const next = [...current.values];
  next[index] = Number.isNaN(v) ? FIELD_BOUNDS[name].min : v;
  setFieldValue(name, 'values', next);
}

function onNumberInput(
  name: CronFieldName,
  key: 'rangeStart' | 'rangeEnd' | 'step',
  e: Event,
): void {
  const v = Number((e.target as HTMLInputElement).value);
  const b = FIELD_BOUNDS[name];
  setFieldValue(name, key, Number.isNaN(v) ? b.min : v);
}

/** Build a value option list for a `<select>` of all valid values. */
function valueOptions(name: CronFieldName): { value: number; label: string }[] {
  const b = FIELD_BOUNDS[name];
  const out: { value: number; label: string }[] = [];
  for (let v = b.min; v <= b.max; v++) {
    out.push({ value: v, label: b.names ? b.names[v - b.min]! : String(v) });
  }
  return out;
}

const expressionFields = computed(() =>
  FIELD_ORDER.map((name) => ({
    name,
    bounds: FIELD_BOUNDS[name],
    config: fields.value[name],
    fragment: expression.value.split(' ')[FIELD_ORDER.indexOf(name)],
  })),
);
</script>

<template>
  <div class="cron-gen">
    <ToolInput
      title="Cron fields"
      description="Build a 5-field cron expression: minute hour day-of-month month day-of-week."
    >
      <template #actions>
        <button class="cron-gen__reset" type="button" @click="reset">
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <div class="cron-gen__fields">
        <section
          v-for="f in expressionFields"
          :key="f.name"
          class="cron-gen__field"
        >
          <header class="cron-gen__field-header">
            <h3 class="cron-gen__field-title">{{ f.bounds.label }}</h3>
            <code class="cron-gen__field-frag">{{ f.fragment }}</code>
          </header>

          <label class="cron-gen__row">
            <span class="cron-gen__label">Mode</span>
            <select
              class="cron-gen__select"
              :value="f.config.mode"
              @change="
                setFieldMode(
                  f.name,
                  ($event.target as HTMLSelectElement).value as CronFieldMode,
                )
              "
            >
              <option v-for="o in MODE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </label>

          <!-- Every -->
          <p v-if="f.config.mode === 'every'" class="cron-gen__hint">
            Matches every {{ f.bounds.unit }} ({{ f.bounds.min }}–{{
              f.bounds.max
            }}).
          </p>

          <!-- Specific (list) -->
          <div v-else-if="f.config.mode === 'specific'" class="cron-gen__specific">
            <div
              v-for="(v, i) in f.config.values"
              :key="i"
              class="cron-gen__specific-row"
            >
              <select
                class="cron-gen__select"
                :value="v"
                @change="onSpecificValueInput(f.name, i, $event)"
              >
                <option
                  v-for="o in valueOptions(f.name)"
                  :key="o.value"
                  :value="o.value"
                >
                  {{ o.label }}
                </option>
              </select>
              <button
                type="button"
                class="cron-gen__chip-btn cron-gen__chip-btn--remove"
                :disabled="f.config.values.length <= 1"
                :title="`Remove ${v}`"
                @click="removeSpecificValue(f.name, v)"
              >
                ×
              </button>
            </div>
            <button
              type="button"
              class="cron-gen__chip-btn"
              @click="addSpecificValue(f.name)"
            >
              + Add value
            </button>
          </div>

          <!-- Range -->
          <div v-else-if="f.config.mode === 'range'" class="cron-gen__pair">
            <label class="cron-gen__row">
              <span class="cron-gen__label">From</span>
              <select
                class="cron-gen__select"
                :value="f.config.rangeStart"
                @change="onNumberInput(f.name, 'rangeStart', $event)"
              >
                <option
                  v-for="o in valueOptions(f.name)"
                  :key="o.value"
                  :value="o.value"
                >
                  {{ o.label }}
                </option>
              </select>
            </label>
            <label class="cron-gen__row">
              <span class="cron-gen__label">To</span>
              <select
                class="cron-gen__select"
                :value="f.config.rangeEnd"
                @change="onNumberInput(f.name, 'rangeEnd', $event)"
              >
                <option
                  v-for="o in valueOptions(f.name)"
                  :key="o.value"
                  :value="o.value"
                >
                  {{ o.label }}
                </option>
              </select>
            </label>
          </div>

          <!-- Step (every N across whole range) -->
          <label v-else-if="f.config.mode === 'step'" class="cron-gen__row">
            <span class="cron-gen__label">Every</span>
            <input
              class="cron-gen__input"
              type="number"
              :min="1"
              :max="f.bounds.max - f.bounds.min + 1"
              :value="f.config.step"
              @input="onNumberInput(f.name, 'step', $event)"
            />
            <span class="cron-gen__suffix">{{ f.bounds.unitPlural }}</span>
          </label>

          <!-- Range + step -->
          <div v-else-if="f.config.mode === 'rangeStep'" class="cron-gen__range-step">
            <div class="cron-gen__pair">
              <label class="cron-gen__row">
                <span class="cron-gen__label">From</span>
                <select
                  class="cron-gen__select"
                  :value="f.config.rangeStart"
                  @change="onNumberInput(f.name, 'rangeStart', $event)"
                >
                  <option
                    v-for="o in valueOptions(f.name)"
                    :key="o.value"
                    :value="o.value"
                  >
                    {{ o.label }}
                  </option>
                </select>
              </label>
              <label class="cron-gen__row">
                <span class="cron-gen__label">To</span>
                <select
                  class="cron-gen__select"
                  :value="f.config.rangeEnd"
                  @change="onNumberInput(f.name, 'rangeEnd', $event)"
                >
                  <option
                    v-for="o in valueOptions(f.name)"
                    :key="o.value"
                    :value="o.value"
                  >
                    {{ o.label }}
                  </option>
                </select>
              </label>
            </div>
            <label class="cron-gen__row">
              <span class="cron-gen__label">Every</span>
              <input
                class="cron-gen__input"
                type="number"
                :min="1"
                :max="f.bounds.max - f.bounds.min + 1"
                :value="f.config.step"
                @input="onNumberInput(f.name, 'step', $event)"
              />
              <span class="cron-gen__suffix">{{ f.bounds.unitPlural }}</span>
            </label>
          </div>
        </section>
      </div>

      <details class="cron-gen__raw">
        <summary class="cron-gen__raw-summary">Paste raw expression</summary>
        <div class="cron-gen__raw-row">
          <input
            v-model="rawExpression"
            class="cron-gen__input cron-gen__raw-input"
            type="text"
            placeholder="*/5 9-17 * * 1-5"
            @keydown.enter.prevent="applyRaw"
          />
          <button class="cron-gen__apply" type="button" @click="applyRaw">
            Apply
          </button>
        </div>
        <p v-if="rawError" class="cron-gen__raw-error">{{ rawError }}</p>
      </details>
    </ToolInput>

    <ToolOutput
      title="Cron expression"
      :copy-text="expression"
      copy-label="Copy cron"
    >
      <p v-if="!isValid" class="cron-gen__error">
        <AlertCircle :size="14" />
        <span>{{ validation.message }}</span>
      </p>
      <code class="cron-gen__expression">{{ expression }}</code>
      <p class="cron-gen__description">{{ description }}</p>
      <div class="cron-gen__legend">
        <span class="cron-gen__legend-item"><code>m</code> minute</span>
        <span class="cron-gen__legend-item"><code>h</code> hour</span>
        <span class="cron-gen__legend-item"><code>dom</code> day</span>
        <span class="cron-gen__legend-item"><code>mon</code> month</span>
        <span class="cron-gen__legend-item"><code>dow</code> weekday</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.cron-gen {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.cron-gen__fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.cron-gen__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
}
.cron-gen__field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cron-gen__field-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}
.cron-gen__field-frag {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 90% c h / 0.12);
  border: 1px solid oklch(from var(--qt-accent) 60% c h / 0.4);
  border-radius: 999px;
  padding: 1px 8px;
  font-variant-numeric: tabular-nums;
}
.cron-gen__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cron-gen__label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
  min-width: 48px;
}
.cron-gen__select,
.cron-gen__input {
  flex: 1 1 auto;
  min-width: 0;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13.5px;
  padding: 6px 8px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.cron-gen__select:focus,
.cron-gen__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.cron-gen__suffix {
  font-size: 12.5px;
  color: var(--qt-muted);
}
.cron-gen__hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.cron-gen__pair {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cron-gen__range-step {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cron-gen__specific {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cron-gen__specific-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cron-gen__chip-btn {
  padding: 4px 10px;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-text);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}
.cron-gen__chip-btn:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.cron-gen__chip-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cron-gen__chip-btn--remove {
  padding: 2px 8px;
  font-size: 14px;
  line-height: 1;
}
.cron-gen__chip-btn--remove:hover:not(:disabled) {
  border-color: var(--qt-danger);
  color: var(--qt-danger);
}
.cron-gen__reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}
.cron-gen__reset:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.cron-gen__raw {
  margin-top: 12px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.cron-gen__raw-summary {
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.cron-gen__raw-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.cron-gen__raw-input {
  flex: 1 1 auto;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
}
.cron-gen__apply {
  padding: 6px 12px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.cron-gen__apply:hover {
  opacity: 0.9;
}
.cron-gen__raw-error {
  margin: 6px 0 0 0;
  color: var(--qt-danger);
  font-size: 12.5px;
}
.cron-gen__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.cron-gen__expression {
  display: block;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 22px;
  font-weight: 700;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 12px 14px;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}
.cron-gen__description {
  margin: 10px 0 0 0;
  font-size: 14px;
  color: var(--qt-text);
  line-height: 1.5;
}
.cron-gen__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--qt-muted);
}
.cron-gen__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cron-gen__legend-item code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 4px;
  padding: 0 5px;
  color: var(--qt-text);
}
</style>
