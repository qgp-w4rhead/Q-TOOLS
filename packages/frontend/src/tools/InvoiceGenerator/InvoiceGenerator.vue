<script setup lang="ts">
/**
 * InvoiceGenerator - line items → formatted invoice HTML with totals, tax, discounts.
 */
import { RotateCcw, Plus, Trash2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useInvoiceGenerator,
  formatCurrency,
} from './useInvoiceGenerator';

const {
  data,
  totals,
  invoiceHTML,
  reset,
  addItem,
  removeItem,
  updateItem,
} = useInvoiceGenerator();

const { t } = useI18n();
const U = 'tools.invoice-generator.ui.';

function onTaxRate(e: Event): void {
  const v = (e.target as HTMLInputElement).value;
  data.value.taxRate = Number(v) || 0;
}
function onDiscountRate(e: Event): void {
  const v = (e.target as HTMLInputElement).value;
  data.value.discountRate = Number(v) || 0;
}
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
        <ToolField v-model="data.fromName" :label="t(U + 'fromName')" :placeholder="t(U + 'phFromName')" grow />
        <ToolField v-model="data.invoiceNumber" :label="t(U + 'invoiceNum')" :placeholder="t(U + 'phInvoiceNum')" grow />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="data.fromAddress" :label="t(U + 'fromAddress')" as="textarea" :placeholder="t(U + 'phFromAddress')" :rows="2" grow />
        <ToolField v-model="data.toName" :label="t(U + 'toName')" :placeholder="t(U + 'phToName')" grow />
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField v-model="data.toAddress" :label="t(U + 'toAddress')" as="textarea" :placeholder="t(U + 'phToAddress')" :rows="2" grow />
        <div class="qt-row" style="--qt-row-gap:10px;flex:1">
          <ToolField v-model="data.date" :label="t(U + 'date')" type="date" grow />
          <ToolField v-model="data.dueDate" :label="t(U + 'dueDate')" type="date" grow />
        </div>
      </div>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div class="qt-row qt-row--center qt-row--between">
          <span class="qt-label">{{ t(U + 'lineItems') }}</span>
          <button type="button" class="qt-btn qt-btn--outline" style="font-size:12px;padding:4px 8px" @click="addItem">
            <Plus :size="14" />
            <span>{{ t(U + 'addItem') }}</span>
          </button>
        </div>
        <div v-for="item in data.items" :key="item.id" class="qt-row qt-row--bottom" style="--qt-row-gap:8px">
          <label class="qt-field" style="flex:2;min-width:150px">
            <span class="qt-label" style="font-size:11px">{{ t(U + 'colDesc') }}</span>
            <input type="text" class="qt-input" style="font-size:14px;padding:8px 10px" :placeholder="t(U + 'phDesc')" :value="item.description" @input="(e) => updateItem(item.id, 'description', (e.target as HTMLInputElement).value)" />
          </label>
          <label class="qt-field qt-field--grow" style="min-width:60px">
            <span class="qt-label" style="font-size:11px">{{ t(U + 'colQty') }}</span>
            <input type="number" class="qt-input" style="font-size:14px;padding:8px 10px" :value="item.quantity" step="any" min="0" inputmode="decimal" @input="(e) => updateItem(item.id, 'quantity', (e.target as HTMLInputElement).value)" />
          </label>
          <label class="qt-field qt-field--grow" style="min-width:80px">
            <span class="qt-label" style="font-size:11px">{{ t(U + 'colUnitPrice') }}</span>
            <input type="number" class="qt-input" style="font-size:14px;padding:8px 10px" :value="item.unitPrice" step="any" min="0" inputmode="decimal" @input="(e) => updateItem(item.id, 'unitPrice', (e.target as HTMLInputElement).value)" />
          </label>
          <span class="qt-mono" style="font-size:14px;font-weight:700;color:var(--qt-text);padding-bottom:8px;white-space:nowrap">{{ formatCurrency(item.quantity * item.unitPrice) }}</span>
          <button v-if="data.items.length > 1" type="button" class="qt-btn qt-btn--outline" style="color:var(--qt-danger);padding:6px 8px" @click="removeItem(item.id)" :title="t(U + 'removeItem')">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'taxRate') }}</span>
          <input type="number" class="qt-input" style="font-size:14px;padding:8px 10px" placeholder="0" step="any" min="0" :value="data.taxRate" inputmode="decimal" @input="onTaxRate" />
        </label>
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'discount') }}</span>
          <input type="number" class="qt-input" style="font-size:14px;padding:8px 10px" placeholder="0" step="any" min="0" :value="data.discountRate" inputmode="decimal" @input="onDiscountRate" />
        </label>
      </div>

      <ToolField v-model="data.notes" :label="t(U + 'notes')" as="textarea" :placeholder="t(U + 'phNotes')" :rows="2" />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="totals.ok ? t(U + 'descOk') : t(U + 'descEmpty')"
    >
      <template #actions>
        <CopyButton :text="invoiceHTML" :label="t(U + 'copyHtml')" />
      </template>
      <div v-if="totals.ok" class="qt-stack" style="--qt-stack-gap:6px">
        <div class="qt-row qt-row--between" style="font-size:14px;padding:4px 0">
          <span>{{ t(U + 'subtotal') }}</span>
          <span>{{ formatCurrency(totals.subtotal) }}</span>
        </div>
        <div v-if="data.discountRate > 0" class="qt-row qt-row--between" style="font-size:14px;padding:4px 0">
          <span>{{ t(U + 'discountRow', { n: data.discountRate }) }}</span>
          <span>-{{ formatCurrency(totals.discountAmount) }}</span>
        </div>
        <div class="qt-row qt-row--between" style="font-size:14px;padding:4px 0">
          <span>{{ t(U + 'taxRow', { n: data.taxRate }) }}</span>
          <span>{{ formatCurrency(totals.taxAmount) }}</span>
        </div>
        <div class="qt-row qt-row--between" style="font-weight:700;font-size:18px;border-top:2px solid var(--qt-border);padding-top:10px;margin-top:6px">
          <span>{{ t(U + 'total') }}</span>
          <span>{{ formatCurrency(totals.total) }}</span>
        </div>
      </div>
      <ToolAlert v-else kind="empty">{{ totals.message }}</ToolAlert>

      <details class="ig__preview">
        <summary>{{ t(U + 'previewSummary') }}</summary>
        <iframe style="width:100%;height:400px;border:1px solid var(--qt-border);border-radius:var(--qt-radius-sm);background:white" :srcdoc="invoiceHTML" sandbox="allow-same-origin" />
      </details>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: details/summary disclosure (unique pattern). */
.ig__preview { margin-top: 8px; }
.ig__preview > summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--qt-muted); padding: 6px 0; }
.ig__preview > summary:hover { color: var(--qt-text); }
</style>
