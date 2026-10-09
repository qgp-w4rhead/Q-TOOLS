<script setup lang="ts">
/**
 * TipCalculator - bill + tip% + split → per-person totals.
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
  useTipCalculator,
  formatCurrency,
  TIP_PRESETS,
} from './useTipCalculator';

const { billAmount, tipPercent, splitCount, snapshot, reset } = useTipCalculator();

const { t } = useI18n();
const U = 'tools.tip-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatCurrency(snapshot.value.perPersonTotal);
});

function setTipPreset(v: number): void { tipPercent.value = String(v); }
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
        <ToolField v-model="billAmount" :label="t(U + 'bill')" type="number" :placeholder="t(U + 'phBill')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="tipPercent" :label="t(U + 'tip')" type="number" :placeholder="t(U + 'phTip')" step="any" min="0" inputmode="decimal" grow />
        <ToolField v-model="splitCount" :label="t(U + 'split')" type="number" :placeholder="t(U + 'phSplit')" step="1" min="1" inputmode="numeric" grow />
      </div>

      <div class="qt-row" style="--qt-row-gap:6px">
        <button v-for="p in TIP_PRESETS" :key="p" type="button" class="qt-btn" :class="tipPercent === String(p) ? 'qt-btn--primary' : 'qt-btn--outline'" style="font-size:12.5px;padding:6px 12px" @click="setTipPreset(p)">
          {{ p }}%
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isEmpty ? t(U + 'descEmpty') : hasError ? t(U + 'descError') : t(U + 'descOk')"
      :copy-text="copyText"
      :copy-label="t('common.copy')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:120px">
          <ResultRow :label="t(U + 'rTip')" :value="formatCurrency(snapshot!.tipAmount)" />
          <ResultRow :label="t(U + 'rTotal')" :value="formatCurrency(snapshot!.totalBill)" />
          <ResultRow style="border-color:var(--qt-accent)" :label="t(U + 'rPerPerson')" :value="formatCurrency(snapshot!.perPersonTotal)" />
          <ResultRow :label="t(U + 'rTipPerPerson')" :value="formatCurrency(snapshot!.perPersonTip)" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>
