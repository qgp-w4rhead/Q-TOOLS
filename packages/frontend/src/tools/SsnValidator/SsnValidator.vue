<script setup lang="ts">
/**
 * SsnValidator - validate US Social Security Numbers.
 *
 * Enter a 9-digit SSN to validate its format and check area, group, and
 * serial number rules. Detects ITINs and known invalid numbers.
 *
 * Works in embed mode: receives `input` PostMessages to set the SSN
 * and sends `output` PostMessages with the validation result.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useSsnValidator, type SsnType } from './useSsnValidator';

const {
  input,
  result,
  reset,
} = useSsnValidator();

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

const { t } = useI18n();
const U = 'tools.ssn-validator.ui.';

const typeLabels = computed<Record<SsnType, string>>(() => ({
  unknown: t(U + 'typeUnknown'),
  ssn: t(U + 'typeSsn'),
  itin: t(U + 'typeItin'),
  invalid: t(U + 'typeInvalid'),
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
        <span class="qt-label">{{ t(U + 'ssnLabel') }}</span>
        <input
          type="text"
          class="qt-input qt-input--mono"
          :placeholder="t(U + 'placeholder')"
          inputmode="numeric"
          :value="input"
          @input="onInput"
          maxlength="11"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="result ? (result.valid ? t(U + 'descValid') : t(U + 'descInvalid')) : t(U + 'descEmpty')"
    >
      <div v-if="!result" class="qt-alert qt-alert--empty">
        {{ t(U + 'emptyAlert') }}
      </div>
      <div v-else class="qt-stack" style="--qt-stack-gap:16px">
        <div class="ssn__status" :class="result.valid ? 'ssn__status--valid' : 'ssn__status--invalid'">
          <component :is="result.valid ? CheckCircle2 : XCircle" :size="20" />
          <span>{{ result.valid ? t(U + 'valid') : t(U + 'invalid') }}</span>
        </div>

        <div v-if="result.errors.length > 0" class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="(err, i) in result.errors" :key="i" class="ssn__error">
            {{ err }}
          </div>
        </div>

        <div class="qt-stack">
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'area') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.area || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintArea') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'group') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.group || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintGroup') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'serial') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.serial || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintSerial') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'formatted') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.formatted || '-' }}</span>
            <CopyButton
              v-if="result.formatted"
              :text="result.formatted"
              :label="t('common.copy')"
              icon-only
            />
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
.ssn__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
}
.ssn__status--valid {
  color: oklch(0.62 0.17 150);
}
.ssn__status--invalid {
  color: var(--qt-danger);
}

/* Per-error item — compact danger-tinted box. */
.ssn__error {
  font-size: 13px;
  color: var(--qt-danger);
  padding: 6px 10px;
  border: 1px solid var(--qt-danger);
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-danger) 40% c h / 0.08);
}
</style>
