<script setup lang="ts">
/**
 * XorCipher - simple XOR encryption/decryption with a key string.
 *
 * Each byte of the input is XORed with the corresponding byte of the key
 * (repeated cyclically). XOR is symmetric - the same operation encrypts
 * and decrypts. Input can be text (UTF-8) or hex; output is hex when
 * encrypting, text when decrypting.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text,
 * set the key, and select the input format; sends `output` PostMessages
 * whenever the computed output changes.
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
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useXorCipher,
  type XorInputFormat,
} from './useXorCipher';

const {
  input,
  key,
  inputFormat,
  output,
  error,
  recompute,
  swap,
} = useXorCipher();

const { t } = useI18n();
const U = 'tools.xor-cipher.ui.';

const placeholder = computed(() =>
  inputFormat.value === 'text'
    ? t(U + 'phText')
    : t(U + 'phHex'),
);

const inputLabel = computed(() => (inputFormat.value === 'text' ? t(U + 'plaintextText') : t(U + 'ciphertextHex')));
const outputLabel = computed(() => (inputFormat.value === 'text' ? t(U + 'ciphertextHex') : t(U + 'plaintextText')));

const formatOptions = computed<Array<{ id: XorInputFormat; label: string }>>(() => [
  { id: 'text', label: t(U + 'fmtTextToHex') },
  { id: 'hex', label: t(U + 'fmtHexToText') },
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

      <SegmentedControl v-model="inputFormat" :options="formatOptions" />

      <ToolField
        v-model="key"
        mono
        :label="t(U + 'key')"
        :placeholder="t(U + 'phKey')"
      />

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
      <ToolAlert v-if="error" kind="error">{{ error }}</ToolAlert>
      <ToolAlert v-else-if="!output">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <OutputTextarea v-else :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>
  </div>
</template>
