<script setup lang="ts">
/**
 * IncomeTaxCalculator - progressive tax bracket calculator.
 */
import { RotateCcw, Plus, Trash2 } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ResultRow from '@/components/ResultRow.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useIncomeTaxCalculator,
  formatCurrency,
  formatPercent,
} from './useIncomeTaxCalculator';

const {
  income,
  brackets,
  snapshot,
  reset,
  addBracket,
  removeBracket,
  updateBracket,
} = useIncomeTaxCalculator();

const { t } = useI18n();
const U = 'tools.income-tax-calculator.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return formatCurrency(snapshot.value.totalTax);
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

      <ToolField v-model="income" :label="t(U + 'income')" type="number" :placeholder="t(U + 'phIncome')" step="any" min="0" inputmode="decimal" />

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'brackets') }}</span>
          <button type="button" class="qt-btn qt-btn--outline" style="font-size:12px;padding:4px 8px" @click="addBracket">
            <Plus :size="14" />
            <span>{{ t(U + 'add') }}</span>
          </button>
        </div>
        <div v-for="(b, i) in brackets" :key="i" class="qt-row qt-row--bottom" style="--qt-row-gap:8px">
          <span style="font-size:12px;font-weight:700;color:var(--qt-muted);min-width:20px;text-align:center;padding-bottom:8px">{{ i + 1 }}</span>
          <label class="qt-field qt-field--grow" style="min-width:80px">
            <span class="qt-label" style="font-size:11px">{{ t(U + 'colMin') }}</span>
            <input type="number" class="qt-input" style="font-size:14px;padding:8px 10px" :value="b.min" step="any" min="0" inputmode="decimal" @input="(e) => updateBracket(i, 'min', (e.target as HTMLInputElement).value)" />
          </label>
          <label class="qt-field qt-field--grow" style="min-width:80px">
            <span class="qt-label" style="font-size:11px">{{ t(U + 'colMax') }}</span>
            <input type="text" class="qt-input" style="font-size:14px;padding:8px 10px" :value="b.max === Infinity ? '' : b.max" placeholder="∞" inputmode="decimal" @input="(e) => updateBracket(i, 'max', (e.target as HTMLInputElement).value)" />
          </label>
          <label class="qt-field qt-field--grow" style="min-width:80px">
            <span class="qt-label" style="font-size:11px">{{ t(U + 'colRate') }}</span>
            <input type="number" class="qt-input" style="font-size:14px;padding:8px 10px" :value="b.rate" step="any" min="0" inputmode="decimal" @input="(e) => updateBracket(i, 'rate', (e.target as HTMLInputElement).value)" />
          </label>
          <button v-if="brackets.length > 1" type="button" class="qt-btn qt-btn--outline" style="color:var(--qt-danger);padding:6px 8px" @click="removeBracket(i)" :title="t(U + 'removeBracket')">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isEmpty ? t(U + 'descEmpty') : hasError ? t(U + 'descError') : t(U + 'descOk')"
      :copy-text="copyText"
      :copy-label="t(U + 'copyTax')"
    >
      <ToolAlert v-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:120px">
          <ResultRow :label="t(U + 'rTotalTax')" :value="formatCurrency(snapshot!.totalTax)" />
          <ResultRow :label="t(U + 'rNetIncome')" :value="formatCurrency(snapshot!.netIncome)" />
          <ResultRow :label="t(U + 'rEffective')" :value="formatPercent(snapshot!.effectiveRate)" />
          <ResultRow :label="t(U + 'rMarginal')" :value="`${snapshot!.marginalRate}%`" />
        </div>

        <details class="itc__breakdown">
          <summary>{{ t(U + 'breakdownSummary') }}</summary>
          <div class="qt-panel" style="padding:0;overflow-x:auto">
            <table class="itc__table">
              <thead>
                <tr>
                  <th>{{ t(U + 'colBracket') }}</th>
                  <th>{{ t(U + 'colRateH') }}</th>
                  <th>{{ t(U + 'colTaxable') }}</th>
                  <th>{{ t(U + 'colTax') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in snapshot!.brackets" :key="i">
                  <td>{{ formatCurrency(r.bracket.min) }} – {{ r.bracket.max === Infinity ? '∞' : formatCurrency(r.bracket.max) }}</td>
                  <td>{{ r.bracket.rate }}%</td>
                  <td>{{ formatCurrency(r.taxableAmount) }}</td>
                  <td>{{ formatCurrency(r.tax) }}</td>
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
.itc__breakdown { margin-top: 4px; }
.itc__breakdown > summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--qt-muted); padding: 6px 0; }
.itc__breakdown > summary:hover { color: var(--qt-text); }
.itc__table { width: 100%; border-collapse: collapse; font-size: 12.5px; font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; }
.itc__table th, .itc__table td { padding: 6px 10px; text-align: right; border-bottom: 1px solid var(--qt-border); }
.itc__table th { font-weight: 700; color: var(--qt-muted); }
.itc__table td:first-child, .itc__table th:first-child { text-align: left; }
</style>
