<script setup lang="ts">
/**
 * RoiCalculator - initial investment + final value → ROI%, annualized return, gain/loss.
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
  useRoiCalculator,
  formatCurrency,
  formatPercent,
} from './useRoiCalculator';

const { initialInvestment, finalValue, years, snapshot, reset } = useRoiCalculator();

const { t } = useI18n();
const U = 'tools.roi-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);
const isGain = computed(() => snapshot.value !== null && snapshot.value.ok && snapshot.value.gainLoss >= 0);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatPercent(snapshot.value.roi);
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
        <ToolField v-model="initialInvestment" :label="t(U + 'initial')" type="number" :placeholder="t(U + 'phInitial')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="finalValue" :label="t(U + 'final')" type="number" :placeholder="t(U + 'phFinal')" step="any" inputmode="decimal" grow />
        <ToolField v-model="years" :label="t(U + 'years')" type="number" :placeholder="t(U + 'phYears')" step="any" min="0" inputmode="decimal" grow />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isEmpty ? t(U + 'descEmpty') : hasError ? t(U + 'descError') : t(U + 'descOk')"
      :copy-text="copyText"
      :copy-label="t(U + 'copyRoi')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <ResultRow
            style="border-width:2px"
            :class="isGain ? 'rc__stat--gain' : 'rc__stat--loss'"
            :label="t(U + 'rRoi')"
            :value="formatPercent(snapshot!.roi)"
          />
          <ResultRow
            :class="isGain ? 'rc__stat--gain' : 'rc__stat--loss'"
            :label="isGain ? t(U + 'rGain') : t(U + 'rLoss')"
            :value="formatCurrency(snapshot!.gainLoss)"
          />
          <ResultRow
            v-if="snapshot!.annualizedReturn !== null"
            :label="t(U + 'rAnnualized')"
            :value="formatPercent(snapshot!.annualizedReturn)"
          />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: gain/loss tints reach into ResultRow via :deep. */
.rc__stat--gain { border-color: oklch(0.62 0.17 150); }
.rc__stat--gain :deep(.rr__value) { color: oklch(0.55 0.17 150); }
.rc__stat--loss { border-color: var(--qt-danger); }
.rc__stat--loss :deep(.rr__value) { color: var(--qt-danger); }
</style>
