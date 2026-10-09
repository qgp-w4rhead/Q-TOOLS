<script setup lang="ts">
/**
 * EmailHeaderAnalyzer - parse raw email headers.
 *
 * Unfolds the header block, walks the `Received` chain in delivery order with
 * per-hop delays, reads SPF/DKIM/DMARC verdicts from `Authentication-Results`
 * (plus legacy `Received-SPF`), and surfaces identity headers (From/To/
 * Subject/Date/Message-ID/Return-Path).
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ input | headers |
 * text }`; sends `output` PostMessages with `{ hops, spf, dkim, dmarc,
 * totalDeliverySeconds, from, subject }`.
 */
import { useI18n } from 'vue-i18n';
import { Eraser, Mail, ShieldCheck, ShieldAlert, Timer } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useEmailHeaderAnalyzer, formatDelay } from './useEmailHeaderAnalyzer';

const { t } = useI18n();
const U = 'tools.email-header-analyzer.ui.';

const { input, result, clear } = useEmailHeaderAnalyzer();

function verdictClass(v: string): string {
  if (v === 'pass') return 'eha__auth--pass';
  if (v === 'fail' || v === 'softfail') return 'eha__auth--fail';
  return 'eha__auth--unknown';
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton v-if="input" @click="clear">
          <Eraser :size="13" /> {{ t('common.clear') }}
        </ToolButton>
      </template>
      <ToolField
        v-model="input"
        as="textarea"
        mono
        :rows="12"
        placeholder="Received: from mail.example.com …&#10;From: sender@example.com&#10;To: you@example.com&#10;Subject: …"
        spellcheck="false"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descResult', { fields: result.fieldCount, hops: result.hops.length }) : t(U + 'descEmpty')"
      hide-copy
    >
      <template v-if="!result">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else>
        <!-- Identity -->
        <div class="qt-stack">
          <p class="qt-stat-head"><Mail :size="13" /> {{ t(U + 'secMessage') }}</p>
          <div class="qt-stack" style="--qt-stack-gap:6px">
            <div v-if="result.identity.from" class="eha__kv">
              <span class="qt-stat-head">From</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all;min-width:0">{{ result.identity.from }}</span>
              <CopyButton :text="result.identity.from" :label="t('common.copy')" icon-only />
            </div>
            <div v-if="result.identity.to" class="eha__kv">
              <span class="qt-stat-head">To</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all;min-width:0">{{ result.identity.to }}</span>
              <CopyButton :text="result.identity.to" :label="t('common.copy')" icon-only />
            </div>
            <div v-if="result.identity.subject" class="eha__kv">
              <span class="qt-stat-head">Subject</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all;min-width:0">{{ result.identity.subject }}</span>
              <CopyButton :text="result.identity.subject" :label="t('common.copy')" icon-only />
            </div>
            <div v-if="result.identity.date" class="eha__kv">
              <span class="qt-stat-head">Date</span>
              <span style="font-size:13px;color:var(--qt-text);word-break:break-all;min-width:0">{{ result.identity.date }}</span>
              <CopyButton :text="result.identity.date" :label="t('common.copy')" icon-only />
            </div>
            <div v-if="result.identity.messageId" class="eha__kv">
              <span class="qt-stat-head">Message-ID</span>
              <span class="qt-mono" style="font-size:12px;word-break:break-all;min-width:0">{{ result.identity.messageId }}</span>
              <CopyButton :text="result.identity.messageId" :label="t('common.copy')" icon-only />
            </div>
            <div v-if="result.identity.returnPath" class="eha__kv">
              <span class="qt-stat-head">Return-Path</span>
              <span class="qt-mono" style="font-size:12px;word-break:break-all;min-width:0">{{ result.identity.returnPath }}</span>
              <CopyButton :text="result.identity.returnPath" :label="t('common.copy')" icon-only />
            </div>
          </div>
        </div>

        <!-- Auth results -->
        <div class="qt-stack">
          <p class="qt-stat-head"><ShieldCheck :size="13" /> {{ t(U + 'secAuth') }}</p>
          <div class="qt-row" style="--qt-row-gap:8px">
            <span class="qt-badge" :class="verdictClass(result.auth.spf)">
              SPF: {{ result.auth.spf }}
            </span>
            <span class="qt-badge" :class="verdictClass(result.auth.dkim)">
              DKIM: {{ result.auth.dkim }}
            </span>
            <span class="qt-badge" :class="verdictClass(result.auth.dmarc)">
              DMARC: {{ result.auth.dmarc }}
            </span>
          </div>
        </div>

        <!-- Received chain -->
        <div v-if="result.hops.length" class="qt-stack">
          <p class="qt-stat-head">
            <Timer :size="13" /> {{ t(U + 'secPath') }}
            <span v-if="result.totalDeliverySeconds !== null" class="qt-hint" style="margin-left:auto;font-weight:600">
              {{ t(U + 'totalLabel', { t: formatDelay(result.totalDeliverySeconds) }) }}
            </span>
          </p>
          <ol class="qt-stack" style="list-style:none;margin:0;padding:0">
            <li v-for="hop in result.hops" :key="hop.hop" class="qt-result" style="padding:8px 10px;--qt-result-gap:6px">
              <div class="qt-row qt-row--between qt-row--center" style="flex-wrap:nowrap">
                <span style="font-size:12px;font-weight:800;color:var(--qt-accent)">#{{ hop.hop + 1 }}</span>
                <span class="qt-hint" style="font-weight:700;font-variant-numeric:tabular-nums">{{ formatDelay(hop.delaySeconds) }}</span>
              </div>
              <div class="qt-stack" style="--qt-stack-gap:3px">
                <div v-if="hop.from" class="eha__hop-row">
                  <span class="eha__hop-k">from</span>
                  <span class="eha__hop-v">{{ hop.from }}</span>
                </div>
                <div v-if="hop.by" class="eha__hop-row">
                  <span class="eha__hop-k">by</span>
                  <span class="eha__hop-v">{{ hop.by }}</span>
                </div>
                <div v-if="hop.with" class="eha__hop-row">
                  <span class="eha__hop-k">with</span>
                  <span class="eha__hop-v">{{ hop.with }}</span>
                </div>
                <div v-if="hop.rawDate" class="eha__hop-row">
                  <span class="eha__hop-k">date</span>
                  <span class="eha__hop-v">{{ hop.rawDate }}</span>
                </div>
              </div>
            </li>
          </ol>
        </div>
        <div v-else class="qt-stack">
          <p class="eha__no-hops">
            <ShieldAlert :size="13" /> {{ t(U + 'noHops') }}
          </p>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Identity kv row — fixed 110px label column + flexible value + copy. */
.eha__kv {
  display: grid;
  grid-template-columns: 110px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
@media (max-width: 640px) {
  .eha__kv { grid-template-columns: 84px 1fr auto; }
}

/* Hop detail row — fixed 44px key column + mono value. */
.eha__hop-row {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 8px;
  font-size: 12.5px;
}
.eha__hop-k {
  color: var(--qt-muted);
  font-weight: 700;
  text-transform: uppercase;
  font-size: 10.5px;
  letter-spacing: 0.04em;
}
.eha__hop-v {
  color: var(--qt-text);
  word-break: break-all;
  font-family: var(--qt-font-mono);
  font-size: 12px;
}

/* No-hops warning note. */
.eha__no-hops {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  color: var(--qt-warning);
}
</style>
