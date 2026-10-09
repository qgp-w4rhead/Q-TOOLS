<script setup lang="ts">
/**
 * MailAuthRecordBuilder - build SPF, DKIM, and DMARC DNS TXT records from a
 * form, and validate pasted records.
 *
 *  - SPF:   `v=spf1 a mx ip4:… include:… ~all`        (RFC 7208)
 *  - DKIM:  `v=DKIM1; k=rsa; p=<key>` at `<sel>._domainkey.<domain>` (RFC 6376)
 *  - DMARC: `v=DMARC1; p=<policy>; rua=…` at `_dmarc.<domain>`       (RFC 7489)
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ domain, tab,
 * spf, dkim, dmarc, validate }`; sends `output` PostMessages with `{ spf,
 * dkim, dkimName, dmarc, dmarcName }`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useMailAuthRecordBuilder,
  type MailAuthTab,
} from './useMailAuthRecordBuilder';

const { t } = useI18n();
const U = 'tools.mail-auth-record-builder.ui.';

const {
  tab,
  domain,
  spf,
  dkim,
  dmarc,
  spfRecord,
  dkimRecord,
  dkimName,
  dmarcRecord,
  dmarcName,
  validateInput,
  validationIssues,
  validationKind,
} = useMailAuthRecordBuilder();

const tabs: Array<{ id: MailAuthTab; label: string }> = [
  { id: 'spf', label: 'SPF' },
  { id: 'dkim', label: 'DKIM' },
  { id: 'dmarc', label: 'DMARC' },
];

const activeRecord = computed(() =>
  tab.value === 'spf' ? spfRecord.value : tab.value === 'dkim' ? dkimRecord.value : dmarcRecord.value,
);
const activeName = computed(() =>
  tab.value === 'spf'
    ? (domain.value.trim() || 'example.com')
    : tab.value === 'dkim'
      ? dkimName.value
      : dmarcName.value,
);

function issueIcon(level: string) {
  if (level === 'error') return XCircle;
  if (level === 'warning') return AlertTriangle;
  return Info;
}
const hasErrors = computed(() => validationIssues.value.some((i) => i.level === 'error'));
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <ToolField
        v-model="domain"
        :label="t(U + 'domainLabel')"
        placeholder="example.com"
        spellcheck="false"
        autocomplete="off"
      />

      <SegmentedControl v-model="tab" :options="tabs" />

      <!-- SPF form -->
      <div v-if="tab === 'spf'" class="qt-stack" style="--qt-stack-gap:12px">
        <div class="qt-row" style="--qt-row-gap:18px">
          <label class="qt-check" style="font-size:13px">
            <input type="checkbox" v-model="spf.useA" />
            <span>{{ t(U + 'spfUseA') }}</span>
          </label>
          <label class="qt-check" style="font-size:13px">
            <input type="checkbox" v-model="spf.useMx" />
            <span>{{ t(U + 'spfUseMx') }}</span>
          </label>
        </div>
        <ToolField v-model="spf.ip4" :label="t(U + 'ip4Label')" mono placeholder="203.0.113.5 198.51.100.0/24" spellcheck="false" />
        <ToolField v-model="spf.ip6" :label="t(U + 'ip6Label')" mono placeholder="2001:db8::/32" spellcheck="false" />
        <ToolField v-model="spf.include" :label="t(U + 'includeLabel')" mono placeholder="_spf.google.com sendgrid.net" spellcheck="false" />
        <div class="mab__row">
          <ToolField v-model="spf.exists" :label="t(U + 'existsLabel')" mono spellcheck="false" />
          <ToolField v-model="spf.redirect" :label="t(U + 'redirectLabel')" mono spellcheck="false" />
          <label class="qt-field" style="min-width:140px">
            <span class="qt-label">{{ t(U + 'allLabel') }}</span>
            <select class="qt-input" v-model="spf.allQualifier">
              <option value="-">{{ t(U + 'allFail') }}</option>
              <option value="~">{{ t(U + 'allSoft') }}</option>
              <option value="?">{{ t(U + 'allNeutral') }}</option>
              <option value="+">{{ t(U + 'allPass') }}</option>
            </select>
          </label>
        </div>
      </div>

      <!-- DKIM form -->
      <div v-else-if="tab === 'dkim'" class="qt-stack" style="--qt-stack-gap:12px">
        <div class="mab__row">
          <ToolField v-model="dkim.selector" :label="t(U + 'selectorLabel')" mono placeholder="default" spellcheck="false" />
          <label class="qt-field" style="min-width:140px">
            <span class="qt-label">{{ t(U + 'keyTypeLabel') }}</span>
            <select class="qt-input" v-model="dkim.keyType">
              <option value="rsa">RSA</option>
              <option value="ed25519">Ed25519</option>
            </select>
          </label>
          <ToolField v-model="dkim.flags" :label="t(U + 'flagsLabel')" mono placeholder="y or s" spellcheck="false" />
        </div>
        <ToolField v-model="dkim.publicKey" :label="t(U + 'pubKeyLabel')" as="textarea" mono :rows="3" placeholder="MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A…" spellcheck="false" />
      </div>

      <!-- DMARC form -->
      <div v-else class="qt-stack" style="--qt-stack-gap:12px">
        <div class="mab__row">
          <label class="qt-field" style="min-width:140px">
            <span class="qt-label">{{ t(U + 'policyLabel') }}</span>
            <select class="qt-input" v-model="dmarc.policy">
              <option value="none">{{ t(U + 'polNone') }}</option>
              <option value="quarantine">quarantine</option>
              <option value="reject">reject</option>
            </select>
          </label>
          <label class="qt-field" style="min-width:140px">
            <span class="qt-label">{{ t(U + 'spLabel') }}</span>
            <select class="qt-input" v-model="dmarc.sp">
              <option value="">{{ t(U + 'spSame') }}</option>
              <option value="none">none</option>
              <option value="quarantine">quarantine</option>
              <option value="reject">reject</option>
            </select>
          </label>
          <ToolField v-model.number="dmarc.pct" label="pct" type="number" min="1" max="100" />
        </div>
        <ToolField v-model="dmarc.rua" :label="t(U + 'ruaLabel')" mono placeholder="mailto:dmarc@example.com" spellcheck="false" />
        <ToolField v-model="dmarc.ruf" :label="t(U + 'rufLabel')" mono placeholder="mailto:forensic@example.com" spellcheck="false" />
        <div class="mab__row">
          <label class="qt-field" style="min-width:140px">
            <span class="qt-label">{{ t(U + 'adkimLabel') }}</span>
            <select class="qt-input" v-model="dmarc.adkim">
              <option value="r">{{ t(U + 'relaxed') }}</option>
              <option value="s">{{ t(U + 'strict') }}</option>
            </select>
          </label>
          <label class="qt-field" style="min-width:140px">
            <span class="qt-label">{{ t(U + 'aspfLabel') }}</span>
            <select class="qt-input" v-model="dmarc.aspf">
              <option value="r">{{ t(U + 'relaxed') }}</option>
              <option value="s">{{ t(U + 'strict') }}</option>
            </select>
          </label>
          <ToolField v-model="dmarc.fo" :label="t(U + 'foLabel')" mono placeholder="0/1/d/s" spellcheck="false" />
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle', { tab: tab.toUpperCase() })"
      :description="t(U + 'descPublish', { name: activeName })"
      :copy-text="activeRecord"
      :copy-label="t(U + 'copyRecord')"
    >
      <div class="qt-stack" style="--qt-stack-gap:6px">
        <div class="mab__record-row">
          <span class="qt-stat-head">{{ t('common.name') }}</span>
          <code class="qt-mono" style="font-size:12.5px;word-break:break-all;white-space:pre-wrap;min-width:0">{{ activeName }}</code>
          <CopyButton :text="activeName" :label="t('common.copy')" icon-only />
        </div>
        <div class="mab__record-row">
          <span class="qt-stat-head">{{ t('common.type') }}</span>
          <code class="qt-mono" style="font-size:12.5px;word-break:break-all;white-space:pre-wrap;min-width:0">TXT</code>
        </div>
        <div class="mab__record-row">
          <span class="qt-stat-head">{{ t('common.value') }}</span>
          <code class="qt-mono" style="font-size:12.5px;word-break:break-all;white-space:pre-wrap;min-width:0;color:var(--qt-accent);font-weight:600">{{ activeRecord }}</code>
          <CopyButton :text="activeRecord" :label="t('common.copy')" icon-only />
        </div>
      </div>
    </ToolOutput>

    <ToolOutput
      :title="t(U + 'valTitle')"
      :description="t(U + 'valDesc')"
      hide-copy
    >
      <ToolField
        v-model="validateInput"
        as="textarea"
        mono
        :rows="3"
        placeholder="v=spf1 include:_spf.google.com ~all"
        spellcheck="false"
      />
      <template v-if="validateInput.trim()">
        <div class="mab__verdict" :class="{ 'mab__verdict--ok': !hasErrors, 'mab__verdict--bad': hasErrors }">
          <CheckCircle2 v-if="!hasErrors" :size="15" />
          <XCircle v-else :size="15" />
          <span>
            {{ hasErrors ? t(U + 'verdictBad') : t(U + 'verdictOk') }}
            <template v-if="validationKind !== 'unknown'"> · {{ t(U + 'detectedKind', { kind: validationKind.toUpperCase() }) }}</template>
          </span>
        </div>
        <ul v-if="validationIssues.length" class="mab__issues">
          <li v-for="(iss, i) in validationIssues" :key="i" class="mab__issue" :class="`mab__issue--${iss.level}`">
            <component :is="issueIcon(iss.level)" :size="13" />
            <span>{{ iss.message }}</span>
          </li>
        </ul>
      </template>
      <ToolAlert v-else kind="empty">{{ t(U + 'valEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Field grid — auto-fit columns, collapses to stacked on narrow. */
.mab__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  align-items: end;
}

/* Record row — fixed 64px label column + flexible code + copy. */
.mab__record-row {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}

/* Validation verdict banner — border colored by state. */
.mab__verdict {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 10px;
  border-radius: var(--qt-radius-sm);
  border: 1px solid var(--qt-border);
}
.mab__verdict--ok { color: var(--qt-success); border-color: var(--qt-success); }
.mab__verdict--bad { color: var(--qt-danger); border-color: var(--qt-danger); }

/* Issues list — colored by level. */
.mab__issues {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.mab__issue {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12.5px;
  padding: 6px 9px;
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
}
.mab__issue--error { color: var(--qt-danger); }
.mab__issue--warning { color: var(--qt-warning); }
.mab__issue--info { color: var(--qt-muted); }
</style>
