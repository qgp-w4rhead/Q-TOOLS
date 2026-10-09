<script setup lang="ts">
/**
 * LoanCalculator - loan / mortgage calculator with amortization schedule.
 *
 * Inputs: principal, annual interest rate, term (years or months).
 * Outputs: monthly payment, total payment, total interest, amortization table.
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
  useLoanCalculator,
  formatCurrency,
  formatNumber,
  type TermUnit,
} from './useLoanCalculator';

const {
  principal,
  annualRate,
  term,
  termUnit,
  snapshot,
  reset,
} = useLoanCalculator();

const { t } = useI18n();
const U = 'tools.loan-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatCurrency(snapshot.value.monthlyPayment);
});

const termUnitOptions = computed<Array<{ id: TermUnit; label: string }>>(() => [
  { id: 'years', label: t(U + 'unitYears') },
  { id: 'months', label: t(U + 'unitMonths') },
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

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField
          v-model="principal"
          :label="t(U + 'principal')"
          type="number"
          :placeholder="t(U + 'phPrincipal')"
          step="any"
          min="0"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="annualRate"
          :label="t(U + 'annualRate')"
          type="number"
          :placeholder="t(U + 'phRate')"
          step="any"
          min="0"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="term"
          :label="t(U + 'term')"
          type="number"
          :placeholder="t(U + 'phTerm')"
          step="any"
          min="0"
          inputmode="decimal"
          grow
        />
      </div>

      <SegmentedControl v-model="termUnit" :options="termUnitOptions" />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="
        isEmpty
          ? t(U + 'descEmpty')
          : hasError
            ? t(U + 'descError')
            : t(U + 'descOk')
      "
      :copy-text="copyText"
      :copy-label="t(U + 'copyPayment')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">
        {{ t(U + 'alertEmpty') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <ResultRow :label="t(U + 'rMonthly')" :value="formatCurrency(snapshot!.monthlyPayment)" />
          <ResultRow :label="t(U + 'rTotalPayment')" :value="formatCurrency(snapshot!.totalPayment)" />
          <ResultRow :label="t(U + 'rTotalInterest')" :value="formatCurrency(snapshot!.totalInterest)" />
          <ResultRow :label="t(U + 'rPayments')" :value="formatNumber(snapshot!.numberOfPayments)" />
        </div>

        <details class="lc__schedule">
          <summary>{{ t(U + 'scheduleSummary', { n: snapshot!.schedule.length }) }}</summary>
          <div class="qt-panel" style="padding:0;overflow:auto;max-height:400px">
            <table class="lc__table">
              <thead>
                <tr>
                  <th>{{ t(U + 'colNum') }}</th>
                  <th>{{ t(U + 'colBalance') }}</th>
                  <th>{{ t(U + 'colPayment') }}</th>
                  <th>{{ t(U + 'colInterest') }}</th>
                  <th>{{ t(U + 'colPrincipal') }}</th>
                  <th>{{ t(U + 'colEnding') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in snapshot!.schedule" :key="row.payment">
                  <td>{{ row.payment }}</td>
                  <td>{{ formatCurrency(row.balance) }}</td>
                  <td>{{ formatCurrency(row.paymentAmount) }}</td>
                  <td>{{ formatCurrency(row.interest) }}</td>
                  <td>{{ formatCurrency(row.principal) }}</td>
                  <td>{{ formatCurrency(row.endingBalance) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: details/summary disclosure + real <table> cell styles. */
.lc__schedule {
  margin-top: 4px;
}
.lc__schedule > summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--qt-muted);
  padding: 6px 0;
}
.lc__schedule > summary:hover {
  color: var(--qt-text);
}
.lc__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.lc__table th,
.lc__table td {
  padding: 6px 10px;
  text-align: right;
  border-bottom: 1px solid var(--qt-border);
}
.lc__table th {
  position: sticky;
  top: 0;
  background: var(--qt-surface);
  font-weight: 700;
  color: var(--qt-muted);
  z-index: 1;
}
.lc__table td:first-child,
.lc__table th:first-child {
  text-align: center;
}
.lc__table tbody tr:hover {
  background: oklch(from var(--qt-accent) 90% c h / 0.05);
}
</style>
