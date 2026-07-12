<script setup lang="ts">
/**
 * Bcrypt — hash and verify passwords with bcrypt.
 *
 * Hash mode: input password + cost factor (4-31) → output `$2a$XX$…` encoded
 * bcrypt hash. Salt is 16 random bytes from `crypto.getRandomValues()`.
 *
 * Verify mode: input password + encoded hash → match / no-match.
 *
 * Both operations use `hash-wasm` (`bcrypt` / `bcryptVerify`), lazy-loaded
 * into their own Vite chunk.
 *
 * Works in embed mode: receives `input` PostMessages to set mode/password/
 * hash/cost, and sends `output` PostMessages whenever the result changes.
 */
import { computed } from 'vue';
import { AlertCircle, Check, Loader2, X } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useBcrypt,
  MIN_COST,
  MAX_COST,
  isValidBcryptHash,
} from './useBcrypt';

const {
  mode,
  password,
  cost,
  hash,
  result,
  computing,
  error,
  run,
  setMode,
} = useBcrypt();

/** Whether the verify-mode hash input is well-formed. */
const hashValid = computed(() => hash.value.length === 0 || isValidBcryptHash(hash.value));

/** Number of bcrypt iterations for the current cost factor (2^cost). */
const iterations = computed(() => Math.pow(2, cost.value));

/** Approximate time cost hint for the current cost factor. */
const costHint = computed(() => {
  const c = cost.value;
  if (c <= 8) return 'fast';
  if (c <= 11) return 'moderate';
  if (c <= 14) return 'slow';
  return 'very slow';
});

/** Output text for the "copy" button — the encoded hash in hash mode. */
const outputCopyText = computed(() =>
  mode.value === 'hash' && result.value && result.value.mode === 'hash'
    ? result.value.hash
    : '',
);

function onPasswordInput(e: Event): void {
  password.value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
}

function onHashInput(e: Event): void {
  hash.value = (e.target as HTMLTextAreaElement).value;
}

function onCostInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(v)) cost.value = Math.max(MIN_COST, Math.min(MAX_COST, Math.floor(v)));
}
</script>

