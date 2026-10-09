<script setup lang="ts">
/**
 * SecretScanner - detect leaked API keys, tokens, and private key blocks in
 * pasted text/code.
 *
 * Runs a rule set of regexes covering AWS, GitHub, Slack, Stripe, Google,
 * Twilio, SendGrid, JWTs, generic `api_key = "..."` assignments, PEM private
 * key blocks, and credential-bearing connection strings. Findings show the
 * rule, severity, line number, and a masked preview - the full secret is never
 * echoed back. Everything runs locally.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ input | text |
 * code }`; sends `output` PostMessages with `{ count, critical, high, medium,
 * low, findings }`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, Eraser, ScanLine, ShieldAlert, ShieldCheck } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useSecretScanner } from './useSecretScanner';

const { t } = useI18n();
const U = 'tools.secret-scanner.ui.';

const { input, findings, counts, scanned, clear } = useSecretScanner();

const severityLabel = computed<Record<string, string>>(() => ({
  critical: t(U + 'sevCritical'),
  high: t(U + 'sevHigh'),
  medium: t(U + 'sevMedium'),
  low: t(U + 'sevLow'),
}));

function findingsAsText(): string {
  return findings.value
    .map((f) => `[${f.severity.toUpperCase()}] ${t(U + 'lineLabel', { n: f.line })}: ${f.rule} (${f.masked})`)
    .join('\n');
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
        :rows="10"
        :placeholder="t(U + 'phInput')"
        spellcheck="false"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="scanned ? t(findings.length === 1 ? U + 'descFoundOne' : U + 'descFound', { n: findings.length }) : t(U + 'descEmpty')"
      :copy-text="findingsAsText()"
      :copy-label="t(U + 'copyLabel')"
    >
      <template v-if="!scanned">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else-if="findings.length === 0">
        <div class="qt-banner qt-banner--success">
          <ShieldCheck :size="18" />
          <span>{{ t(U + 'bannerClean') }}</span>
        </div>
      </template>
      <template v-else>
        <div class="qt-row" style="--qt-row-gap:8px">
          <span v-if="counts.critical" class="qt-badge qt-badge--error">
            {{ t(U + 'badgeCritical', { n: counts.critical }) }}
          </span>
          <span v-if="counts.high" class="qt-badge qt-badge--error">
            {{ t(U + 'badgeHigh', { n: counts.high }) }}
          </span>
          <span v-if="counts.medium" class="qt-badge qt-badge--warn">
            {{ t(U + 'badgeMedium', { n: counts.medium }) }}
          </span>
          <span v-if="counts.low" class="qt-badge qt-badge--muted">
            {{ t(U + 'badgeLow', { n: counts.low }) }}
          </span>
        </div>

        <ul class="qt-stack" style="list-style:none;margin:0;padding:0">
          <li v-for="(f, i) in findings" :key="i" class="qt-result">
            <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
              <span class="qt-badge" :class="`qt-badge--${f.severity === 'critical' || f.severity === 'high' ? 'error' : f.severity === 'medium' ? 'warn' : 'muted'}`">
                <ShieldAlert v-if="f.severity === 'critical' || f.severity === 'high'" :size="12" />
                <AlertTriangle v-else :size="12" />
                {{ severityLabel[f.severity] ?? f.severity }}
              </span>
              <span style="font-size:13px;font-weight:700;color:var(--qt-text)">{{ f.rule }}</span>
              <span class="qt-hint" style="margin-left:auto">{{ t(U + 'lineLabel', { n: f.line }) }}</span>
              <CopyButton :text="f.masked" :label="t('common.copy')" icon-only />
            </div>
            <code class="qt-mono" style="font-size:12px;color:var(--qt-warning);word-break:break-all">{{ f.masked }}</code>
            <p class="qt-hint">{{ f.hint }}</p>
          </li>
        </ul>

        <p class="qt-hint" style="display:flex;align-items:center;gap:6px;margin-top:4px">
          <ScanLine :size="12" />
          {{ t(U + 'maskedNote') }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

