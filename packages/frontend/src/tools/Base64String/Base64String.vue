<script setup lang="ts">
/**
 * Base64String - encode and decode Base64 strings.
 *
 * Bidirectional: text → Base64 (encode) and Base64 → text (decode). UTF-8
 * safe via TextEncoder/TextDecoder, so any Unicode input (emoji, CJK,
 * combining marks) round-trips correctly. Supports the standard
 * (`+/=`) and URL-safe (`-_`, no padding) alphabets.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the
 * input, select the mode, and toggle URL-safe; sends `output`
 * PostMessages whenever the computed output changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, ArrowLeftRight, RefreshCw, Link2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useBase64String,
  type Base64Mode,
} from './useBase64String';

const {
  input,
  mode,
  urlSafe,
  outputs,
  error,
  recompute,
  setMode,
  swap,
} = useBase64String();

const { t } = useI18n();
const U = 'tools.base64-string.ui.';

const placeholder = computed(() =>
  mode.value === 'encode'
    ? t(U + 'placeholderEncode')
    : urlSafe.value
      ? t(U + 'placeholderDecodeUrl')
      : t(U + 'placeholderDecode'),
);

const inputLabel = computed(() => (mode.value === 'encode' ? t('common.text') : t('common.base64')));
const outputLabel = computed(() => (mode.value === 'encode' ? t('common.base64') : t('common.text')));

const description = computed(() =>
  mode.value === 'encode'
    ? urlSafe.value
      ? t(U + 'descEncodeUrl')
      : t(U + 'descEncodeStd')
    : urlSafe.value
      ? t(U + 'descDecodeUrl')
      : t(U + 'descDecodeStd'),
);

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onModeChange(m: Base64Mode): void {
  setMode(m);
}

function onUrlSafeToggle(): void {
  urlSafe.value = !urlSafe.value;
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
        <div class="b64__mode-toggle">
          <button
            type="button"
            class="b64__mode-opt"
            :class="{ 'b64__mode-opt--active': mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            @click="onModeChange('encode')"
          >
            {{ t('common.encode') }}
          </button>
          <button
            type="button"
            class="b64__mode-opt"
            :class="{ 'b64__mode-opt--active': mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            @click="onModeChange('decode')"
          >
            {{ t('common.decode') }}
          </button>
        </div>
        <button
          type="button"
          class="qt-chip qt-chip--filled"
          :class="{ 'qt-chip--solid': urlSafe }"
          :aria-pressed="urlSafe"
          :title="t('common.urlSafeTitle')"
          @click="onUrlSafeToggle"
        >
          <Link2 :size="13" />
          <span>{{ t('common.urlSafe') }}</span>
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ inputLabel }}</span>
        <textarea
          class="qt-input qt-input--mono b64__textarea"
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
      :description="outputs ? t(U + 'outputDesc', { bytes: outputs.outputBytes }) : t('common.enterToConvert')"
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
          <code class="qt-mono b64__code">{{ outputs.output || '-' }}</code>
          <div class="qt-row qt-row--center qt-hint" style="--qt-row-gap:6px">
            <span>{{ t(U + 'bytesIn', { n: outputs.inputBytes }) }}</span>
            <span class="b64__dot">·</span>
            <span>{{ t(U + 'bytesOut', { n: outputs.outputBytes }) }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Direction pill segmented control (solid-accent active). */
.b64__mode-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
}
.b64__mode-opt {
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
.b64__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.b64__textarea {
  min-height: 120px;
}
/* Output code (font via .qt-mono) — break-anywhere, pre-wrapped. */
.b64__code {
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Meta separator dot. */
.b64__dot {
  opacity: 0.6;
}
</style>
