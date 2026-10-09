<script setup lang="ts">
/**
 * FrequencyConverter - convert between frequency units.
 *
 * Enter a value, pick the input unit, and see the value converted to all
 * other frequency units simultaneously (Hz, kHz, MHz, GHz, THz, rpm).
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import UnitConverterPanel from '@/components/UnitConverterPanel.vue';
import { useFrequencyConverter } from './useFrequencyConverter';

const { t } = useI18n();
const U = 'tools.frequency-converter.ui.';

const {
  inputValue,
  inputUnit,
  activeSetId,
  units,
  allSets,
  results,
  reset,
} = useFrequencyConverter();
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
