<script setup lang="ts">
/**
 * BreakEvenCalculator - fixed costs + variable cost + price → break-even point.
 */
import { RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ResultRow from '@/components/ResultRow.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useBreakEvenCalculator,
  formatCurrency,
  formatNumber,
  formatPercent,
} from './useBreakEvenCalculator';

const { fixedCosts, variableCostPerUnit, pricePerUnit, snapshot, reset } = useBreakEvenCalculator();

const { t } = useI18n();
const U = 'tools.break-even-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatNumber(snapshot.value.breakEvenUnits);
});

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
        <ToolField v-model="fixedCosts" :label="t(U + 'fixed')" type="number" :placeholder="t(U + 'phFixed')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="variableCostPerUnit" :label="t(U + 'variable')" type="number" :placeholder="t(U + 'phVariable')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="pricePerUnit" :label="t(U + 'price')" type="number" :placeholder="t(U + 'phPrice')" step="any" min="0" inputmode="decimal" grow />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isEmpty ? t(U + 'descEmpty') : hasError ? t(U + 'descError') : t(U + 'descOk')"
      :copy-text="copyText"
      :copy-label="t(U + 'copyUnits')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <ResultRow style="border-width:2px;border-color:var(--qt-accent)" :label="t(U + 'rUnits')" :value="formatNumber(snapshot!.breakEvenUnits)" />
          <ResultRow :label="t(U + 'rRevenue')" :value="formatCurrency(snapshot!.breakEvenRevenue)" />
          <ResultRow :label="t(U + 'rMargin')" :value="formatCurrency(snapshot!.contributionMargin)" />
          <ResultRow :label="t(U + 'rRatio')" :value="formatPercent(snapshot!.contributionMarginRatio)" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>
