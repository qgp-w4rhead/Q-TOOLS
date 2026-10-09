<script setup lang="ts">
/**
 * VigenereCipher - polyalphabetic substitution cipher with a keyword.
 *
 * Each letter of the plaintext is shifted by the corresponding letter of
 * the keyword (repeated cyclically). Non-letter characters are preserved
 * and do not advance the keyword pointer. Case is preserved.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text,
 * set the keyword, and select the mode; sends `output` PostMessages whenever
 * the computed output changes.
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
  useVigenereCipher,
  type VigenereMode,
} from './useVigenereCipher';

const {
  input,
  keyword,
  mode,
  output,
  error,
  recompute,
  swap,
} = useVigenereCipher();

const { t } = useI18n();
const U = 'tools.vigenere-cipher.ui.';

const placeholder = computed(() =>
  mode.value === 'encrypt'
    ? t(U + 'phEncrypt')
    : t(U + 'phDecrypt'),
);

const inputLabel = computed(() => (mode.value === 'encrypt' ? t(U + 'plaintext') : t(U + 'ciphertext')));
const outputLabel = computed(() => (mode.value === 'encrypt' ? t(U + 'ciphertext') : t(U + 'plaintext')));

const modeOptions = computed<Array<{ id: VigenereMode; label: string }>>(() => [
  { id: 'encrypt', label: t(U + 'modeEncrypt') },
  { id: 'decrypt', label: t(U + 'modeDecrypt') },
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
        v-model="keyword"
        mono
        :label="t(U + 'keyword')"
        :placeholder="t(U + 'phKeyword')"
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
      :description="output ? t(U + 'descOut', { mode, keyword }) : t(U + 'descEmpty')"
    >
      <ToolAlert v-if="error" kind="error">{{ error }}</ToolAlert>
      <ToolAlert v-else-if="!output">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <OutputTextarea v-else :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>
  </div>
</template>
