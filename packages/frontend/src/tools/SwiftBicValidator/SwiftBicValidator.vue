<script setup lang="ts">
/**
 * SwiftBicValidator - validate SWIFT/BIC codes and parse into components.
 *
 * Enter a SWIFT/BIC code (8 or 11 characters) to validate its structure
 * and extract the bank code, country code, location code, and branch code.
 *
 * Works in embed mode: receives `input` PostMessages to set the BIC
 * and sends `output` PostMessages with the validation result.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import { useSwiftBicValidator, type BicType } from './useSwiftBicValidator';

const {
  input,
  result,
  reset,
} = useSwiftBicValidator();

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

const { t } = useI18n();
const U = 'tools.swift-bic-validator.ui.';

const typeLabels = computed<Record<BicType, string>>(() => ({
  unknown: t(U + 'typeUnknown'),
  live: t(U + 'typeLive'),
  test: t(U + 'typeTest'),
  passive: t(U + 'typePassive'),
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
        <span class="qt-label">{{ t(U + 'bicLabel') }}</span>
        <input
          type="text"
          class="qt-input qt-input--mono"
          style="letter-spacing:0.05em;text-transform:uppercase"
          :placeholder="t(U + 'placeholder')"
          :value="input"
          @input="onInput"
          maxlength="11"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="result ? (result.valid ? t(U + 'descValid') : t(U + 'descInvalid')) : t(U + 'descEmpty')"
      hide-copy
    >
      <div v-if="!result" class="qt-alert qt-alert--empty">
        {{ t(U + 'emptyAlert') }}
      </div>
      <div v-else class="qt-stack" style="--qt-stack-gap:16px">
        <div class="bic__status" :class="result.valid ? 'bic__status--valid' : 'bic__status--invalid'">
          <component :is="result.valid ? CheckCircle2 : XCircle" :size="20" />
          <span>{{ result.valid ? t(U + 'valid') : t(U + 'invalid') }}</span>
        </div>

        <div v-if="result.errors.length > 0" class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="(err, i) in result.errors" :key="i" class="bic__error">
            {{ err }}
          </div>
        </div>

        <div class="qt-stack">
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'bankCode') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.bankCode || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintBank') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'country') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.countryCode || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintCountry') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'location') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.locationCode || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintLocation') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'branch') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.branchCode || t(U + 'branchPrimary') }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintBranch') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'type') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ typeLabels[result.type] }}</span>
          </div>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Valid/invalid status banner — large icon + colored verdict text. */
.bic__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
}
.bic__status--valid {
  color: oklch(0.62 0.17 150);
}
.bic__status--invalid {
  color: var(--qt-danger);
}

/* Per-error item — compact danger-tinted box. */
.bic__error {
  font-size: 13px;
  color: var(--qt-danger);
  padding: 6px 10px;
  border: 1px solid var(--qt-danger);
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-danger) 40% c h / 0.08);
}
</style>
