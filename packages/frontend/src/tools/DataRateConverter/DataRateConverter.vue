<script setup lang="ts">
/**
 * DataRateConverter - convert between data rate units.
 *
 * Enter a value, pick the input unit, and see the value converted to all
 * other data rate units simultaneously (bps→Tbps, B/s→GiB/s, baud). A
 * transfer-time helper estimates how long a file of a given size takes at
 * the current rate.
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import UnitConverterPanel from '@/components/UnitConverterPanel.vue';
import ToolField from '@/components/ToolField.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useDataRateConverter, FILE_SIZE_UNITS } from './useDataRateConverter';

const { t } = useI18n();
const U = 'tools.data-rate-converter.ui.';

const {
  inputValue,
  inputUnit,
  activeSetId,
  units,
  allSets,
  results,
  reset,
  fileSize,
  fileSizeUnit,
  transferTime,
} = useDataRateConverter();

function onFileSizeUnit(e: Event): void {
  fileSizeUnit.value = (e.target as HTMLSelectElement).value;
}
</script>

<template>
  <UnitConverterPanel
    v-model:input-value="inputValue"
    v-model:input-unit="inputUnit"
    v-model:active-set-id="activeSetId"
    :title="t(U + 'inputTitle')"
    :description="t(U + 'desc')"
    :sets="allSets"
    :units="units"
    :results="results"
    :value-placeholder="t(U + 'phValue')"
    @reset="reset"
  >
    <template #controls>
      <div class="qt-stack" style="--qt-stack-gap:8px;border-top:1px solid var(--qt-border);padding-top:12px">
        <span style="font-size:12.5px;font-weight:700;color:var(--qt-text)">{{ t(U + 'transferTitle') }}</span>
        <div class="qt-row qt-row--bottom">
          <ToolField
            v-model="fileSize"
            :label="t(U + 'fileSizeLabel')"
            type="number"
            min="0"
            step="any"
            grow
          />
          <label class="qt-field">
            <span class="qt-label">{{ t('common.unit') }}</span>
            <select class="qt-input" :value="fileSizeUnit" @change="onFileSizeUnit">
              <option v-for="u in FILE_SIZE_UNITS" :key="u.id" :value="u.id">{{ u.label }}</option>
            </select>
          </label>
          <div class="qt-field" style="flex:1;min-width:160px">
            <span class="qt-label">{{ t(U + 'durationLabel') }}</span>
            <div class="qt-result-row" style="padding:8px 10px">
              <span class="qt-value" style="font-size:14px;flex:1">{{ transferTime }}</span>
              <CopyButton
                v-if="transferTime !== '-'"
                :text="transferTime"
                :label="t('common.copy')"
                icon-only
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UnitConverterPanel>
</template>
