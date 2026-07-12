<script setup lang="ts">
/**
 * EncryptDecrypt — symmetric AES-GCM text encryption/decryption.
 *
 *   - Encrypt: plaintext + passphrase → base64 ciphertext.
 *   - Decrypt: base64 ciphertext + passphrase → plaintext.
 *
 * Key derivation: PBKDF2-HMAC-SHA256 (configurable iterations, default 250k).
 * Cipher: AES-256-GCM (authenticated — tampering is detected on decrypt).
 * Wire format: `[1-byte saltLen][salt][12-byte IV][ciphertext+authTag]`,
 * base64-encoded. No external dependencies — Web Crypto API only.
 *
 * Works in embed mode: receives `input` PostMessages to set mode/text/
 * passphrase/iterations/saltLength and sends `output` PostMessages with the
 * result.
 */
import { computed } from 'vue';
import {
  LockKeyhole,
  UnlockKeyhole,
  ArrowLeftRight,
  AlertCircle,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-vue-next';
import { ref } from 'vue';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useEncryptDecrypt,
  MIN_ITERATIONS,
  MAX_ITERATIONS,
  SALT_LENGTH_OPTIONS,
  type EncryptMode,
} from './useEncryptDecrypt';

const {
  mode,
  text,
  passphrase,
  iterations,
  saltLength,
  output,
  processing,
  error,
  process,
} = useEncryptDecrypt();

const showPassphrase = ref<boolean>(false);

const MODE_OPTIONS: {
  value: EncryptMode;
  label: string;
  hint: string;
  icon: typeof LockKeyhole;
}[] = [
  { value: 'encrypt', label: 'Encrypt', hint: 'plaintext → ciphertext', icon: LockKeyhole },
  { value: 'decrypt', label: 'Decrypt', hint: 'ciphertext → plaintext', icon: UnlockKeyhole },
];

const inputLabel = computed(() =>
  mode.value === 'encrypt' ? 'Plaintext' : 'Ciphertext (base64)',
);
const outputLabel = computed(() =>
  mode.value === 'encrypt' ? 'Ciphertext (base64)' : 'Plaintext',
);
const inputPlaceholder = computed(() =>
  mode.value === 'encrypt'
    ? 'Enter text to encrypt…'
    : 'Paste the base64 ciphertext to decrypt…',
);
const outputPlaceholder = computed(() =>
  mode.value === 'encrypt'
    ? 'Base64 ciphertext will appear here…'
    : 'Recovered plaintext will appear here…',
);
const canProcess = computed(
  () => !processing.value && text.value.trim().length > 0 && passphrase.value.length > 0,
);
const processLabel = computed(() => (mode.value === 'encrypt' ? 'Encrypt' : 'Decrypt'));

function onIterationsInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(v)) {
    iterations.value = Math.max(
      MIN_ITERATIONS,
      Math.min(MAX_ITERATIONS, Math.floor(v)),
    );
  }
}

function switchMode(): void {
  mode.value = mode.value === 'encrypt' ? 'decrypt' : 'encrypt';
  // Swap text and output so re-running is convenient.
  if (output.value) {
    text.value = output.value;
    output.value = '';
  }
}
</script>

