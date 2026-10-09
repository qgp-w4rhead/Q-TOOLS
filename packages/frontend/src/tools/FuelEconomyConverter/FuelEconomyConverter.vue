<script setup lang="ts">
/**
 * FuelEconomyConverter - convert between fuel economy units.
 *
 * Enter a value, pick the input unit, and see the value converted to all
 * other fuel economy units simultaneously.
 *
 * Works in embed mode: receives `input` PostMessages to set the value/unit
 * and sends `output` PostMessages with all converted results.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useFuelEconomyConverter,
  FUEL_ECONOMY_UNITS,
  getFuelEconomyUnitLabel,
  type FuelEconomyUnit,
} from './useFuelEconomyConverter';

const { t } = useI18n();
const U = 'tools.fuel-economy-converter.ui.';

const {
  inputValue,
  inputUnit,
  results,
  reset,
} = useFuelEconomyConverter();

function onUnit(e: Event): void {
  inputUnit.value = (e.target as HTMLSelectElement).value as FuelEconomyUnit;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.resetDefaults')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row">
        <ToolField
          v-model="inputValue"
          :label="t('common.value')"
          type="number"
          step="any"
          :placeholder="t(U + 'phValue')"
          grow
        />
        <label class="qt-field">
          <span class="qt-label">{{ t('common.unit') }}</span>
          <select class="qt-input" :value="inputUnit" @change="onUnit">
            <option v-for="u in FUEL_ECONOMY_UNITS" :key="u" :value="u">{{ getFuelEconomyUnitLabel(u) }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.convertedValues')"
      :description="t('common.allUnitsGlance')"
    >
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div v-for="u in FUEL_ECONOMY_UNITS" :key="u" class="qt-result-row" :class="{ 'qt-result-row--active': u === inputUnit }">
          <span class="qt-result-label">{{ getFuelEconomyUnitLabel(u as FuelEconomyUnit) }}</span>
          <span class="qt-value" style="font-size:14px">{{ results[u] }}</span>
          <CopyButton
            v-if="results[u] && results[u] !== '-'"
            :text="results[u]"
            :label="t('common.copy')"
            icon-only
          />
        </div>
      </div>
    </ToolOutput>
  </div>
</template>
