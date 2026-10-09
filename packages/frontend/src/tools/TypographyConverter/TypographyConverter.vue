<script setup lang="ts">
/**
 * TypographyConverter - convert between typographic length units.
 *
 * Enter a value, pick the input unit, and see the value converted to all
 * other typography units simultaneously (pt, pica, px, em, in, mm, cicero,
 * didot). The px unit honours a configurable DPI and the em unit honours a
 * configurable base font size.
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import UnitConverterPanel from '@/components/UnitConverterPanel.vue';
import ToolField from '@/components/ToolField.vue';
import { useTypographyConverter } from './useTypographyConverter';

const { t } = useI18n();
const U = 'tools.typography-converter.ui.';

const {
  inputValue,
  inputUnit,
  activeSetId,
  units,
  allSets,
  results,
  reset,
  dpi,
  baseFontSize,
} = useTypographyConverter();

function onDpi(v: string | number | undefined): void {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) dpi.value = n;
}
function onEm(v: string | number | undefined): void {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) baseFontSize.value = n;
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
      <div class="qt-row">
        <ToolField
          :model-value="dpi"
          @update:model-value="onDpi"
          :label="t(U + 'dpiLabel')"
          type="number"
          min="1"
          step="any"
          grow
        />
        <ToolField
          :model-value="baseFontSize"
          @update:model-value="onEm"
          :label="t(U + 'emLabel')"
          type="number"
          min="0.1"
          step="any"
          grow
        />
      </div>
    </template>
  </UnitConverterPanel>
</template>