<template>
  <div class="enc">
    <ToolInput
      title="Configuration"
      description="AES-256-GCM authenticated encryption. Key derived from your passphrase via PBKDF2-HMAC-SHA256. The salt + IV are generated fresh per encryption and embedded in the output."
    >
      <template #actions>
        <button
          class="enc__process"
          type="button"
          :disabled="!canProcess"
          @click="process"
        >
          <Loader2 v-if="processing" :size="14" class="enc__spin" />
          <Sparkles v-else :size="14" />
          <span>{{ processing ? 'Working…' : processLabel }}</span>
        </button>
      </template>

      <div class="enc__field">
        <span class="enc__label">Mode</span>
        <div class="enc__modes" role="radiogroup" aria-label="Encryption mode">
          <button
            v-for="opt in MODE_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="mode === opt.value"
            class="enc__mode"
            :class="{ 'enc__mode--active': mode === opt.value }"
            :title="opt.hint"
            @click="mode = opt.value"
          >
            <component :is="opt.icon" :size="14" />
            <span class="enc__mode-label">{{ opt.label }}</span>
            <span class="enc__mode-hint">{{ opt.hint }}</span>
          </button>
        </div>
        <button
          class="enc__swap"
          type="button"
          title="Swap mode and move output to input"
          @click="switchMode"
        >
          <ArrowLeftRight :size="12" />
          <span>Swap &amp; feed output back as input</span>
        </button>
      </div>

      <label class="enc__field">
        <span class="enc__label">{{ inputLabel }}</span>
        <textarea
          class="enc__textarea"
          rows="4"
          spellcheck="false"
          autocomplete="off"
          :placeholder="inputPlaceholder"
          :value="text"
          @input="text = ($event.target as HTMLTextAreaElement).value"
        ></textarea>
      </label>

      <label class="enc__field">
        <span class="enc__label">Passphrase</span>
        <div class="enc__passphrase">
          <input
            class="enc__input"
            :type="showPassphrase ? 'text' : 'password'"
            spellcheck="false"
            autocomplete="off"
            placeholder="Passphrase (never sent anywhere — all crypto is local)"
            :value="passphrase"
            @input="passphrase = ($event.target as HTMLInputElement).value"
          />
          <button
            class="enc__peek"
            type="button"
            :title="showPassphrase ? 'Hide passphrase' : 'Show passphrase'"
            :aria-label="showPassphrase ? 'Hide passphrase' : 'Show passphrase'"
            @click="showPassphrase = !showPassphrase"
          >
            <EyeOff v-if="showPassphrase" :size="14" />
            <Eye v-else :size="14" />
          </button>
        </div>
      </label>

      <div class="enc__row">
        <label class="enc__field enc__field--grow">
          <span class="enc__label">PBKDF2 iterations</span>
          <input
            class="enc__input"
            type="number"
            :min="MIN_ITERATIONS"
            :max="MAX_ITERATIONS"
            step="1000"
            :value="iterations"
            @input="onIterationsInput"
          />
          <span class="enc__hint">Higher = slower but harder to brute-force. Default 250 000 (OWASP 2023).</span>
        </label>

        <label class="enc__field">
          <span class="enc__label">Salt length (bytes)</span>
          <select class="enc__select" :value="saltLength" @change="saltLength = Number(($event.target as HTMLSelectElement).value)">
            <option v-for="opt in SALT_LENGTH_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <span class="enc__hint">Used only in encrypt mode.</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="output ? `${output.length} chars` : ''"
      :copy-text="output"
      copy-label="Copy"
    >
      <p v-if="error" class="enc__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!output" class="enc__empty">
        No output yet — enter text + a passphrase and click <strong>{{ processLabel }}</strong>.
      </p>
      <textarea
        v-else
        class="enc__output"
        rows="6"
        readonly
        spellcheck="false"
        :placeholder="outputPlaceholder"
        :value="output"
        @focus="($event.target as HTMLTextAreaElement).select()"
      ></textarea>
    </ToolOutput>
  </div>
</template>

<style scoped>
.enc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.enc__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.enc__field--grow {
  flex: 1 1 auto;
}
.enc__row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.enc__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.enc__hint {
  font-size: 10.5px;
  color: var(--qt-muted);
  opacity: 0.85;
}
.enc__input,
.enc__textarea,
.enc__select,
.enc__output {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 9px 11px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.enc__textarea,
.enc__output {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  resize: vertical;
  word-break: break-all;
  white-space: pre-wrap;
}
.enc__input:focus,
.enc__textarea:focus,
.enc__select:focus,
.enc__output:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.enc__passphrase {
  position: relative;
  display: flex;
  align-items: center;
}
.enc__passphrase .enc__input {
  padding-right: 38px;
}
.enc__peek {
  position: absolute;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  cursor: pointer;
  transition: color 0.15s ease;
}
.enc__peek:hover {
  color: var(--qt-text);
}
.enc__modes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.enc__mode {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  padding: 10px 12px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
  will-change: border-color;
}
.enc__mode:hover {
  border-color: var(--qt-accent);
  color: var(--qt-text);
}
.enc__mode--active {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.15);
  color: var(--qt-accent);
}
.enc__mode-label {
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}
.enc__mode-hint {
  font-size: 10.5px;
  opacity: 0.85;
}
.enc__swap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--qt-muted);
  font: inherit;
  font-size: 11.5px;
  padding: 4px 0;
  cursor: pointer;
  transition: color 0.15s ease;
}
.enc__swap:hover {
  color: var(--qt-accent);
}
.enc__process {
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
.enc__process:hover:not(:disabled) {
  transform: translateY(-1px);
}
.enc__process:active:not(:disabled) {
  transform: translateY(0);
}
.enc__process:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.enc__spin {
  animation: enc-spin 0.8s linear infinite;
}
@keyframes enc-spin {
  to {
    transform: rotate(360deg);
  }
}
.enc__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.enc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
</style>
