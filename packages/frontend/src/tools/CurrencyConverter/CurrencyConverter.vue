<script setup lang="ts">
/**
 * CurrencyConverter - static-rate currency conversion with rate table.
 */
import { RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useCurrencyConverter,
  formatCurrency,
} from './useCurrencyConverter';

const {
  amount,
  fromCurrency,
  toCurrency,
  rate,
  rates,
  snapshot,
  rateTable,
  reset,
} = useCurrencyConverter();

const { t } = useI18n();
const U = 'tools.currency-converter.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatCurrency(snapshot.value.convertedAmount);
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
        <ToolField v-model="amount" :label="t(U + 'amount')" type="number" :placeholder="t(U + 'phAmount')" step="any" min="0" inputmode="decimal" grow />
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'from') }}</span>
          <select v-model="fromCurrency" class="qt-input" style="font-size:14px;padding:8px 10px">
            <option v-for="r in rates" :key="r.code" :value="r.code">{{ r.code }} - {{ r.name }}</option>
          </select>
        </label>
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'to') }}</span>
          <select v-model="toCurrency" class="qt-input" style="font-size:14px;padding:8px 10px">
            <option v-for="r in rates" :key="r.code" :value="r.code">{{ r.code }} - {{ r.name }}</option>
          </select>
        </label>
      </div>

      <ToolField v-model="rate" :label="t(U + 'rate')" type="number" :placeholder="t(U + 'phRate')" step="any" min="0" inputmode="decimal" />
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
        <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap;align-items:baseline">
          <span class="qt-mono" style="font-size:28px;font-weight:700;color:var(--qt-text)">{{ formatCurrency(snapshot!.convertedAmount) }}</span>
          <span style="font-size:16px;font-weight:600;color:var(--qt-muted)">{{ snapshot!.toCurrency }}</span>
        </div>
        <p class="qt-hint" style="margin:6px 0 0;font-size:13px">
          1 {{ snapshot!.fromCurrency }} = {{ snapshot!.rate.toFixed(4) }} {{ snapshot!.toCurrency }}
        </p>

        <details v-if="rateTable.length > 0" class="cc__table-details">
          <summary>{{ t(U + 'rateTableSummary', { n: rateTable.length }) }}</summary>
          <div class="qt-panel" style="padding:0;overflow-x:auto">
            <table class="cc__table">
              <thead>
                <tr>
                  <th>{{ t(U + 'colCurrency') }}</th>
                  <th>{{ t(U + 'colRate') }}</th>
                  <th>{{ t(U + 'colConverted') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rateTable" :key="row.currency">
                  <td>{{ row.currency }}</td>
                  <td>{{ row.rate.toFixed(4) }}</td>
                  <td>{{ formatCurrency(row.converted) }}</td>
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
.cc__table-details { margin-top: 4px; }
.cc__table-details > summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--qt-muted); padding: 6px 0; }
.cc__table-details > summary:hover { color: var(--qt-text); }
.cc__table { width: 100%; border-collapse: collapse; font-size: 12.5px; font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; }
.cc__table th, .cc__table td { padding: 6px 10px; text-align: right; border-bottom: 1px solid var(--qt-border); }
.cc__table th { font-weight: 700; color: var(--qt-muted); }
.cc__table td:first-child, .cc__table th:first-child { text-align: left; }
</style>
