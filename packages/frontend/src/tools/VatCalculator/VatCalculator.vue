<script setup lang="ts">
/**
 * VatCalculator - add or remove VAT/sales tax.
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
  useVatCalculator,
  formatCurrency,
  VAT_PRESETS,
  type VatMode,
} from './useVatCalculator';

const { amount, rate, mode, snapshot, reset } = useVatCalculator();

const { t } = useI18n();
const U = 'tools.vat-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatCurrency(snapshot.value.outputAmount);
});

function onPreset(e: Event): void {
  const val = Number((e.target as HTMLSelectElement).value);
  if (val > 0) rate.value = String(val);
}

const modeOptions = computed<Array<{ id: VatMode; label: string }>>(() => [
  { id: 'add', label: t(U + 'modeAdd') },
  { id: 'remove', label: t(U + 'modeRemove') },
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

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField
          v-model="amount"
          :label="mode === 'add' ? t(U + 'netAmount') : t(U + 'grossAmount')"
          type="number"
          :placeholder="t(U + 'phAmount')"
          step="any"
          min="0"
          inputmode="decimal"
          grow
        />
        <ToolField
          v-model="rate"
          :label="t(U + 'vatRate')"
          type="number"
          :placeholder="t(U + 'phRate')"
          step="any"
          min="0"
          inputmode="decimal"
          grow
        />
      </div>

      <label class="qt-field qt-field--grow" style="flex-basis:100%">
        <span class="qt-label">{{ t(U + 'presets') }}</span>
        <select class="qt-input" style="font-size:14px;padding:8px 10px" @change="onPreset">
          <option value="0">{{ t(U + 'customRate') }}</option>
          <option v-for="p in VAT_PRESETS.filter((p) => p.rate > 0)" :key="p.label" :value="p.rate">{{ p.label }}</option>
        </select>
      </label>
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
          <ResultRow
            :label="mode === 'add' ? t(U + 'grossAmount') : t(U + 'netAmount')"
            :value="formatCurrency(snapshot!.outputAmount)"
          />
          <ResultRow :label="t(U + 'rVat')" :value="formatCurrency(snapshot!.vatAmount)" />
          <ResultRow :label="t(U + 'rRate')" :value="`${snapshot!.rate}%`" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>
