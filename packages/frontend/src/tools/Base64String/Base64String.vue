<script setup lang="ts">
/**
 * Base64String — encode and decode Base64 strings.
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

const placeholder = computed(() =>
  mode.value === 'encode'
    ? 'Enter text to encode…'
    : urlSafe.value
      ? 'Enter URL-safe Base64…'
      : 'Enter Base64 to decode…',
);

const inputLabel = computed(() => (mode.value === 'encode' ? 'Text' : 'Base64'));
const outputLabel = computed(() => (mode.value === 'encode' ? 'Base64' : 'Text'));

const description = computed(() =>
  mode.value === 'encode'
    ? urlSafe.value
      ? 'Encode UTF-8 text to URL-safe Base64 (-_ alphabet, no padding).'
      : 'Encode UTF-8 text to standard Base64 (+/ alphabet, = padding).'
    : urlSafe.value
      ? 'Decode URL-safe Base64 (-_ alphabet) back to UTF-8 text.'
      : 'Decode standard Base64 (+/ alphabet) back to UTF-8 text.',
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
  <div class="b64">
    <ToolInput title="Input" :description="description">
      <template #actions>
        <button
          class="b64__btn b64__btn--ghost"
          type="button"
          title="Swap direction and feed the result back as input"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="b64__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="b64__mode-row">
        <span class="b64__label">Direction</span>
        <div class="b64__mode-toggle">
          <button
            type="button"
            class="b64__mode-opt"
            :class="{ 'b64__mode-opt--active': mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            @click="onModeChange('encode')"
          >
            Encode
          </button>
          <button
            type="button"
            class="b64__mode-opt"
            :class="{ 'b64__mode-opt--active': mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            @click="onModeChange('decode')"
          >
            Decode
          </button>
        </div>
        <button
          type="button"
          class="b64__urlsafe"
          :class="{ 'b64__urlsafe--active': urlSafe }"
          :aria-pressed="urlSafe"
          title="Use URL-safe alphabet (-_ instead of +/, no padding)"
          @click="onUrlSafeToggle"
        >
          <Link2 :size="13" />
          <span>URL-safe</span>
        </button>
      </div>

      <label class="b64__field">
        <span class="b64__label">{{ inputLabel }}</span>
        <textarea
          class="b64__textarea b64__textarea--mono"
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
      :description="outputs ? `Result (${outputs.outputBytes} bytes out)` : 'Enter a value above to convert.'"
      :copy-text="outputs?.output ?? ''"
      copy-label="Copy result"
    >
      <p v-if="error" class="b64__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="b64__empty">
          Enter a value above to convert.
        </p>
        <div v-if="outputs" class="b64__result">
          <div class="b64__result-head">
            <span class="b64__result-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" label="Copy" icon-only />
          </div>
          <code class="b64__code">{{ outputs.output || '—' }}</code>
          <div class="b64__meta">
            <span>{{ outputs.inputBytes }} bytes in</span>
            <span class="b64__dot">·</span>
            <span>{{ outputs.outputBytes }} bytes out</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.b64 {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.b64__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.b64__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.b64__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.b64__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.b64__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.b64__mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
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
  will-change: color, background;
}
.b64__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.b64__urlsafe {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 11px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: color, border-color;
}
.b64__urlsafe--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.b64__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.b64__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.b64__btn:active:not(:disabled) {
  transform: translateY(0);
}
.b64__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.b64__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.b64__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.b64__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.b64__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.b64__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.b64__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.b64__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.b64__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.b64__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
}
.b64__dot {
  opacity: 0.6;
}
</style>
