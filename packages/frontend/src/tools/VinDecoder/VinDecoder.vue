<script setup lang="ts">
/**
 * VinDecoder - decode Vehicle Identification Numbers.
 *
 * Enter a 17-character VIN to see its structural breakdown: WMI, VDS, VIS,
 * check digit validation, model year, and serial number.
 *
 * Works in embed mode: receives `input` PostMessages to set the VIN
 * and sends `output` PostMessages with the decoded result.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, CheckCircle2, XCircle, Car } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import { useVinDecoder } from './useVinDecoder';

const {
  input,
  result,
  reset,
} = useVinDecoder();

const { t } = useI18n();
const U = 'tools.vin-decoder.ui.';

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}
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
        <span class="qt-label">{{ t(U + 'vinLabel') }}</span>
        <input
          type="text"
          class="qt-input qt-input--mono"
          style="letter-spacing:0.05em;text-transform:uppercase"
          :placeholder="t(U + 'placeholder')"
          :value="input"
          @input="onInput"
          maxlength="17"
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
        <div class="vin__status" :class="result.valid ? 'vin__status--valid' : 'vin__status--invalid'">
          <component :is="result.valid ? CheckCircle2 : XCircle" :size="20" />
          <span>{{ result.valid ? t(U + 'valid') : t(U + 'invalid') }}</span>
        </div>

        <div v-if="result.errors.length > 0" class="qt-stack" style="--qt-stack-gap:4px">
          <div v-for="(err, i) in result.errors" :key="i" class="vin__error">
            {{ err }}
          </div>
        </div>

        <div class="qt-stack">
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'wmi') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.wmi || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintWmi') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'vds') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.vds || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintVds') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'checkDigit') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.checkDigit || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintCheck') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'expected') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1" :class="{ 'vin__mismatch': !result.checkDigitValid }">
              {{ result.computedCheckDigit !== '?' ? result.computedCheckDigit : '-' }}
            </span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintExpected') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'vis') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.vis || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintVis') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'modelYear') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">
              {{ result.modelYear !== null ? result.modelYear : '-' }}
              <span v-if="result.modelYearCode" class="qt-hint" style="margin-left:4px">({{ result.modelYearCode }})</span>
            </span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintModelYear') }}</span>
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="min-width:90px">{{ t(U + 'serial') }}</span>
            <span class="qt-value qt-value--sm" style="flex:1">{{ result.serialNumber || '-' }}</span>
            <span class="qt-hint" style="opacity:0.7">{{ t(U + 'hintSerial') }}</span>
          </div>
        </div>

        <div v-if="result.wmi" class="vin__visual">
          <Car :size="16" class="vin__visual-icon" />
          <span class="vin__visual-wmi">{{ result.wmi }}</span>
          <span class="vin__visual-vds">{{ result.vds }}</span>
          <span class="vin__visual-check" :class="{ 'vin__visual-check--ok': result.checkDigitValid }">{{ result.checkDigit }}</span>
          <span class="vin__visual-vis">{{ result.vis }}</span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Valid/invalid status banner — large icon + colored verdict text. */
.vin__status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
}
.vin__status--valid {
  color: oklch(0.62 0.17 150);
}
.vin__status--invalid {
  color: var(--qt-danger);
}

/* Per-error item — compact danger-tinted box. */
.vin__error {
  font-size: 13px;
  color: var(--qt-danger);
  padding: 6px 10px;
  border: 1px solid var(--qt-danger);
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-danger) 40% c h / 0.08);
}

/* Danger flag on the computed check digit when it mismatches. */
.vin__mismatch {
  color: var(--qt-danger);
}

/* Colored VIN-segment breakdown — WMI / VDS / check / VIS. */
.vin__visual {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  font-family: var(--qt-font-mono);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.vin__visual-icon {
  margin-right: 8px;
  color: var(--qt-muted);
}
.vin__visual-wmi {
  color: oklch(0.55 0.2 250);
}
.vin__visual-vds {
  color: oklch(0.55 0.2 160);
}
.vin__visual-check {
  color: var(--qt-danger);
  padding: 0 1px;
}
.vin__visual-check--ok {
  color: oklch(0.62 0.17 150);
}
.vin__visual-vis {
  color: oklch(0.55 0.2 40);
}
</style>
