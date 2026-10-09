<script setup lang="ts">
/**
 * CrontabGenerator - visual cron expression builder.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.crontab-generator.ui.';

const MODE_OPTIONS = computed<{ value: CronFieldMode; label: string }[]>(() => [
  { value: 'every', label: t(U + 'modeEvery') },
  { value: 'specific', label: t(U + 'modeSpecific') },
  { value: 'range', label: t(U + 'modeRange') },
  { value: 'step', label: t(U + 'modeStep') },
  { value: 'rangeStep', label: t(U + 'modeRangeStep') },
]);

/** Raw expression text input - applied on Enter or button click. */
const rawExpression = ref('');
const rawError = ref('');

function applyRaw(): void {
  const trimmed = rawExpression.value.trim();
  if (!trimmed) {
    rawError.value = t(U + 'errEmpty');
    return;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    rawError.value = t(U + 'errFields', { n: parts.length });
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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button class="qt-btn qt-btn--ghost qt-btn--sm" type="button" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <div class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:12px">
        <section
          v-for="f in expressionFields"
          :key="f.name"
          class="qt-panel qt-stack"
          style="--qt-stack-gap:8px;padding:10px 12px"
        >
          <header class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px">
            <h3 style="margin:0;font-size:13px;font-weight:700;color:var(--qt-text)">{{ f.bounds.label }}</h3>
            <code class="qt-badge qt-badge--info" style="font-family:var(--qt-font-mono);font-variant-numeric:tabular-nums">{{ f.fragment }}</code>
          </header>

          <label class="qt-row qt-row--center" style="--qt-row-gap:8px">
            <span class="qt-label" style="min-width:48px">{{ t(U + 'mode') }}</span>
            <select
              class="qt-input"
              style="flex:1;min-width:0;font-size:13.5px;padding:6px 8px"
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
          <p v-if="f.config.mode === 'every'" class="qt-hint" style="margin:0;font-size:12.5px">
            {{ t(U + 'matchesEvery', { unit: f.bounds.unit, min: f.bounds.min, max: f.bounds.max }) }}
          </p>

          <!-- Specific (list) -->
          <div v-else-if="f.config.mode === 'specific'" class="qt-stack" style="--qt-stack-gap:6px">
            <div
              v-for="(v, i) in f.config.values"
              :key="i"
              class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:6px"
            >
              <select
                class="qt-input"
                style="flex:1;min-width:0;font-size:13.5px;padding:6px 8px"
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
                class="qt-chip qt-chip--filled cron-gen__chip-btn--remove"
                style="padding:2px 8px;font-size:14px;line-height:1"
                :disabled="f.config.values.length <= 1"
                :title="t(U + 'removeValue', { v })"
                @click="removeSpecificValue(f.name, v)"
              >
                ×
              </button>
            </div>
            <button
              type="button"
              class="qt-chip qt-chip--filled"
              @click="addSpecificValue(f.name)"
            >
              {{ t(U + 'addValue') }}
            </button>
          </div>

          <!-- Range -->
          <div v-else-if="f.config.mode === 'range'" class="qt-stack" style="--qt-stack-gap:8px">
            <label class="qt-row qt-row--center" style="--qt-row-gap:8px">
              <span class="qt-label" style="min-width:48px">{{ t(U + 'from') }}</span>
              <select
                class="qt-input"
                style="flex:1;min-width:0;font-size:13.5px;padding:6px 8px"
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
            <label class="qt-row qt-row--center" style="--qt-row-gap:8px">
              <span class="qt-label" style="min-width:48px">{{ t(U + 'to') }}</span>
              <select
                class="qt-input"
                style="flex:1;min-width:0;font-size:13.5px;padding:6px 8px"
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
          <label v-else-if="f.config.mode === 'step'" class="qt-row qt-row--center" style="--qt-row-gap:8px">
            <span class="qt-label" style="min-width:48px">{{ t(U + 'every') }}</span>
            <input
              class="qt-input"
              style="flex:1;min-width:0;font-size:13.5px;padding:6px 8px"
              type="number"
              :min="1"
              :max="f.bounds.max - f.bounds.min + 1"
              :value="f.config.step"
              @input="onNumberInput(f.name, 'step', $event)"
            />
            <span style="font-size:12.5px;color:var(--qt-muted)">{{ f.bounds.unitPlural }}</span>
          </label>

          <!-- Range + step -->
          <div v-else-if="f.config.mode === 'rangeStep'" class="qt-stack" style="--qt-stack-gap:8px">
            <div class="qt-stack" style="--qt-stack-gap:8px">
              <label class="qt-row qt-row--center" style="--qt-row-gap:8px">
                <span class="qt-label" style="min-width:48px">{{ t(U + 'from') }}</span>
                <select
                  class="qt-input"
                  style="flex:1;min-width:0;font-size:13.5px;padding:6px 8px"
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
              <label class="qt-row qt-row--center" style="--qt-row-gap:8px">
                <span class="qt-label" style="min-width:48px">{{ t(U + 'to') }}</span>
                <select
                  class="qt-input"
                  style="flex:1;min-width:0;font-size:13.5px;padding:6px 8px"
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
            <label class="qt-row qt-row--center" style="--qt-row-gap:8px">
              <span class="qt-label" style="min-width:48px">{{ t(U + 'every') }}</span>
              <input
                class="qt-input"
                style="flex:1;min-width:0;font-size:13.5px;padding:6px 8px"
                type="number"
                :min="1"
                :max="f.bounds.max - f.bounds.min + 1"
                :value="f.config.step"
                @input="onNumberInput(f.name, 'step', $event)"
              />
              <span style="font-size:12.5px;color:var(--qt-muted)">{{ f.bounds.unitPlural }}</span>
            </label>
          </div>
        </section>
      </div>

      <details class="qt-panel" style="margin-top:12px;padding:8px 10px">
        <summary class="qt-label" style="cursor:pointer">{{ t(U + 'rawSummary') }}</summary>
        <div class="qt-row" style="--qt-row-gap:8px;margin-top:8px">
          <input
            v-model="rawExpression"
            class="qt-input qt-input--mono"
            style="flex:1"
            type="text"
            :placeholder="t(U + 'phRaw')"
            @keydown.enter.prevent="applyRaw"
          />
          <button class="qt-btn qt-btn--primary" style="font-size:12.5px;padding:6px 12px" type="button" @click="applyRaw">
            {{ t(U + 'apply') }}
          </button>
        </div>
        <p v-if="rawError" class="qt-alert qt-alert--error" style="margin:6px 0 0;font-size:12.5px">{{ rawError }}</p>
      </details>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :copy-text="expression"
      :copy-label="t(U + 'copyCron')"
    >
      <p v-if="!isValid" class="qt-alert qt-alert--error" style="align-items:center;margin:0 0 8px">
        <AlertCircle :size="14" />
        <span>{{ validation.message }}</span>
      </p>
      <code class="qt-output" style="display:block;font-size:22px;font-weight:700;letter-spacing:0.04em;font-variant-numeric:tabular-nums;word-break:break-all;white-space:pre-wrap">{{ expression }}</code>
      <p style="margin:10px 0 0;font-size:14px;color:var(--qt-text);line-height:1.5">{{ description }}</p>
      <div class="qt-row" style="--qt-row-gap:8px 14px;margin-top:10px;font-size:11.5px;color:var(--qt-muted)">
        <span class="qt-row qt-row--center" style="--qt-row-gap:4px;display:inline-flex"><code class="qt-kbd" style="padding:0 5px">m</code> {{ t(U + 'legMinute') }}</span>
        <span class="qt-row qt-row--center" style="--qt-row-gap:4px;display:inline-flex"><code class="qt-kbd" style="padding:0 5px">h</code> {{ t(U + 'legHour') }}</span>
        <span class="qt-row qt-row--center" style="--qt-row-gap:4px;display:inline-flex"><code class="qt-kbd" style="padding:0 5px">dom</code> {{ t(U + 'legDay') }}</span>
        <span class="qt-row qt-row--center" style="--qt-row-gap:4px;display:inline-flex"><code class="qt-kbd" style="padding:0 5px">mon</code> {{ t(U + 'legMonth') }}</span>
        <span class="qt-row qt-row--center" style="--qt-row-gap:4px;display:inline-flex"><code class="qt-kbd" style="padding:0 5px">dow</code> {{ t(U + 'legWeekday') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Remove-value chip — danger hover (overrides the accent hover on .qt-chip). */
.cron-gen__chip-btn--remove:hover:not(:disabled) {
  border-color: var(--qt-danger);
  color: var(--qt-danger);
}
</style>
