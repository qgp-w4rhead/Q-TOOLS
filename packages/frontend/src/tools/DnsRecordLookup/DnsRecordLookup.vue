<script setup lang="ts">
/**
 * DnsRecordLookup - query DNS records via DNS-over-HTTPS.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw, Search, Loader2, AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useDnsRecordLookup,
  formatRecordType,
  type DnsRecordType,
  type DohProvider,
} from './useDnsRecordLookup';

const {
  domain,
  recordType,
  provider,
  results,
  loading,
  lookup,
  reset,
} = useDnsRecordLookup();

const { t } = useI18n();
const U = 'tools.dns-record-lookup.ui.';

const RECORD_TYPES: DnsRecordType[] = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'CAA'];
const PROVIDERS: { value: DohProvider; label: string }[] = [
  { value: 'cloudflare', label: 'Cloudflare' },
  { value: 'google', label: 'Google' },
];
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row" style="--qt-row-gap:10px">
        <ToolField
          v-model="domain"
          :label="t(U + 'domainLabel')"
          placeholder="example.com"
          grow
          @keyup.enter="lookup"
        />
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'recordTypeLabel') }}</span>
          <select class="qt-input" v-model="recordType">
            <option v-for="t in RECORD_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'providerLabel') }}</span>
          <select class="qt-input" v-model="provider">
            <option v-for="p in PROVIDERS" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </label>
      </div>

      <ToolButton variant="primary" :disabled="loading || !domain.trim()" @click="lookup">
        <Loader2 v-if="loading" :size="14" class="qt-spin" />
        <Search v-else :size="14" />
        <span>{{ loading ? t(U + 'btnQuerying') : t(U + 'btnLookup') }}</span>
      </ToolButton>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :hide-copy="true"
    >
      <template #actions>
        <CopyButton v-if="results.length > 0" :text="JSON.stringify(results, null, 2)" :label="t(U + 'copyJson')" />
      </template>

      <ToolAlert v-if="results.length === 0 && !loading" kind="empty">
        {{ t(U + 'alertEmpty') }}
      </ToolAlert>

      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div v-for="(r, i) in results" :key="i" class="dns__result">
          <div class="dns__result-head">
            <span style="font-size:12px;font-weight:700;color:var(--qt-accent);text-transform:uppercase">{{ r.recordType }}</span>
            <span v-if="r.error" class="qt-row qt-row--center" style="--qt-row-gap:4px;flex-wrap:nowrap;font-size:12px;color:var(--qt-danger, #dc3545)">
              <AlertCircle :size="12" />
              {{ r.error }}
            </span>
            <span v-else-if="r.answers.length === 0" class="qt-hint" style="font-size:12px">{{ t(U + 'noRecords') }}</span>
            <span v-else class="qt-hint" style="font-size:12px">{{ t(r.answers.length === 1 ? U + 'recordsCountOne' : U + 'recordsCount', { n: r.answers.length }) }}</span>
          </div>
          <table v-if="r.answers.length > 0" class="dns__table">
            <thead>
              <tr>
                <th>{{ t('common.name') }}</th>
                <th>{{ t('common.type') }}</th>
                <th>TTL</th>
                <th>{{ t(U + 'colData') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(a, j) in r.answers" :key="j">
                <td class="dns__td dns__td--mono">{{ a.name }}</td>
                <td class="dns__td">{{ formatRecordType(a.type) }}</td>
                <td class="dns__td">{{ a.TTL }}s</td>
                <td class="dns__td dns__td--mono dns__td--data">{{ a.data }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Bordered result card + header strip. */
.dns__result {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.dns__result-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border-bottom: 1px solid var(--qt-border);
}

/* Records table. */
.dns__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.dns__table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  border-bottom: 1px solid var(--qt-border);
}
.dns__table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--qt-border);
}
.dns__table tr:last-child td {
  border-bottom: none;
}
.dns__td {
  color: var(--qt-text);
}
.dns__td--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
}
.dns__td--data {
  word-break: break-all;
}
</style>
