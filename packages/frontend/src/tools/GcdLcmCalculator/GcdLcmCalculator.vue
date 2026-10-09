<script setup lang="ts">
/**
 * GcdLcmCalculator - compute GCD and LCM of integers.
 *
 * Enter a comma or space separated list of integers to compute the
 * Greatest Common Divisor and Least Common Multiple simultaneously.
 *
 * Works in embed mode: receives `input` PostMessages to set the numbers
 * and sends `output` PostMessages with the results.
 */
import { RotateCcw } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ResultRow from '@/components/ResultRow.vue';
import { useGcdLcmCalculator } from './useGcdLcmCalculator';

const {
  input,
  gcdResult,
  lcmResult,
  parsedNumbers,
  reset,
} = useGcdLcmCalculator();

const { t } = useI18n();
const U = 'tools.gcd-lcm-calculator.ui.';
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

      <ToolField
        v-model="input"
        :label="t(U + 'numbers')"
        as="textarea"
        :rows="3"
        :placeholder="t(U + 'placeholder')"
        spellcheck="false"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="parsedNumbers.length > 0 ? t(U + 'descParsed', parsedNumbers.length) : t(U + 'descEmpty')"
    >
      <div class="qt-stack" style="--qt-stack-gap:12px">
        <ResultRow
          :label="t(U + 'gcdLabel')"
          :value="gcdResult"
          size="lg"
        />
        <ResultRow
          :label="t(U + 'lcmLabel')"
          :value="lcmResult"
          size="lg"
        />
      </div>
    </ToolOutput>
  </div>
</template>
