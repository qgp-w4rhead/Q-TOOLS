<script setup lang="ts">
/**
 * BaconCipher - binary steganography using a/b patterns.
 *
 * Each letter is encoded as a 5-character group of 'a' and 'b' (or '0'/'1'
 * on decode). Non-letter characters are skipped during encoding.
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
  useBaconCipher,
  type BaconMode,
} from './useBaconCipher';

const {
  input,
  mode,
  output,
  recompute,
  swap,
} = useBaconCipher();

const { t } = useI18n();
const U = 'tools.bacon-cipher.ui.';

const placeholder = computed(() =>
  mode.value === 'encode'
    ? t(U + 'phEncode')
    : t(U + 'phDecode'),
);

const inputLabel = computed(() => (mode.value === 'encode' ? t(U + 'text') : t(U + 'baconCode')));
const outputLabel = computed(() => (mode.value === 'encode' ? t(U + 'baconCode') : t(U + 'text')));

const modeOptions = computed<Array<{ id: BaconMode; label: string }>>(() => [
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
      :description="output ? t(U + 'descOut') : t(U + 'descEmpty')"
    >
      <OutputTextarea :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>
  </div>
</template>
