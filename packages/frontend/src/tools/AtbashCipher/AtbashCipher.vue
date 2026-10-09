<script setup lang="ts">
/**
 * AtbashCipher - reverse-alphabet substitution cipher.
 *
 * Each letter is mapped to its mirror in the alphabet: A↔Z, B↔Y, C↔X, …
 * The cipher is self-inverse - encrypting twice returns the original text.
 * Only ASCII letters are substituted; case is preserved.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text;
 * sends `output` PostMessages whenever the computed output changes.
 */
import { useI18n } from 'vue-i18n';
import { ArrowLeftRight, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import OutputTextarea from '@/components/OutputTextarea.vue';
import { useAtbashCipher } from './useAtbashCipher';

const {
  input,
  output,
  recompute,
  swap,
} = useAtbashCipher();

const { t } = useI18n();
const U = 'tools.atbash-cipher.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton :title="t(U + 'swapTitle')" @click="swap">
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </ToolButton>
        <ToolButton variant="primary" :disabled="input.trim().length === 0" @click="recompute">
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="input"
        as="textarea"
        mono
        :label="t(U + 'text')"
        :placeholder="t(U + 'phText')"
        :rows="5"
      />
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="output ? t(U + 'descOut') : t(U + 'descEmpty')"
    >
      <OutputTextarea :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>
  </div>
</template>
