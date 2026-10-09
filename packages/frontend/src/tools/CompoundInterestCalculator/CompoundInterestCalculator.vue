<script setup lang="ts">
/**
 * CompoundInterestCalculator - compound interest with optional contributions.
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
  useCompoundInterestCalculator,
  formatCurrency,
  type CompoundingFrequency,
  type ContributionFrequency,
} from './useCompoundInterestCalculator';

const {
  principal,
  annualRate,
  years,
  compoundingFreq,
  contribution,
  contributionFreq,
  snapshot,
  reset,
} = useCompoundInterestCalculator();

const { t } = useI18n();
const U = 'tools.compound-interest-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatCurrency(snapshot.value.finalAmount);
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
        <ToolField v-model="principal" :label="t(U + 'principal')" type="number" :placeholder="t(U + 'phPrincipal')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="annualRate" :label="t(U + 'annualRate')" type="number" :placeholder="t(U + 'phRate')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="years" :label="t(U + 'years')" type="number" :placeholder="t(U + 'phYears')" step="any" min="0" inputmode="decimal" grow />
      </div>

      <label class="qt-field qt-field--grow" style="flex-basis:100%">
        <span class="qt-label">{{ t(U + 'compounding') }}</span>
        <select class="qt-input" style="font-size:14px;padding:8px 10px" :value="compoundingFreq" @change="(e) => compoundingFreq = (e.target as HTMLSelectElement).value as CompoundingFrequency">
          <option value="1">{{ t(U + 'freqAnnually') }}</option>
          <option value="2">{{ t(U + 'freqSemi') }}</option>
          <option value="4">{{ t(U + 'freqQuarterly') }}</option>
          <option value="12">{{ t(U + 'freqMonthly') }}</option>
          <option value="52">{{ t(U + 'freqWeekly') }}</option>
          <option value="365">{{ t(U + 'freqDaily') }}</option>
        </select>
      </label>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="contribution" :label="t(U + 'contribution')" type="number" :placeholder="t(U + 'phContribution')" step="any" min="0" inputmode="decimal" grow />
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'contributionFreq') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 10px" :value="contributionFreq" @change="(e) => contributionFreq = (e.target as HTMLSelectElement).value as ContributionFrequency">
            <option value="none">{{ t(U + 'cfNone') }}</option>
            <option value="1">{{ t(U + 'cfAnnually') }}</option>
            <option value="12">{{ t(U + 'cfMonthly') }}</option>
            <option value="52">{{ t(U + 'cfWeekly') }}</option>
            <option value="365">{{ t(U + 'cfDaily') }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isEmpty ? t(U + 'descEmpty') : hasError ? t(U + 'descError') : t(U + 'descOk')"
      :copy-text="copyText"
      :copy-label="t(U + 'copyAmount')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <ResultRow :label="t(U + 'rFinal')" :value="formatCurrency(snapshot!.finalAmount)" />
          <ResultRow :label="t(U + 'rTotalInterest')" :value="formatCurrency(snapshot!.totalInterest)" />
          <ResultRow :label="t(U + 'rTotalContrib')" :value="formatCurrency(snapshot!.totalContributions)" />
          <ResultRow :label="t(U + 'rPrincipal')" :value="formatCurrency(snapshot!.principal)" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>
