<script setup lang="ts">
/**
 * PercentageCalculator - three-mode percentage calculator.
 *
 * Modes:
 *   - **ofTotal**    - "X is what % of Y"
 *   - **percentValue** - "X% of Y is"
 *   - **change**     - "% increase/decrease from X to Y"
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the fields
 * and sends `output` PostMessages whenever the result changes.
 */
import { RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import ToolAlert from '@/components/ToolAlert.vue';
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

const { t } = useI18n();
const U = 'tools.percentage-calculator.ui.';

const hasError = computed(
  () => snapshot.value !== null && !snapshot.value.ok,
);
const isEmpty = computed(() => snapshot.value === null);

const resultText = computed(() => {
  if (snapshot.value === null) return '-';
  if (!snapshot.value.ok) return '-';
  return formatNumber(snapshot.value.result);
});

const resultSuffix = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  if (mode.value === 'ofTotal' || mode.value === 'change') return '%';
  return '';
});

const directionKey = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  if (mode.value !== 'change') return '';
  const dir = snapshot.value.direction;
  if (dir === 'increase') return 'increase';
  if (dir === 'decrease') return 'decrease';
  return 'no-change';
});
const directionLabel = computed(() => {
  const k = directionKey.value;
  if (k === 'increase') return t(U + 'dirIncrease');
  if (k === 'decrease') return t(U + 'dirDecrease');
  if (k === 'no-change') return t(U + 'dirNoChange');
  return '';
});

const resultSentence = computed(() => {
  if (snapshot.value === null) return t(U + 'descEmpty');
  if (!snapshot.value.ok) return snapshot.value.message ?? t(U + 'errInvalid');
  const r = formatNumber(snapshot.value.result);
  if (mode.value === 'ofTotal') {
    const x = formatNumber(snapshot.value.inputs.x ?? NaN);
    const y = formatNumber(snapshot.value.inputs.y ?? NaN);
    return t(U + 'sentOfTotal', { x, r, y });
  }
  if (mode.value === 'percentValue') {
    const pct = formatNumber(snapshot.value.inputs.pct ?? NaN);
    const y = formatNumber(snapshot.value.inputs.y ?? NaN);
    return t(U + 'sentPercentValue', { pct, y, r });
  }
  const from = formatNumber(snapshot.value.inputs.from ?? NaN);
  const to = formatNumber(snapshot.value.inputs.to ?? NaN);
  const dir = snapshot.value.direction;
  const verb = dir === 'increase' ? t(U + 'verbIncrease') : dir === 'decrease' ? t(U + 'verbDecrease') : t(U + 'verbNoChange');
  return t(U + 'sentChange', { from, to, verb, r });
});

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return `${formatNumber(snapshot.value.result)}${resultSuffix.value}`;
});

const modeOptions = computed<Array<{ id: PercentMode; label: string }>>(() => [
  { id: 'ofTotal', label: t(U + 'modeOfTotal') },
  { id: 'percentValue', label: t(U + 'modePercentValue') },
  { id: 'change', label: t(U + 'modeChange') },
]);
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t(U + 'resetTitle')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <SegmentedControl v-model="mode" :options="modeOptions" />

      <div v-if="mode === 'ofTotal'" class="qt-row">
        <ToolField
          v-model="xOfTotal"
          :label="t(U + 'xPart')"
          type="number"
          placeholder="e.g. 25"
          step="any"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="yOfTotal"
          :label="t(U + 'yTotal')"
          type="number"
          placeholder="e.g. 200"
          step="any"
          inputmode="decimal"
          grow
        />
      </div>

      <div v-else-if="mode === 'percentValue'" class="qt-row">
        <ToolField
          v-model="pctValue"
          :label="t(U + 'pctX')"
          type="number"
          placeholder="e.g. 15"
          step="any"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="yValue"
          :label="t(U + 'yBase')"
          type="number"
          placeholder="e.g. 200"
          step="any"
          inputmode="decimal"
          grow
        />
      </div>

      <div v-else class="qt-row">
        <ToolField
          v-model="fromChange"
          :label="t(U + 'fromOriginal')"
          type="number"
          placeholder="e.g. 150"
          step="any"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="toChange"
          :label="t(U + 'toNew')"
          type="number"
          placeholder="e.g. 180"
          step="any"
          inputmode="decimal"
          grow
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="
        isEmpty
          ? t(U + 'descEmpty')
          : hasError
            ? t(U + 'descInvalid')
            : t(U + 'descDone')
      "
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">
        {{ t(U + 'descEmpty') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
          <span class="qt-mono" style="font-size:28px;font-weight:700;color:var(--qt-text);word-break:break-word">{{ resultText }}<span style="font-size:18px;font-weight:600;color:var(--qt-muted);margin-left:2px">{{ resultSuffix }}</span></span>
          <CopyButton :text="copyText" :label="t('common.copy')" icon-only />
        </div>
        <p style="margin:8px 0 0;font-size:13.5px;color:var(--qt-text);line-height:1.4">{{ resultSentence }}</p>
        <p v-if="directionLabel" class="pc__direction" :class="`pc__direction--${directionKey}`">
          {{ directionLabel }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Direction label — colored status text (increase/decrease/no-change). */
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
