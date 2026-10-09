<script setup lang="ts">
/**
 * AsciiBinary - convert text to ASCII/UTF-8 binary and back.
 *
 * Bidirectional: text → binary (encode) and binary → text (decode). UTF-8
 * safe via TextEncoder/TextDecoder, so any Unicode input (emoji, CJK,
 * combining marks) round-trips correctly. Each byte is rendered as 8
 * zero-padded bits; bytes are joined with a configurable separator
 * (default a single space, or a contiguous stream when "none").
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the
 * input, select the mode, and set the separator; sends `output`
 * PostMessages whenever the computed output changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, ArrowLeftRight, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useAsciiBinary,
  type BinaryMode,
} from './useAsciiBinary';

const {
  input,
  mode,
  separator,
  outputs,
  error,
  recompute,
  setMode,
  setSeparator,
  swap,
} = useAsciiBinary();

const { t } = useI18n();
const U = 'tools.text-to-ascii-binary.ui.';

const placeholder = computed(() =>
  mode.value === 'encode'
    ? t(U + 'placeholderEncode')
    : t(U + 'placeholderDecode'),
);

const inputLabel = computed(() => (mode.value === 'encode' ? t('common.text') : t(U + 'binary')));
const outputLabel = computed(() => (mode.value === 'encode' ? t(U + 'binary') : t('common.text')));

const description = computed(() =>
  mode.value === 'encode'
    ? separator.value.length === 0
      ? t(U + 'descEncodeContiguous')
      : t(U + 'descEncodeSep')
    : t(U + 'descDecode'),
);

/** Whether the custom separator input is currently shown. */
const isCustomSeparator = computed(
  () => separator.value !== ' ' && separator.value !== '',
);

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onModeChange(m: BinaryMode): void {
  setMode(m);
}

function onPresetSeparator(preset: 'space' | 'none'): void {
  setSeparator(preset === 'space' ? ' ' : '');
}

function onCustomSeparator(e: Event): void {
  const v = (e.target as HTMLInputElement).value;
  setSeparator(v);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="description">
      <template #actions>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :title="t('common.swapTitle')"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t('common.direction') }}</span>
        <div class="bin__mode-toggle">
          <button
            type="button"
            class="bin__mode-opt"
            :class="{ 'bin__mode-opt--active': mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            @click="onModeChange('encode')"
          >
            {{ t('common.encode') }}
          </button>
          <button
            type="button"
            class="bin__mode-opt"
            :class="{ 'bin__mode-opt--active': mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            @click="onModeChange('decode')"
          >
            {{ t('common.decode') }}
          </button>
        </div>
      </div>

      <div v-if="mode === 'encode'" class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t(U + 'separator') }}</span>
        <div class="bin__sep-toggle">
          <button
            type="button"
            class="bin__sep-opt"
            :class="{ 'bin__sep-opt--active': separator === ' ' }"
            :aria-pressed="separator === ' '"
            @click="onPresetSeparator('space')"
          >
            {{ t(U + 'sepSpace') }}
          </button>
          <button
            type="button"
            class="bin__sep-opt"
            :class="{ 'bin__sep-opt--active': separator === '' }"
            :aria-pressed="separator === ''"
            @click="onPresetSeparator('none')"
          >
            {{ t(U + 'sepNone') }}
          </button>
          <button
            type="button"
            class="bin__sep-opt"
            :class="{ 'bin__sep-opt--active': isCustomSeparator }"
            :aria-pressed="isCustomSeparator"
            :title="t(U + 'sepCustomTitle')"
            @click="setSeparator(isCustomSeparator ? ' ' : ', ')"
          >
            {{ t(U + 'sepCustom') }}
          </button>
        </div>
        <input
          v-if="isCustomSeparator"
          class="qt-input qt-input--mono bin__sep-input"
          type="text"
          :value="separator"
          :placeholder="t(U + 'sepCustomPlaceholder')"
          spellcheck="false"
          autocomplete="off"
          @input="onCustomSeparator"
        />
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ inputLabel }}</span>
        <textarea
          class="qt-input qt-input--mono bin__textarea"
          :placeholder="placeholder"
          :value="input"
          rows="6"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="outputs ? t(U + 'outputDesc', { bytes: outputs.byteCount, chars: outputs.outputBytes }) : t('common.enterToConvert')"
      :copy-text="outputs?.output ?? ''"
      :copy-label="t('common.copyResult')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t('common.enterToConvert') }}
        </p>
        <div v-if="outputs" class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="qt-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono bin__code">{{ outputs.output || '-' }}</code>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'bytesIn', { n: outputs.inputBytes }) }}</span>
            <span class="bin__dot">·</span>
            <span>{{ t(U + 'byteGroups', { n: outputs.byteCount }) }}</span>
            <span class="bin__dot">·</span>
            <span>{{ t(U + 'bytesOut', { n: outputs.outputBytes }) }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Direction + separator pill segmented controls (solid-accent active). */
.bin__mode-toggle,
.bin__sep-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
}
.bin__mode-opt,
.bin__sep-opt {
  padding: 5px 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}
.bin__mode-opt--active,
.bin__sep-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Custom-separator input width (control + mono via .qt-input--mono). */
.bin__sep-input {
  width: 140px;
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.bin__textarea {
  min-height: 120px;
}
/* Output code (font via .qt-mono) — break-anywhere, pre-wrapped. */
.bin__code {
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Meta separator dot. */
.bin__dot {
  opacity: 0.6;
}
</style>
