<script setup lang="ts">
/**
 * CertificateDecoder - paste a PEM certificate to see parsed issuer, subject,
 * validity, SAN, key usage, serial, and more.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useCertificateDecoder,
} from './useCertificateDecoder';

const { t, locale } = useI18n();
const U = 'tools.certificate-decoder.ui.';

const {
  pemInput,
  result,
  isParsing,
  decode,
  reset,
} = useCertificateDecoder();

const SUBJ_KEYS: Record<string, string> = {
  CN: 'subjCn',
  O: 'subjO',
  OU: 'subjOu',
  L: 'subjL',
  ST: 'subjSt',
  C: 'subjC',
  emailAddress: 'subjEmail',
};

function subjectLabel(key: string): string {
  const k = SUBJ_KEYS[key];
  return k ? t(U + k) : key;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.reset')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="pemInput"
        :label="t(U + 'pemLabel')"
        as="textarea"
        mono
        :rows="8"
        placeholder="-----BEGIN CERTIFICATE-----&#10;MIIFazCCBFOgAwIBAgIRAIIQz7DSQONqrGP...&#10;-----END CERTIFICATE-----"
      />

      <div class="qt-row" style="--qt-row-gap:8px">
        <ToolButton
          variant="primary"
          :disabled="!pemInput.trim() || isParsing"
          @click="decode"
        >
          <Loader2 v-if="isParsing" :size="14" class="qt-spin" />
          <span>{{ isParsing ? t(U + 'btnParsing') : t(U + 'btnDecode') }}</span>
        </ToolButton>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :hide-copy="true"
    >
      <ToolAlert v-if="result.error" kind="error">
        {{ result.error }}
      </ToolAlert>

      <div v-else-if="result.info" class="qt-stack" style="--qt-stack-gap:14px">
        <!-- Validity status -->
        <div class="cd__status" :class="{ 'cd__status--valid': result.info.isValid, 'cd__status--expired': result.info.isExpired, 'cd__status--notyet': result.info.isNotYetValid }">
          <span v-if="result.info.isValid" class="qt-badge qt-badge--success">{{ t(U + 'badgeValid') }}</span>
          <span v-else-if="result.info.isExpired" class="qt-badge qt-badge--error">{{ t(U + 'badgeExpired') }}</span>
          <span v-else class="qt-badge qt-badge--warn">{{ t(U + 'badgeNotYet') }}</span>
          <span class="qt-hint" style="font-size:12.5px">
            {{ new Date(result.info.validFrom).toLocaleDateString(locale) }} → {{ new Date(result.info.validTo).toLocaleDateString(locale) }}
          </span>
        </div>

        <!-- Subject -->
        <div class="qt-stack">
          <div class="qt-stat-head" style="padding-bottom:4px;border-bottom:1px solid var(--qt-border)">{{ t(U + 'secSubject') }}</div>
          <div class="qt-stack" style="--qt-stack-gap:4px">
            <div v-for="(val, key) in result.info.subject" :key="key" class="cd__kv-row">
              <span class="cd__kv-key">{{ subjectLabel(key) }}</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all">{{ val }}</span>
            </div>
          </div>
        </div>

        <!-- Issuer -->
        <div class="qt-stack">
          <div class="qt-stat-head" style="padding-bottom:4px;border-bottom:1px solid var(--qt-border)">{{ t(U + 'secIssuer') }}</div>
          <div class="qt-stack" style="--qt-stack-gap:4px">
            <div v-for="(val, key) in result.info.issuer" :key="key" class="cd__kv-row">
              <span class="cd__kv-key">{{ subjectLabel(key) }}</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all">{{ val }}</span>
            </div>
          </div>
        </div>

        <!-- Technical details -->
        <div class="qt-stack">
          <div class="qt-stat-head" style="padding-bottom:4px;border-bottom:1px solid var(--qt-border)">{{ t(U + 'secTech') }}</div>
          <div class="qt-stack" style="--qt-stack-gap:4px">
            <div class="cd__kv-row">
              <span class="cd__kv-key">{{ t(U + 'rowSerial') }}</span>
              <code class="qt-mono" style="font-size:12px;word-break:break-all">{{ result.info.serialNumber }}</code>
            </div>
            <div class="cd__kv-row">
              <span class="cd__kv-key">{{ t(U + 'rowVersion') }}</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all">V{{ result.info.version }}</span>
            </div>
            <div class="cd__kv-row">
              <span class="cd__kv-key">{{ t(U + 'rowSigAlg') }}</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all">{{ result.info.signatureAlgorithm }}</span>
            </div>
            <div class="cd__kv-row">
              <span class="cd__kv-key">{{ t(U + 'rowPubKey') }}</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all">{{ result.info.publicKeyAlgorithm }} ({{ result.info.publicKeySize }} bits)</span>
            </div>
            <div class="cd__kv-row">
              <span class="cd__kv-key">{{ t(U + 'rowFingerprint') }}</span>
              <code class="qt-mono" style="font-size:10.5px;line-height:1.4;word-break:break-all">{{ result.info.fingerprintSha256 }}</code>
            </div>
          </div>
        </div>

        <!-- SAN -->
        <div v-if="result.info.san.length > 0" class="qt-stack">
          <div class="qt-stat-head" style="padding-bottom:4px;border-bottom:1px solid var(--qt-border)">{{ t(U + 'secSan') }}</div>
          <div class="qt-stack" style="--qt-stack-gap:4px">
            <code v-for="(s, i) in result.info.san" :key="i" class="qt-mono" style="font-size:12px;padding:4px 8px;border-radius:var(--qt-radius-sm);background:var(--qt-bg);border:1px solid var(--qt-border)">{{ s }}</code>
          </div>
        </div>

        <!-- Key Usage -->
        <div v-if="result.info.keyUsage.length > 0" class="qt-stack">
          <div class="qt-stat-head" style="padding-bottom:4px;border-bottom:1px solid var(--qt-border)">{{ t(U + 'secKeyUsage') }}</div>
          <div class="qt-row" style="--qt-row-gap:6px">
            <span v-for="(u, i) in result.info.keyUsage" :key="i" class="qt-badge">{{ u }}</span>
          </div>
        </div>

        <!-- Extended Key Usage -->
        <div v-if="result.info.extKeyUsage.length > 0" class="qt-stack">
          <div class="qt-stat-head" style="padding-bottom:4px;border-bottom:1px solid var(--qt-border)">{{ t(U + 'secExtKeyUsage') }}</div>
          <div class="qt-row" style="--qt-row-gap:6px">
            <span v-for="(u, i) in result.info.extKeyUsage" :key="i" class="qt-badge">{{ u }}</span>
          </div>
        </div>
      </div>

      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Validity status banner — border colored by state. */
.cd__status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
}
.cd__status--valid {
  border-color: var(--qt-success);
}
.cd__status--expired {
  border-color: var(--qt-danger);
}
.cd__status--notyet {
  border-color: var(--qt-warning);
}

/* Key/value row — fixed 160px key column. */
.cd__kv-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 4px 0;
}
.cd__kv-key {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  min-width: 160px;
  flex-shrink: 0;
}
</style>
