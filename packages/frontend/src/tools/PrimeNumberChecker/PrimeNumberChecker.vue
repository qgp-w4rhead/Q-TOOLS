<script setup lang="ts">
/**
 * PrimeNumberChecker - check primality, find primes in a range, factorize.
 *
 * Three modes:
 *   - **check**    - check if a single number is prime
 *   - **range**    - find all primes in a range
 *   - **factorize** - compute prime factorization
 *
 * Works in embed mode: receives `input` PostMessages to set values/mode
 * and sends `output` PostMessages with the result.
 */
import { RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import OutputTextarea from '@/components/OutputTextarea.vue';
import {
  usePrimeNumberChecker,
  type PrimeMode,
} from './usePrimeNumberChecker';

const {
  mode,
  inputValue,
  rangeFrom,
  rangeTo,
  factorInput,
  result,
  reset,
} = usePrimeNumberChecker();

const { t } = useI18n();
const U = 'tools.prime-number-checker.ui.';

const modeOptions = computed<Array<{ id: PrimeMode; label: string }>>(() => [
  { id: 'check', label: t(U + 'modeCheck') },
  { id: 'range', label: t(U + 'modeRange') },
  { id: 'factorize', label: t(U + 'modeFactorize') },
]);
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t(U + 'resetTitle')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <SegmentedControl v-model="mode" :options="modeOptions" />

      <div v-if="mode === 'check'" class="qt-row">
        <ToolField
          v-model="inputValue"
          :label="t(U + 'number')"
          type="number"
          placeholder="e.g. 17"
          step="1"
          grow
        />
      </div>

      <div v-else-if="mode === 'range'" class="qt-row">
        <ToolField
          v-model="rangeFrom"
          :label="t(U + 'from')"
          type="number"
          placeholder="e.g. 1"
          step="1"
          grow
        />
        <ToolField
          v-model="rangeTo"
          :label="t(U + 'to')"
          type="number"
          placeholder="e.g. 100"
          step="1"
          grow
        />
      </div>

      <div v-else class="qt-row">
        <ToolField
          v-model="factorInput"
          :label="t(U + 'numberToFactorize')"
          type="number"
          placeholder="e.g. 360"
          step="1"
          grow
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="t(U + 'descDone')"
    >
      <OutputTextarea :value="result" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>
  </div>
</template>
