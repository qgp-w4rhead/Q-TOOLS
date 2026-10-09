<script setup lang="ts">
/**
 * FlowRateConverter - convert between volumetric flow rate units.
 *
 * Enter a value, pick the input unit, and see the value converted to all
 * other flow rate units simultaneously (L/s, L/min, m³/h, gpm, cfm, ft³/s).
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import UnitConverterPanel from '@/components/UnitConverterPanel.vue';
import { useFlowRateConverter } from './useFlowRateConverter';

const { t } = useI18n();
const U = 'tools.flow-rate-converter.ui.';

const {
  inputValue,
  inputUnit,
  activeSetId,
  units,
  allSets,
  results,
  reset,
} = useFlowRateConverter();
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
  />
</template>
