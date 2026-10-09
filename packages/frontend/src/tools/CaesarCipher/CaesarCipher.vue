<script setup lang="ts">
/**
 * CaesarCipher - bidirectional Caesar / ROT shift cipher.
 *
 * Each letter is shifted by a configurable number of positions (1–25) in
 * the alphabet. ROT13 (shift = 13) is the default. Only ASCII letters are
 * shifted; all other characters are preserved verbatim. Case is preserved.
 *
 * Includes a brute-force panel showing all 25 possible decryptions.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text,
 * set the shift, and select the mode; sends `output` PostMessages whenever
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
import CopyButton from '@/components/CopyButton.vue';
import {
  useCaesarCipher,
  type CaesarMode,
  MIN_SHIFT,
  MAX_SHIFT,
} from './useCaesarCipher';

const {
  input,
  shift,
  mode,
  output,
  bruteForce,
  recompute,
  setShift,
  swap,
} = useCaesarCipher();

const { t } = useI18n();
const U = 'tools.caesar-cipher.ui.';

const placeholder = computed(() =>
  mode.value === 'encrypt'
    ? t(U + 'phEncrypt')
    : t(U + 'phDecrypt'),
);

const inputLabel = computed(() => (mode.value === 'encrypt' ? t(U + 'plaintext') : t(U + 'ciphertext')));
const outputLabel = computed(() => (mode.value === 'encrypt' ? t(U + 'ciphertext') : t(U + 'plaintext')));

function onShiftChange(e: Event): void {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  if (!isNaN(v)) setShift(Math.max(MIN_SHIFT, Math.min(MAX_SHIFT, v)));
}

const modeOptions = computed<Array<{ id: CaesarMode; label: string }>>(() => [
  { id: 'encrypt', label: t(U + 'modeEncrypt') },
  { id: 'decrypt', label: t(U + 'modeDecrypt') },
]);

const rotLabel = computed(() => {
  if (shift.value === 13) return 'ROT13';
  return `ROT${shift.value}`;
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="t(U + 'desc', { rot: rotLabel })">
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
        <label class="qt-label" for="caesar-shift">{{ t(U + 'shift') }}</label>
        <input
          id="caesar-shift"
          class="qt-input qt-input--mono"
          style="width:64px;padding:5px 9px;font-size:13px"
          type="number"
          :min="MIN_SHIFT"
          :max="MAX_SHIFT"
          :value="shift"
          @input="onShiftChange"
        />
        <input
          class="caesar__shift-slider"
          type="range"
          :min="MIN_SHIFT"
          :max="MAX_SHIFT"
          :value="shift"
          @input="onShiftChange"
        />
        <span class="qt-mono" style="font-size:12px;font-weight:600;color:var(--qt-accent)">{{ rotLabel }}</span>
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
      :description="output ? t(U + 'descOut', { shift, rot: rotLabel }) : t(U + 'descEmpty')"
    >
      <ToolAlert v-if="!output">{{ t(U + 'alertEmpty', { what: mode === 'encrypt' ? t(U + 'ciphertext') : t(U + 'plaintext') }) }}</ToolAlert>
      <OutputTextarea v-else :value="output" :aria-label="t(U + 'ariaResult')" />
    </ToolOutput>

    <ToolOutput
      v-if="bruteForce.length > 0"
      :title="t(U + 'bfTitle')"
      :description="t(U + 'bfDesc')"
    >
      <div class="caesar__bf-table" role="table">
        <div class="caesar__bf-row caesar__bf-row--head" role="row">
          <span class="caesar__bf-cell caesar__bf-cell--shift" role="columnheader">{{ t(U + 'colShift') }}</span>
          <span class="caesar__bf-cell caesar__bf-cell--result" role="columnheader">{{ t(U + 'colResult') }}</span>
          <span class="caesar__bf-cell caesar__bf-cell--copy" role="columnheader"></span>
        </div>
        <div
          v-for="row in bruteForce"
          :key="row.shift"
          class="caesar__bf-row"
          :class="{ 'caesar__bf-row--current': row.shift === shift && mode === 'decrypt' }"
          role="row"
        >
          <span class="caesar__bf-cell caesar__bf-cell--shift" role="cell">{{ row.shift }}</span>
          <span class="caesar__bf-cell caesar__bf-cell--result" role="cell">{{ row.result }}</span>
          <span class="caesar__bf-cell caesar__bf-cell--copy" role="cell">
            <CopyButton :text="row.result" icon-only />
          </span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Range slider — flex sizing + accent color. */
.caesar__shift-slider {
  flex: 1 1 120px;
  min-width: 100px;
  accent-color: var(--qt-accent);
}

/* Brute-force table — bordered scroll region, sticky head, current-row tint. */
.caesar__bf-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
  max-height: 400px;
  overflow-y: auto;
}
.caesar__bf-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--qt-border);
}
.caesar__bf-row:last-child {
  border-bottom: none;
}
.caesar__bf-row--head {
  position: sticky;
  top: 0;
  background: var(--qt-surface);
  font-weight: 600;
  font-size: 12px;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.caesar__bf-row--current {
  background: oklch(from var(--qt-accent) 95% c h);
}
.caesar__bf-cell {
  padding: 6px 10px;
  font-size: 13.5px;
}
.caesar__bf-cell--shift {
  flex: 0 0 48px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-muted);
  text-align: center;
}
.caesar__bf-cell--result {
  flex: 1 1 auto;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-text);
  word-break: break-all;
}
.caesar__bf-cell--copy {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}
</style>
