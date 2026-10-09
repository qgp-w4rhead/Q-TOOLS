<script setup lang="ts">
/**
 * ViscosityConverter - convert between viscosity units.
 *
 * Two modes: dynamic (absolute) viscosity (Pa·s, poise, cP, ...) and
 * kinematic viscosity (m²/s, stokes, cSt, ft²/s, ...). Enter a value, pick
 * the input unit, and see all conversions simultaneously.
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import UnitConverterPanel from '@/components/UnitConverterPanel.vue';
import { useViscosityConverter } from './useViscosityConverter';

const { t } = useI18n();
const U = 'tools.viscosity-converter.ui.';

const {
  inputValue,
  inputUnit,
  activeSetId,
  units,
  allSets,
  results,
  reset,
} = useViscosityConverter();
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
