<script setup lang="ts">
/**
 * SshKeyGenerator - generate an Ed25519 SSH key pair via Web Crypto.
 *
 * Exports OpenSSH formats: `ssh-ed25519 <base64> [comment]` public key,
 * `-----BEGIN OPENSSH PRIVATE KEY-----` (openssh-key-v1, unencrypted) private
 * key, and a `SHA256:` fingerprint. The 32-byte seed is recovered from the
 * PKCS#8 export. Requires a browser with Web Crypto Ed25519 (Chrome 137+,
 * Firefox 129+, Safari 17+).
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ comment,
 * action: 'generate' }`; sends `output` PostMessages with `{ publicKey,
 * privateKey, fingerprint }`.
 */
import { useI18n } from 'vue-i18n';
import { Eye, EyeOff, KeyRound, Loader2, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useSshKeyGenerator } from './useSshKeyGenerator';

const { t } = useI18n();
const U = 'tools.ssh-key-generator.ui.';

const {
  comment,
  result,
  busy,
  error,
  supported,
  showPrivate,
  generate,
} = useSshKeyGenerator();
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <ToolField
        v-model="comment"
        :label="t(U + 'commentLabel')"
        :placeholder="t(U + 'phComment')"
        spellcheck="false"
        autocomplete="off"
      />
      <ToolButton
        variant="primary"
        :disabled="busy || !supported"
        @click="generate"
      >
        <Loader2 v-if="busy" :size="14" class="qt-spin" />
        <RefreshCw v-else :size="14" />
        {{ result ? t(U + 'btnRegenerate') : t(U + 'btnGenerate') }}
      </ToolButton>
      <p v-if="!supported" style="margin:0;font-size:13px;color:var(--qt-warning)">
        {{ t(U + 'unsupportedWarn') }}
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descFingerprint', { fp: result.fingerprint }) : t(U + 'descEmpty')"
      hide-copy
    >
      <template v-if="error">
        <ToolAlert kind="error">{{ error }}</ToolAlert>
      </template>
      <template v-else-if="!result">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else>
        <div class="qt-result">
          <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:10px;flex-wrap:nowrap">
            <span class="qt-stat-head"><KeyRound :size="13" /> {{ t(U + 'pubKeyLabel') }}</span>
            <CopyButton :text="result.publicKey" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono" style="font-size:12px;word-break:break-all;white-space:pre-wrap">{{ result.publicKey }}</code>
        </div>

        <div class="qt-result">
          <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:10px;flex-wrap:nowrap">
            <span class="qt-stat-head"><KeyRound :size="13" /> {{ t(U + 'privKeyLabel') }}</span>
            <div class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap">
              <ToolButton
                :aria-pressed="showPrivate"
                @click="showPrivate = !showPrivate"
              >
                <component :is="showPrivate ? EyeOff : Eye" :size="13" />
                {{ showPrivate ? t(U + 'btnHide') : t(U + 'btnReveal') }}
              </ToolButton>
              <CopyButton :text="result.privateKey" :label="t('common.copy')" icon-only />
            </div>
          </div>
          <code v-if="showPrivate" class="qt-mono ssh__code--priv" style="font-size:12px;word-break:break-all;white-space:pre-wrap">{{ result.privateKey }}</code>
          <p v-else class="qt-hint" style="font-style:italic">{{ t(U + 'privHidden') }}</p>
        </div>

        <div class="qt-result">
          <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:10px;flex-wrap:nowrap">
            <span class="qt-stat-head">{{ t(U + 'fingerprintLabel') }}</span>
            <CopyButton :text="result.fingerprint" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono" style="font-size:12px;word-break:break-all;white-space:pre-wrap">{{ result.fingerprint }}</code>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Private key shown in warning color. */
.ssh__code--priv { color: var(--qt-warning); }
</style>
