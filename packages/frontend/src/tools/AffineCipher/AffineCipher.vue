<script setup lang="ts">
/**
 * AffineCipher - mathematical substitution cipher (ax + b mod 26).
 *
 * Each letter x is mapped to (a*x + b) mod 26, where `a` must be coprime
 * with 26. Valid `a` values are shown as chips for quick selection.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text,
 * select the mode, and set a/b parameters; sends `output` PostMessages
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
  useAffineCipher,
  type AffineMode,
  VALID_A_VALUES,
} from './useAffineCipher';

const {
  input,
  mode,
  a,
  b,
  output,
  error,
  recompute,
  setA,
  setB,
  swap,
} = useAffineCipher();

const { t } = useI18n();
const U = 'tools.affine-cipher.ui.';

const placeholder = computed(() =>
  mode.value === 'encrypt'
    ? t(U + 'phEncrypt')
    : t(U + 'phDecrypt'),
);

const inputLabel = computed(() => (mode.value === 'encrypt' ? t(U + 'plaintext') : t(U + 'ciphertext')));
const outputLabel = computed(() => (mode.value === 'encrypt' ? t(U + 'ciphertext') : t(U + 'plaintext')));

const isValidAValue = computed(() => VALID_A_VALUES.includes(a.value));

function onAChange(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  if (!isNaN(v)) setA(v);
}

function onBChange(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  if (!isNaN(v)) setB(v);
}

const modeOptions = computed<Array<{ id: AffineMode; label: string }>>(() => [
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

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <label class="qt-label" for="aff-a">a</label>
        <input
          id="aff-a"
          class="qt-input qt-input--mono"
          :class="{ 'qt-input--error': !isValidAValue }"
          style="width:64px;padding:5px 9px;font-size:13px"
          type="number"
          :value="a"
          @input="onAChange"
        />
        <span class="qt-label">b</span>
        <input
          class="qt-input qt-input--mono"
          style="width:64px;padding:5px 9px;font-size:13px"
          type="number"
          :value="b"
          @input="onBChange"
        />
      </div>

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t(U + 'validA') }}</span>
        <button
          v-for="val in VALID_A_VALUES"
          :key="val"
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--solid': a === val }"
          @click="setA(val)"
        >
          {{ val }}
        </button>
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
      :description="output ? t(U + 'descOut', { a, b }) : t(U + 'descEmpty')"
    >
      <ToolAlert v-if="error" kind="error">{{ error }}</ToolAlert>
      <ToolAlert v-else-if="!output">{{ t(U + 'alertEmpty') }}</ToolAlert>
      <OutputTextarea v-else :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>
  </div>
</template>
