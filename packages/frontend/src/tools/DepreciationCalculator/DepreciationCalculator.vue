<script setup lang="ts">
/**
 * DepreciationCalculator - straight-line / declining-balance / sum-of-years depreciation schedules.
 */
import { RotateCcw } from 'lucide-vue-next';
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
  useDepreciationCalculator,
  formatCurrency,
  type DepreciationMethod,
} from './useDepreciationCalculator';

const { cost, salvageValue, usefulLife, method, rate, snapshot, reset } = useDepreciationCalculator();

const { t } = useI18n();
const U = 'tools.depreciation-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);
const showRate = computed(() => method.value === 'declining-balance');

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatCurrency(snapshot.value.totalDepreciation);
});

const methodOptions = computed<Array<{ id: DepreciationMethod; label: string }>>(() => [
  { id: 'straight-line', label: t(U + 'mStraight') },
  { id: 'declining-balance', label: t(U + 'mDeclining') },
  { id: 'sum-of-years', label: t(U + 'mSumOfYears') },
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

      <SegmentedControl v-model="method" :options="methodOptions" />

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="cost" :label="t(U + 'cost')" type="number" :placeholder="t(U + 'phCost')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="salvageValue" :label="t(U + 'salvage')" type="number" :placeholder="t(U + 'phSalvage')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="usefulLife" :label="t(U + 'life')" type="number" :placeholder="t(U + 'phLife')" step="1" min="1" inputmode="numeric" grow />
        <ToolField v-if="showRate" v-model="rate" :label="t(U + 'rate')" type="number" :placeholder="t(U + 'phRate')" step="any" min="0" inputmode="decimal" grow />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isEmpty ? t(U + 'descEmpty') : hasError ? t(U + 'descError') : t(U + 'descOk')"
      :copy-text="copyText"
      :copy-label="t(U + 'copyTotal')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px;margin-bottom:12px">
          <ResultRow :label="t(U + 'rAnnual')" :value="formatCurrency(snapshot!.annualDepreciation)" />
          <ResultRow :label="t(U + 'rTotal')" :value="formatCurrency(snapshot!.totalDepreciation)" />
          <ResultRow :label="t(U + 'rFinalBook')" :value="formatCurrency(snapshot!.schedule[snapshot!.schedule.length - 1]?.bookValue ?? snapshot!.cost)" />
        </div>

        <div class="qt-panel" style="padding:0;overflow-x:auto">
          <table class="dc__table">
            <thead>
              <tr>
                <th>{{ t(U + 'colYear') }}</th>
                <th>{{ t(U + 'colDepreciation') }}</th>
                <th>{{ t(U + 'colAccumulated') }}</th>
                <th>{{ t(U + 'colBookValue') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in snapshot!.schedule" :key="row.year">
                <td>{{ row.year }}</td>
                <td>{{ formatCurrency(row.depreciation) }}</td>
                <td>{{ formatCurrency(row.accumulatedDepreciation) }}</td>
                <td>{{ formatCurrency(row.bookValue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: real <table> cell styles (unique pattern). */
.dc__table { width: 100%; border-collapse: collapse; font-size: 12.5px; font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; }
.dc__table th, .dc__table td { padding: 6px 10px; text-align: right; border-bottom: 1px solid var(--qt-border); }
.dc__table th { font-weight: 700; color: var(--qt-muted); }
.dc__table td:first-child, .dc__table th:first-child { text-align: center; }
</style>
