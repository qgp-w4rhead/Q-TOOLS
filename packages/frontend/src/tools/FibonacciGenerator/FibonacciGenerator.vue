<script setup lang="ts">
/**
 * FibonacciGenerator - generate Fibonacci sequence numbers.
 *
 * Configure the count and starting index. Output regenerates live and
 * can be copied to the clipboard.
 *
 * Works in embed mode: receives `input` PostMessages to set options
 * and sends `output` PostMessages with the generated sequence.
 */
import { RotateCcw, Sparkles } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import OutputTextarea from '@/components/OutputTextarea.vue';
import { useFibonacciGenerator } from './useFibonacciGenerator';

const {
  count,
  startIndex,
  output,
  generate,
  reset,
} = useFibonacciGenerator();

const { t } = useI18n();
const U = 'tools.fibonacci-generator.ui.';

const lineCount = () => {
  const trimmed = output.value.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split('\n').length;
};
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

      <div class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:10px;margin-bottom:12px">
        <ToolField
          v-model.number="count"
          :label="t(U + 'count')"
          type="number"
          min="1"
          max="10000"
        />
        <ToolField
          v-model.number="startIndex"
          :label="t(U + 'startIndex')"
          type="number"
          min="0"
          max="100000"
        />
      </div>

      <ToolButton variant="primary" @click="generate">
        <Sparkles :size="14" />
        <span>{{ t(U + 'regenerate') }}</span>
      </ToolButton>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descCount', lineCount())"
    >
      <OutputTextarea
        :value="output"
        :aria-label="t(U + 'ariaOutput')"
        min-height="240px"
      />
    </ToolOutput>
  </div>
</template>
