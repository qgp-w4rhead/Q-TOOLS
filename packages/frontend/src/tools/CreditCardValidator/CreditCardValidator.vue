<script setup lang="ts">
/**
 * CreditCardValidator - validate credit card numbers with Luhn and detect brand.
 *
 * Enter a card number to see if it passes the Luhn checksum and which
 * card brand it belongs to. The number is formatted with spaces as you type.
 *
 * Works in embed mode: receives `input` PostMessages to set the number
 * and sends `output` PostMessages with the validation result.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useCreditCardValidator, type CardBrand } from './useCreditCardValidator';

const {
  input,
  isValid,
  brand,
  formattedNumber,
  reset,
} = useCreditCardValidator();

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

const { t } = useI18n();
const U = 'tools.credit-card-validator.ui.';

const brandLabels = computed<Record<CardBrand, string>>(() => ({
  visa: t(U + 'brandVisa'),
  mastercard: t(U + 'brandMastercard'),
  amex: t(U + 'brandAmex'),
  discover: t(U + 'brandDiscover'),
  diners: t(U + 'brandDiners'),
  jcb: t(U + 'brandJcb'),
  unionpay: t(U + 'brandUnionpay'),
  unknown: t(U + 'brandUnknown'),
}));
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'resetTitle')"
          @click="reset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'cardNumber') }}</span>
        <input
          type="text"
          class="qt-input qt-input--mono"
          :placeholder="t(U + 'placeholder')"
          inputmode="numeric"
          :value="input"
          @input="onInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="isValid === null ? t(U + 'descEmpty') : (isValid ? t(U + 'descValid') : t(U + 'descInvalid'))"
    >
      <div v-if="isValid === null" class="qt-alert qt-alert--empty">
        {{ t(U + 'descEmpty') }}
      </div>
      <div v-else class="qt-stack" style="--qt-stack-gap:16px">
        <div class="cc__status" :class="isValid ? 'cc__status--valid' : 'cc__status--invalid'">
          <component :is="isValid ? CheckCircle2 : XCircle" :size="20" />
          <span>{{ isValid ? t(U + 'valid') : t(U + 'invalid') }}</span>
        </div>
        <div class="qt-stack">
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:80px">{{ t(U + 'brand') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ brandLabels[brand] }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:80px">{{ t(U + 'formatted') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ formattedNumber }}</span>
            <CopyButton
              v-if="formattedNumber"
              :text="formattedNumber"
              :label="t('common.copy')"
              icon-only
            />
          </div>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Valid/invalid status banner — large icon + colored verdict text. */
.cc__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
}
.cc__status--valid {
  color: oklch(0.62 0.17 150);
}
.cc__status--invalid {
  color: var(--qt-danger);
}
</style>