<template>
  <div class="bcrypt">
    <div class="bcrypt__mode" role="tablist" aria-label="Bcrypt mode">
      <button
        type="button"
        role="tab"
        class="bcrypt__tab"
        :class="{ 'bcrypt__tab--active': mode === 'hash' }"
        :aria-selected="mode === 'hash'"
        @click="setMode('hash')"
      >
        Hash
      </button>
      <button
        type="button"
        role="tab"
        class="bcrypt__tab"
        :class="{ 'bcrypt__tab--active': mode === 'verify' }"
        :aria-selected="mode === 'verify'"
        @click="setMode('verify')"
      >
        Verify
      </button>
    </div>

    <ToolInput
      :title="mode === 'hash' ? 'Hash a password' : 'Verify a password'"
      :description="mode === 'hash'
        ? `Cost factor ${cost} → 2^${cost} = ${iterations.toLocaleString()} iterations (${costHint}).`
        : 'Enter the password and a $2a$/$2b$/$2y$ encoded bcrypt hash.'"
    >
      <template #actions>
        <button
          class="bcrypt__btn"
          type="button"
          :disabled="computing || password.length === 0 || (mode === 'verify' && hash.length === 0)"
          @click="run"
        >
          <Loader2 v-if="computing" :size="14" class="bcrypt__spin" />
          <span>{{ computing ? 'Working…' : (mode === 'hash' ? 'Hash' : 'Verify') }}</span>
        </button>
      </template>

      <label class="bcrypt__field">
        <span class="bcrypt__label">Password</span>
        <input
          class="bcrypt__input"
          type="text"
          placeholder="Password (max 72 bytes)"
          :value="password"
          spellcheck="false"
          autocomplete="off"
          @input="onPasswordInput"
        />
      </label>

      <div v-if="mode === 'hash'" class="bcrypt__field">
        <div class="bcrypt__cost-head">
          <span class="bcrypt__label">Cost factor (rounds)</span>
          <span class="bcrypt__cost-val">{{ cost }}</span>
        </div>
        <input
          class="bcrypt__range"
          type="range"
          :min="MIN_COST"
          :max="MAX_COST"
          step="1"
          :value="cost"
          @input="onCostInput"
        />
        <div class="bcrypt__cost-marks">
          <span>{{ MIN_COST }}</span>
          <span>{{ MAX_COST }}</span>
        </div>
      </div>

      <label v-else class="bcrypt__field">
        <span class="bcrypt__label">Bcrypt hash</span>
        <textarea
          class="bcrypt__textarea"
          rows="2"
          placeholder="$2a$12$…"
          :value="hash"
          :class="{ 'bcrypt__textarea--err': !hashValid }"
          spellcheck="false"
          autocomplete="off"
          @input="onHashInput"
        />
        <span v-if="!hashValid" class="bcrypt__hint bcrypt__hint--err">
          Expected format: $2a$/$2b$/$2y$XX$ + 53 base64 chars.
        </span>
      </label>
    </ToolInput>

    <ToolOutput
      :title="mode === 'hash' ? 'Bcrypt hash' : 'Verification'"
      :description="mode === 'hash' && result && result.mode === 'hash'
        ? `${result.hash.length} chars · cost ${result.cost}`
        : ''"
      :copy-text="outputCopyText"
      copy-label="Copy hash"
    >
      <p v-if="error" class="bcrypt__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else-if="mode === 'hash'">
        <p v-if="!result || result.mode !== 'hash'" class="bcrypt__empty">
          Enter a password and click "Hash" to compute a bcrypt digest.
        </p>
        <div v-else class="bcrypt__hash-row">
          <code class="bcrypt__hash">{{ result.hash }}</code>
          <CopyButton :text="result.hash" label="Copy" icon-only />
        </div>
      </template>
      <template v-else>
        <p v-if="!result || result.mode !== 'verify'" class="bcrypt__empty">
          Enter a password and a hash, then click "Verify".
        </p>
        <div
          v-else
          class="bcrypt__verify"
          :class="result.match ? 'bcrypt__verify--ok' : 'bcrypt__verify--no'"
        >
          <component
            :is="result.match ? Check : X"
            :size="18"
            class="bcrypt__verify-icon"
          />
          <span>{{ result.match ? 'Match — password is correct' : 'No match — password is incorrect' }}</span>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.bcrypt {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.bcrypt__mode {
  display: inline-flex;
  align-self: flex-start;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 3px;
  gap: 2px;
}
.bcrypt__tab {
  background: transparent;
  border: none;
  border-radius: calc(var(--qt-radius-sm) - 2px);
  color: var(--qt-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
  will-change: background-color;
}
.bcrypt__tab:hover {
  color: var(--qt-text);
}
.bcrypt__tab--active {
  background: var(--qt-accent);
  color: var(--qt-bg);
}
.bcrypt__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bcrypt__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.bcrypt__input,
.bcrypt__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 9px 11px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.bcrypt__input:focus,
.bcrypt__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.bcrypt__textarea {
  resize: vertical;
  min-height: 56px;
  word-break: break-all;
}
.bcrypt__textarea--err {
  border-color: var(--qt-danger);
}
.bcrypt__hint {
  font-size: 11.5px;
  color: var(--qt-muted);
}
.bcrypt__hint--err {
  color: var(--qt-danger);
}
.bcrypt__cost-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.bcrypt__cost-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
.bcrypt__range {
  width: 100%;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.bcrypt__cost-marks {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.bcrypt__btn {
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
.bcrypt__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.bcrypt__btn:active:not(:disabled) {
  transform: translateY(0);
}
.bcrypt__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bcrypt__spin {
  animation: bcrypt-spin 0.8s linear infinite;
}
@keyframes bcrypt-spin {
  to {
    transform: rotate(360deg);
  }
}
.bcrypt__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.bcrypt__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.bcrypt__hash-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 9px 11px;
}
.bcrypt__hash {
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.bcrypt__verify {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: var(--qt-radius-sm);
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid transparent;
}
.bcrypt__verify--ok {
  background: oklch(from var(--qt-success) 95% c h / 0.15);
  border-color: oklch(from var(--qt-success) 70% c h / 0.5);
  color: var(--qt-success);
}
.bcrypt__verify--no {
  background: oklch(from var(--qt-danger) 95% c h / 0.15);
  border-color: oklch(from var(--qt-danger) 70% c h / 0.5);
  color: var(--qt-danger);
}
.bcrypt__verify-icon {
  flex: 0 0 auto;
}
</style>
