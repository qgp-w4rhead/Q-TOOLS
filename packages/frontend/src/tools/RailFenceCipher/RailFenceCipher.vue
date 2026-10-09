<script setup lang="ts">
/**
 * RailFenceCipher - transposition cipher with configurable rail count.
 *
 * The plaintext is written in a zig-zag pattern across `rails` rows, then
 * read off row by row to produce the ciphertext. Decryption reverses
 * the process.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text,
 * select the mode, and set the rail count; sends `output` PostMessages
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
  useRailFenceCipher,
  type RailFenceMode,
  MIN_RAILS,
  MAX_RAILS,
} from './useRailFenceCipher';

const {
  input,
  mode,
  rails,
  output,
  recompute,
  setRails,
  swap,
} = useRailFenceCipher();

const { t } = useI18n();
const U = 'tools.rail-fence-cipher.ui.';

const placeholder = computed(() =>
  mode.value === 'encrypt'
    ? t(U + 'phEncrypt')
    : t(U + 'phDecrypt'),
);

const inputLabel = computed(() => (mode.value === 'encrypt' ? t(U + 'plaintext') : t(U + 'ciphertext')));
const outputLabel = computed(() => (mode.value === 'encrypt' ? t(U + 'ciphertext') : t(U + 'plaintext')));

function onRailsChange(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  if (!isNaN(v)) setRails(v);
}

const modeOptions = computed<Array<{ id: RailFenceMode; label: string }>>(() => [
  { id: 'encrypt', label: t(U + 'modeEncrypt') },
  { id: 'decrypt', label: t(U + 'modeDecrypt') },
]);
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="t(U + 'desc', { rails })">
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

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <label class="qt-label" for="rf-rails">{{ t(U + 'rails') }}</label>
        <input
          id="rf-rails"
          class="qt-input qt-input--mono"
          style="width:64px;padding:5px 9px;font-size:13px"
          type="number"
          :min="MIN_RAILS"
          :max="MAX_RAILS"
          :value="rails"
          @input="onRailsChange"
        />
        <input
          class="rf__rails-slider"
          type="range"
          :min="MIN_RAILS"
          :max="MAX_RAILS"
          :value="rails"
          @input="onRailsChange"
        />
      </div>

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
      :description="output ? t(U + 'descOut', { rails }) : t(U + 'descEmpty')"
    >
      <ToolAlert v-if="!output">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <OutputTextarea v-else :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Range slider — flex sizing + accent color. */
.rf__rails-slider {
  flex: 1 1 120px;
  min-width: 100px;
  accent-color: var(--qt-accent);
}
</style>
