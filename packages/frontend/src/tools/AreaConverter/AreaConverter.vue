<script setup lang="ts">
/**
 * AreaConverter - convert between metric and imperial area units.
 *
 * Enter a value, pick the input unit, and see the value converted to all
 * other area units simultaneously (mm², cm², m², ha, km², in², ft², yd², ac, mi²).
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import UnitConverterPanel from '@/components/UnitConverterPanel.vue';
import { useAreaConverter } from './useAreaConverter';

const { t } = useI18n();
const U = 'tools.area-converter.ui.';

const {
  inputValue,
  inputUnit,
  activeSetId,
  units,
  allSets,
  results,
  reset,
} = useAreaConverter();
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
