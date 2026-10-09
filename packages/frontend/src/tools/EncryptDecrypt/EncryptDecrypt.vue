<script setup lang="ts">
/**
 * EncryptDecrypt - symmetric AES-GCM text encryption/decryption.
 *
 *   - Encrypt: plaintext + passphrase → base64 ciphertext.
 *   - Decrypt: base64 ciphertext + passphrase → plaintext.
 *
 * Key derivation: PBKDF2-HMAC-SHA256 (configurable iterations, default 250k).
 * Cipher: AES-256-GCM (authenticated - tampering is detected on decrypt).
 * Wire format: `[1-byte saltLen][salt][12-byte IV][ciphertext+authTag]`,
 * base64-encoded. No external dependencies - Web Crypto API only.
 *
 * Works in embed mode: receives `input` PostMessages to set mode/text/
 * passphrase/iterations/saltLength and sends `output` PostMessages with the
 * result.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();

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
  labelKey: string;
  hintKey: string;
  icon: typeof LockKeyhole;
}[] = [
  { value: 'encrypt', labelKey: 'encrypt', hintKey: 'encryptHint', icon: LockKeyhole },
  { value: 'decrypt', labelKey: 'decrypt', hintKey: 'decryptHint', icon: UnlockKeyhole },
];

const inputLabel = computed(() =>
  mode.value === 'encrypt'
    ? t('tools.encrypt-decrypt-text.ui.plaintext')
    : t('tools.encrypt-decrypt-text.ui.ciphertext'),
);
const outputLabel = computed(() =>
  mode.value === 'encrypt'
    ? t('tools.encrypt-decrypt-text.ui.ciphertext')
    : t('tools.encrypt-decrypt-text.ui.plaintext'),
);
const inputPlaceholder = computed(() =>
  mode.value === 'encrypt'
    ? t('tools.encrypt-decrypt-text.ui.inputPlaceholderEncrypt')
    : t('tools.encrypt-decrypt-text.ui.inputPlaceholderDecrypt'),
);
const outputPlaceholder = computed(() =>
  mode.value === 'encrypt'
    ? t('tools.encrypt-decrypt-text.ui.outputPlaceholderEncrypt')
    : t('tools.encrypt-decrypt-text.ui.outputPlaceholderDecrypt'),
);
const canProcess = computed(
  () => !processing.value && text.value.trim().length > 0 && passphrase.value.length > 0,
);
const processLabel = computed(() =>
  mode.value === 'encrypt'
    ? t('tools.encrypt-decrypt-text.ui.encrypt')
    : t('tools.encrypt-decrypt-text.ui.decrypt'),
);

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
  <div class="qt-tool">
    <ToolInput
      :title="t('common.configuration')"
      :description="t('tools.encrypt-decrypt-text.ui.desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="!canProcess"
          @click="process"
        >
          <Loader2 v-if="processing" :size="14" class="qt-spin" />
          <Sparkles v-else :size="14" />
          <span>{{ processing ? t('common.working') : processLabel }}</span>
        </button>
      </template>

      <div class="qt-field">
        <span class="qt-label">{{ t('common.mode') }}</span>
        <div class="enc__modes" role="radiogroup" :aria-label="t('tools.encrypt-decrypt-text.ui.modeLabel')">
          <button
            v-for="opt in MODE_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="mode === opt.value"
            class="enc__mode"
            :class="{ 'enc__mode--active': mode === opt.value }"
            :title="t(`tools.encrypt-decrypt-text.ui.${opt.hintKey}`)"
            @click="mode = opt.value"
          >
            <component :is="opt.icon" :size="14" />
            <span class="enc__mode-label">{{ t(`tools.encrypt-decrypt-text.ui.${opt.labelKey}`) }}</span>
            <span class="enc__mode-hint">{{ t(`tools.encrypt-decrypt-text.ui.${opt.hintKey}`) }}</span>
          </button>
        </div>
        <button
          class="enc__swap"
          type="button"
          :title="t('tools.encrypt-decrypt-text.ui.swapTitle')"
          @click="switchMode"
        >
          <ArrowLeftRight :size="12" />
          <span>{{ t('tools.encrypt-decrypt-text.ui.swap') }}</span>
        </button>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ inputLabel }}</span>
        <textarea
          class="qt-input qt-input--mono enc__textarea"
          rows="4"
          spellcheck="false"
          autocomplete="off"
          :placeholder="inputPlaceholder"
          :value="text"
          @input="text = ($event.target as HTMLTextAreaElement).value"
        ></textarea>
      </label>

      <label class="qt-field">
        <span class="qt-label">{{ t('tools.encrypt-decrypt-text.ui.passphrase') }}</span>
        <div class="qt-input-wrap">
          <input
            class="qt-input"
            :type="showPassphrase ? 'text' : 'password'"
            spellcheck="false"
            autocomplete="off"
            :placeholder="t('tools.encrypt-decrypt-text.ui.passphrasePlaceholder')"
            :value="passphrase"
            @input="passphrase = ($event.target as HTMLInputElement).value"
          />
          <button
            class="qt-input-btn"
            type="button"
            :title="showPassphrase ? t('tools.encrypt-decrypt-text.ui.hidePassphrase') : t('tools.encrypt-decrypt-text.ui.showPassphrase')"
            :aria-label="showPassphrase ? t('tools.encrypt-decrypt-text.ui.hidePassphrase') : t('tools.encrypt-decrypt-text.ui.showPassphrase')"
            @click="showPassphrase = !showPassphrase"
          >
            <EyeOff v-if="showPassphrase" :size="14" />
            <Eye v-else :size="14" />
          </button>
        </div>
      </label>

      <div class="qt-row">
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t('tools.encrypt-decrypt-text.ui.iterations') }}</span>
          <input
            class="qt-input"
            type="number"
            :min="MIN_ITERATIONS"
            :max="MAX_ITERATIONS"
            step="1000"
            :value="iterations"
            @input="onIterationsInput"
          />
          <span class="qt-hint">{{ t('tools.encrypt-decrypt-text.ui.iterationsHint') }}</span>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t('tools.encrypt-decrypt-text.ui.saltLength') }}</span>
          <select class="qt-input" :value="saltLength" @change="saltLength = Number(($event.target as HTMLSelectElement).value)">
            <option v-for="opt in SALT_LENGTH_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <span class="qt-hint">{{ t('tools.encrypt-decrypt-text.ui.saltHint') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="output ? t('common.chars', { n: output.length }) : ''"
      :copy-text="output"
      :copy-label="t('common.copy')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!output" class="qt-alert qt-alert--empty">
        {{ t('tools.encrypt-decrypt-text.ui.empty', { action: processLabel }) }}
      </p>
      <textarea
        v-else
        class="qt-output enc__output"
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
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Mode picker — fixed 2-col grid of selectable cards. */
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
/* Subtle inline "swap & feed back" action. */
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
/* Input/output textareas — mono + break (control via .qt-input/.qt-output). */
.enc__textarea,
.enc__output {
  font-size: 13px;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
