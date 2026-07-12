<script setup lang="ts">
/**
 * HmacGenerator — generate HMAC signatures.
 *
 * Supported algorithms: HMAC-SHA1, HMAC-SHA256, HMAC-SHA384, HMAC-SHA512 — all
 * via the Web Crypto API (`crypto.subtle.importKey` + `crypto.subtle.sign`).
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the message,
 * secret, and algorithm, and sends `output` PostMessages whenever the computed
 * signature changes.
 */
import { computed, ref } from 'vue';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useHmacGenerator,
  ALGORITHMS,
  ALGORITHM_MAP,
  type HmacAlgorithm,
} from './useHmacGenerator';

const {
  message,
  secret,
  algorithm,
  result,
  computing,
  error,
  recompute,
  setAlgorithm,
} = useHmacGenerator();

/** Toggle secret visibility (show/hide passphrase). */
const showSecret = ref(false);

/** Char count of the message (for the description line). */
const charCount = computed(() => message.value.length);

function onMessageInput(e: Event): void {
  message.value = (e.target as HTMLTextAreaElement).value;
}

function onSecretInput(e: Event): void {
  secret.value = (e.target as HTMLInputElement).value;
}

function onAlgorithmChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value as HmacAlgorithm;
  if (value in ALGORITHM_MAP) setAlgorithm(value);
}
</script>

<template>
  <div class="hmac-gen">
    <ToolInput
      title="Input"
      description="Message + secret key. HMAC computed via Web Crypto API (crypto.subtle.sign)."
    >
      <template #actions>
        <button
          class="hmac-gen__btn"
          type="button"
          :disabled="computing || message.length === 0"
          @click="recompute"
        >
          <Loader2 v-if="computing" :size="14" class="hmac-gen__spin" />
          <span>{{ computing ? 'Signing…' : 'Sign' }}</span>
        </button>
      </template>

      <label class="hmac-gen__field">
        <span class="hmac-gen__label">Message</span>
        <textarea
          class="hmac-gen__textarea"
          rows="5"
          placeholder="Enter message to sign…"
          :value="message"
          spellcheck="false"
          autocomplete="off"
          @input="onMessageInput"
        />
      </label>

      <label class="hmac-gen__field">
        <span class="hmac-gen__label">Secret key</span>
        <div class="hmac-gen__secret">
          <input
            :type="showSecret ? 'text' : 'password'"
            class="hmac-gen__input"
            placeholder="Enter secret key…"
            :value="secret"
            spellcheck="false"
            autocomplete="off"
            @input="onSecretInput"
          />
          <button
            class="hmac-gen__icon-btn"
            type="button"
            :title="showSecret ? 'Hide secret' : 'Show secret'"
            @click="showSecret = !showSecret"
          >
            <EyeOff v-if="showSecret" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </label>

      <label class="hmac-gen__field">
        <span class="hmac-gen__label">Algorithm</span>
        <select
          class="hmac-gen__select"
          :value="algorithm"
          @change="onAlgorithmChange"
        >
          <option v-for="a in ALGORITHMS" :key="a.id" :value="a.id">
            {{ a.label }} ({{ a.bits }} bits)
          </option>
        </select>
      </label>
    </ToolInput>

    <ToolOutput
      title="HMAC signature"
      :description="result ? `${result.label} · ${charCount} input char${charCount === 1 ? '' : 's'}` : ''"
      :copy-text="result?.hex ?? ''"
      copy-label="Copy hex"
    >
      <p v-if="error" class="hmac-gen__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!result" class="hmac-gen__empty">
        Enter a message above to compute the HMAC.
      </p>
      <div v-else class="hmac-gen__results">
        <div class="hmac-gen__row">
          <div class="hmac-gen__row-head">
            <span class="hmac-gen__row-label">Hex</span>
            <CopyButton :text="result.hex" label="Copy" icon-only />
          </div>
          <code class="hmac-gen__code">{{ result.hex }}</code>
        </div>
        <div class="hmac-gen__row">
          <div class="hmac-gen__row-head">
            <span class="hmac-gen__row-label">Base64</span>
            <CopyButton :text="result.base64" label="Copy" icon-only />
          </div>
          <code class="hmac-gen__code">{{ result.base64 }}</code>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.hmac-gen {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.hmac-gen__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hmac-gen__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.hmac-gen__textarea,
.hmac-gen__input,
.hmac-gen__select {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.hmac-gen__textarea {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  resize: vertical;
  min-height: 100px;
}
.hmac-gen__textarea:focus,
.hmac-gen__input:focus,
.hmac-gen__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.hmac-gen__secret {
  position: relative;
  display: flex;
  align-items: center;
}
.hmac-gen__secret .hmac-gen__input {
  padding-right: 38px;
}
.hmac-gen__icon-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--qt-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--qt-radius-sm);
  transition: color 0.15s ease;
}
.hmac-gen__icon-btn:hover {
  color: var(--qt-text);
}
.hmac-gen__select {
  appearance: none;
  cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--qt-muted) 50%),
    linear-gradient(135deg, var(--qt-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 50%,
    calc(100% - 13px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 32px;
}
.hmac-gen__btn {
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
.hmac-gen__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.hmac-gen__btn:active:not(:disabled) {
  transform: translateY(0);
}
.hmac-gen__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.hmac-gen__spin {
  animation: hmac-gen-spin 0.8s linear infinite;
}
@keyframes hmac-gen-spin {
  to {
    transform: rotate(360deg);
  }
}
.hmac-gen__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.hmac-gen__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.hmac-gen__results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hmac-gen__row {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hmac-gen__row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.hmac-gen__row-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
.hmac-gen__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
