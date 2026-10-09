<script setup lang="ts">
/**
 * RadiationConverter - convert between radiation units.
 *
 * Four modes: activity (Bq, Ci, dpm), absorbed dose (Gy, rad), equivalent
 * dose (Sv, rem), and exposure (C/kg, R). Enter a value, pick the input
 * unit, and see all conversions simultaneously.
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import UnitConverterPanel from '@/components/UnitConverterPanel.vue';
import { useRadiationConverter } from './useRadiationConverter';

const { t } = useI18n();
const U = 'tools.radiation-converter.ui.';

const {
  inputValue,
  inputUnit,
  activeSetId,
  units,
  allSets,
  results,
  reset,
} = useRadiationConverter();
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
