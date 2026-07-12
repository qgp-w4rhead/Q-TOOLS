<script setup lang="ts">
/**
 * RsaKeyPair — RSA key pair generator.
 *
 * Generates RSA key pairs (2048 / 4096 / 8192 bits) using the Web Crypto API
 * and exports them as PEM strings via `node-forge` (lazy-loaded). The public
 * key is exported as SubjectPublicKeyInfo (`-----BEGIN PUBLIC KEY-----`) and
 * the private key as PKCS#8 PrivateKeyInfo (`-----BEGIN PRIVATE KEY-----`).
 *
 * Works in embed mode: receives `input` PostMessages to set the key size and
 * trigger generation, and sends `output` PostMessages with the PEM strings
 * whenever a new key pair is generated.
 */
import { computed } from 'vue';
import { AlertCircle, Key, Loader2, Lock } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useRsaKeyPair,
  KEY_SIZE_INFOS,
  KEY_SIZE_MAP,
  type KeySize,
} from './useRsaKeyPair';

const {
  keySize,
  result,
  generating,
  error,
  generate,
  setKeySize,
} = useRsaKeyPair();

/** Currently selected key-size info (for the hint display). */
const currentInfo = computed(() => KEY_SIZE_MAP[keySize.value]);

function onSelectSize(e: Event): void {
  const value = Number((e.target as HTMLSelectElement).value);
  setKeySize(value as KeySize);
}
</script>

<template>
  <div class="rsa-kp">
    <ToolInput
      title="Configuration"
      description="RSA key pairs generated via Web Crypto API (crypto.subtle.generateKey). PEM export via node-forge."
    >
      <template #actions>
        <button
          class="rsa-kp__btn"
          type="button"
          :disabled="generating"
          @click="generate"
        >
          <Loader2 v-if="generating" :size="14" class="rsa-kp__spin" />
          <span>{{ generating ? 'Generating…' : 'Generate' }}</span>
        </button>
      </template>

      <label class="rsa-kp__field">
        <span class="rsa-kp__label">Key size</span>
        <select
          class="rsa-kp__select"
          :value="keySize"
          :disabled="generating"
          @change="onSelectSize"
        >
          <option v-for="info in KEY_SIZE_INFOS" :key="info.value" :value="info.value">
            {{ info.label }} — {{ info.hint }}
          </option>
        </select>
      </label>

      <p v-if="currentInfo" class="rsa-kp__hint">
        {{ currentInfo.hint }}. Larger keys take longer to generate.
      </p>
    </ToolInput>

    <ToolOutput
      title="Key pair"
      :description="result ? `${result.bits}-bit · generated ${new Date(result.generatedAt).toLocaleTimeString()}` : ''"
    >
      <p v-if="error" class="rsa-kp__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="generating" class="rsa-kp__generating">
        <Loader2 :size="14" class="rsa-kp__spin" />
        <span>Generating {{ keySize }}-bit RSA key pair…</span>
      </p>
      <p v-else-if="!result" class="rsa-kp__empty">
        Click “Generate” to create an RSA key pair.
      </p>
      <div v-else class="rsa-kp__results">
        <div class="rsa-kp__row">
          <div class="rsa-kp__row-head">
            <span class="rsa-kp__row-label">
              <Key :size="14" />
              <span>Public key</span>
            </span>
            <CopyButton :text="result.publicPem" label="Copy" icon-only />
          </div>
          <code class="rsa-kp__code rsa-kp__code--pub">{{ result.publicPem }}</code>
        </div>
        <div class="rsa-kp__row">
          <div class="rsa-kp__row-head">
            <span class="rsa-kp__row-label rsa-kp__row-label--priv">
              <Lock :size="14" />
              <span>Private key</span>
            </span>
            <CopyButton :text="result.privatePem" label="Copy" icon-only />
          </div>
          <code class="rsa-kp__code rsa-kp__code--priv">{{ result.privatePem }}</code>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.rsa-kp {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.rsa-kp__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rsa-kp__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.rsa-kp__select {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--qt-muted) 50%),
    linear-gradient(135deg, var(--qt-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 50%,
    calc(100% - 13px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 32px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.rsa-kp__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.rsa-kp__select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.rsa-kp__hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.rsa-kp__btn {
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
.rsa-kp__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.rsa-kp__btn:active:not(:disabled) {
  transform: translateY(0);
}
.rsa-kp__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rsa-kp__spin {
  animation: rsa-kp-spin 0.8s linear infinite;
}
@keyframes rsa-kp-spin {
  to {
    transform: rotate(360deg);
  }
}
.rsa-kp__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.rsa-kp__generating {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.rsa-kp__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.rsa-kp__results {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rsa-kp__row {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rsa-kp__row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rsa-kp__row-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
.rsa-kp__row-label--priv {
  color: var(--qt-danger);
}
.rsa-kp__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  display: block;
  max-height: 280px;
  overflow-y: auto;
}
.rsa-kp__code--priv {
  border-left: 2px solid var(--qt-danger);
  padding-left: 8px;
}
</style>
