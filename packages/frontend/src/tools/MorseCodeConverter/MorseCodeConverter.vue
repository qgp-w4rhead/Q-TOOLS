<script setup lang="ts">
/**
 * MorseCodeConverter - bidirectional text ↔ Morse code converter.
 *
 * Encodes text to ITU standard Morse code (dots and dashes) and decodes
 * Morse code back to text. Letters are separated by spaces, words by " / ".
 * Tolerates Unicode dots/dashes (·, -) on decode.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text
 * and select the mode; sends `output` PostMessages whenever the computed
 * output changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftRight, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import OutputTextarea from '@/components/OutputTextarea.vue';
import {
  useMorseCodeConverter,
  type MorseMode,
} from './useMorseCodeConverter';

const {
  input,
  mode,
  output,
  recompute,
  swap,
} = useMorseCodeConverter();

const { t } = useI18n();
const U = 'tools.morse-code-converter.ui.';

const placeholder = computed(() =>
  mode.value === 'encode'
    ? t(U + 'phEncode')
    : t(U + 'phDecode'),
);

const inputLabel = computed(() => (mode.value === 'encode' ? t(U + 'text') : t(U + 'morseCode')));
const outputLabel = computed(() => (mode.value === 'encode' ? t(U + 'morseCode') : t(U + 'text')));

const modeOptions = computed<Array<{ id: MorseMode; label: string }>>(() => [
  { id: 'encode', label: t('common.encode') },
  { id: 'decode', label: t('common.decode') },
]);
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton :title="t('common.swapTitle')" @click="swap">
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </ToolButton>
        <ToolButton variant="primary" :disabled="input.trim().length === 0" @click="recompute">
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </ToolButton>
      </template>

      <SegmentedControl v-model="mode" :options="modeOptions" />

      <ToolField
        v-model="input"
        as="textarea"
        mono
        :label="inputLabel"
        :placeholder="placeholder"
        :rows="5"
      />
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="output ? t(mode === 'encode' ? U + 'descOutEncode' : U + 'descOutDecode') : t(U + 'descEmpty')"
    >
      <OutputTextarea :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>
  </div>
</template>
