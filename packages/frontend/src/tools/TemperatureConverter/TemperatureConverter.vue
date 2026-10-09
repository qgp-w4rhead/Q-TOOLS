<script setup lang="ts">
/**
 * TemperatureConverter - convert a temperature value between eight scales.
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
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useTemperatureConverter,
  formatNumber,
  UNIT_ORDER,
  UNIT_META,
  type TemperatureUnit,
} from './useTemperatureConverter';

const { t } = useI18n();
const U = 'tools.temperature-converter.ui.';

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
  if (r === null) return '-';
  if (!r.ok) return '-';
  return formatNumber(r.result);
}

function copyText(u: TemperatureUnit): string {
  const r = outputs.value[u];
  if (r === null || !r.ok) return '';
  return `${formatNumber(r.result)} ${UNIT_META[u].symbol}`;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.resetDefaults')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row">
        <label class="qt-field" style="flex:2;min-width:180px">
          <span class="qt-label">{{ t('common.value') }}</span>
          <div class="qt-input-wrap">
            <input
              type="number"
              class="qt-input"
              style="padding-right:38px"
              :placeholder="t(U + 'phValue')"
              step="any"
              :value="inputValue"
              inputmode="decimal"
              @input="onInput"
            />
            <span class="qt-input-suffix" style="font-size:13px;font-weight:600">{{ inputSymbol }}</span>
          </div>
        </label>
        <label class="qt-field" style="flex:1;min-width:160px">
          <span class="qt-label">{{ t('common.unit') }}</span>
          <select class="qt-input" :value="inputUnit" @change="onUnit">
            <option v-for="u in UNIT_ORDER" :key="u" :value="u">
              {{ UNIT_META[u].name }} ({{ UNIT_META[u].symbol }})
            </option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="
        isEmpty
          ? t(U + 'descEmpty')
          : belowAbsoluteZero
            ? t(U + 'descBelow')
            : t(U + 'descOk')
      "
    >
      <p v-if="belowAbsoluteZero && !isEmpty" class="qt-alert qt-alert--warn" style="margin:0 0 10px">
        <AlertTriangle :size="14" />
        <span>{{ t(U + 'alertBelow') }}</span>
      </p>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <ul v-else class="qt-list qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:8px">
        <li v-for="row in outputRows" :key="row.unit" class="qt-result" style="padding:10px 12px;gap:6px">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px">
            <span class="qt-label">{{ row.meta.name }}</span>
            <span style="font-size:12px;color:var(--qt-muted);font-weight:700">{{ row.meta.symbol }}</span>
          </div>
          <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;flex-wrap:nowrap">
            <span class="qt-value">{{ row.text }}</span>
            <CopyButton
              :text="copyText(row.unit)"
              :label="t('common.copy')"
              icon-only
            />
          </div>
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>
