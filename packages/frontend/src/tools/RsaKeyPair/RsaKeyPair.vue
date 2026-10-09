<script setup lang="ts">
/**
 * RsaKeyPair - RSA key pair generator.
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
import { useI18n } from 'vue-i18n';
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

const { t, locale } = useI18n();

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

/** Localized hint for a key size (composable hints stay English constants). */
function sizeHint(bits: KeySize): string {
  return t(`tools.rsa-key-pair-generator.ui.size${bits}`);
}

function onSelectSize(e: Event): void {
  const value = Number((e.target as HTMLSelectElement).value);
  setKeySize(value as KeySize);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.configuration')"
      :description="t('tools.rsa-key-pair-generator.ui.desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="generating"
          @click="generate"
        >
          <Loader2 v-if="generating" :size="14" class="qt-spin" />
          <span>{{ generating ? t('common.generating') : t('common.generate') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t('tools.rsa-key-pair-generator.ui.keySize') }}</span>
        <select
          class="qt-input"
          :value="keySize"
          :disabled="generating"
          @change="onSelectSize"
        >
          <option v-for="info in KEY_SIZE_INFOS" :key="info.value" :value="info.value">
            {{ info.label }} - {{ sizeHint(info.value) }}
          </option>
        </select>
      </label>

      <p v-if="currentInfo" class="qt-hint">
        {{ t('tools.rsa-key-pair-generator.ui.sizeHint', { hint: sizeHint(currentInfo.value) }) }}
      </p>
    </ToolInput>

    <ToolOutput
      :title="t('tools.rsa-key-pair-generator.ui.outputTitle')"
      :description="result ? t('tools.rsa-key-pair-generator.ui.outputDesc', { bits: result.bits, time: new Date(result.generatedAt).toLocaleTimeString(locale) }) : ''"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="generating" class="qt-alert qt-alert--empty">
        <Loader2 :size="14" class="qt-spin" />
        <span>{{ t('tools.rsa-key-pair-generator.ui.generating', { bits: keySize }) }}</span>
      </p>
      <p v-else-if="!result" class="qt-alert qt-alert--empty">
        {{ t('tools.rsa-key-pair-generator.ui.empty') }}
      </p>
      <div v-else class="qt-stack" style="--qt-stack-gap:10px">
        <div class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="rsa-kp__row-label">
              <Key :size="14" />
              <span>{{ t('tools.rsa-key-pair-generator.ui.publicKey') }}</span>
            </span>
            <CopyButton :text="result.publicPem" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono rsa-kp__code">{{ result.publicPem }}</code>
        </div>
        <div class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="rsa-kp__row-label rsa-kp__row-label--priv">
              <Lock :size="14" />
              <span>{{ t('tools.rsa-key-pair-generator.ui.privateKey') }}</span>
            </span>
            <CopyButton :text="result.privatePem" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono rsa-kp__code rsa-kp__code--priv">{{ result.privatePem }}</code>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Key-row label (text-colored, icon + text; --priv flags the private key). */
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
/* PEM block (font via .qt-mono) — scrollable, pre-wrapped. */
.rsa-kp__code {
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
