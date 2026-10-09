<script setup lang="ts">
/**
 * VolumeConverter - convert between metric and imperial volume units.
 *
 * Enter a value, pick the input unit, and see the value converted to all
 * other volume units simultaneously (mL, L, m³, cm³, gal, qt, pt, cup, fl oz).
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import UnitConverterPanel from '@/components/UnitConverterPanel.vue';
import { useVolumeConverter } from './useVolumeConverter';

const { t } = useI18n();
const U = 'tools.volume-converter.ui.';

const {
  inputValue,
  inputUnit,
  activeSetId,
  units,
  allSets,
  results,
  reset,
} = useVolumeConverter();
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
