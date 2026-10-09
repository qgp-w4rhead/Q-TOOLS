<script setup lang="ts">
/**
 * RdapLookup - domain/IP registration lookup via the public RDAP bootstrap
 * aggregator (rdap.org).
 *
 * Auto-detects the query type (domain vs IPv4/IPv6) and fetches the
 * authoritative registry's RDAP JSON, flattened into handle, status, events
 * (registration/expiration/last-changed), entities, nameservers, and - for
 * IPs - the network range and country.
 *
 * Requires network access; fetch failures are surfaced as errors. Works in
 * embed mode: receives `query`/`domain`/`ip`/`input`/`value` PostMessages
 * (any of which triggers the lookup) plus `lookup: true`; sends `output`
 * PostMessages with the parsed summary.
 *
 * No external dependencies - browser `fetch` only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Globe, Loader2, Search } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useRdapLookup } from './useRdapLookup';

const { t } = useI18n();
const U = 'tools.rdap-lookup.ui.';

const { query, result, loading, error, lookup } = useRdapLookup();

function onQueryInput(e: Event): void {
  query.value = (e.target as HTMLInputElement).value;
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') void lookup();
}

const overviewRows = computed(() => {
  const r = result.value;
  if (!r) return [];
  const rows: { label: string; value: string }[] = [
    { label: t(U + 'rowQuery'), value: r.query },
    { label: t(U + 'rowType'), value: r.queryType === 'ip' ? t(U + 'typeIp') : t(U + 'typeDomain') },
    { label: t(U + 'rowClass'), value: r.objectClass },
  ];
  if (r.handle) rows.push({ label: t(U + 'rowHandle'), value: r.handle });
  if (r.name) rows.push({ label: t(U + 'rowName'), value: r.name });
  if (r.ipRange) rows.push({ label: t(U + 'rowIpRange'), value: r.ipRange });
  if (r.ipType) rows.push({ label: t(U + 'rowAllocation'), value: r.ipType });
  if (r.country) rows.push({ label: t(U + 'rowCountry'), value: r.country });
  return rows;
});

const copyAllText = computed(() => {
  const r = result.value;
  if (!r) return '';
  const lines = overviewRows.value.map((row) => `${row.label}: ${row.value}`);
  if (r.status.length) lines.push(`Status: ${r.status.join(', ')}`);
  for (const e of r.events) lines.push(`${e.action}: ${e.date}`);
  if (r.nameservers.length) lines.push(`Nameservers: ${r.nameservers.join(', ')}`);
  return lines.join('\n');
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap">
        <input
          class="qt-input qt-input--mono"
          style="flex:1;font-size:13.5px"
          type="text"
          :placeholder="t(U + 'phQuery')"
          :value="query"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onQueryInput"
          @keydown="onKeydown"
        />
        <button
          type="button"
          class="qt-btn qt-btn--primary"
          style="padding:8px 14px;font-weight:700;white-space:nowrap"
          :disabled="loading || !query.trim()"
          @click="lookup"
        >
          <Loader2 v-if="loading" :size="14" class="qt-spin" />
          <Search v-else :size="14" />
          <span>{{ loading ? t(U + 'lookingUp') : t(U + 'lookup') }}</span>
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descResult', { name: result.name ?? result.handle, cls: result.objectClass }) : t(U + 'descEmpty')"
      :copy-text="copyAllText"
      :copy-label="t(U + 'copySummary')"
    >
      <template v-if="loading">
        <p class="qt-row qt-row--center" style="--qt-row-gap:8px;margin:0;color:var(--qt-muted);font-size:13.5px">
          <Loader2 :size="14" class="qt-spin" />
          <span>{{ t(U + 'loading') }}</span>
        </p>
      </template>
      <template v-else-if="error">
        <p class="qt-banner qt-banner--error" style="margin:0">
          <AlertCircle :size="14" />
          <span>{{ error }}</span>
        </p>
      </template>
      <template v-else-if="result">
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="row in overviewRows" :key="row.label" class="qt-result-row rdap__row">
            <span class="qt-label rdap__row-label">{{ row.label }}</span>
            <code class="qt-mono" style="font-size:13px;color:var(--qt-text);flex:1;word-break:break-all">{{ row.value }}</code>
            <CopyButton :text="row.value" icon-only :label="t('common.copy')" />
          </div>
        </div>

        <div v-if="result.status.length" style="margin-top:14px">
          <h3 class="qt-stat-head" style="font-size:12px;margin:0 0 8px">{{ t(U + 'hStatus') }}</h3>
          <div class="qt-row" style="--qt-row-gap:6px">
            <span v-for="s in result.status" :key="s" class="qt-badge" style="color:var(--qt-text);font-weight:600;text-transform:none">{{ s }}</span>
          </div>
        </div>

        <div v-if="result.events.length" style="margin-top:14px">
          <h3 class="qt-stat-head" style="font-size:12px;margin:0 0 8px">{{ t(U + 'hEvents') }}</h3>
          <div class="rdap__table">
            <div v-for="(e, i) in result.events" :key="i" class="rdap__table-row">
              <span class="qt-label rdap__table-key">{{ e.action }}</span>
              <code class="qt-mono" style="font-size:12.5px;color:var(--qt-text);flex:1;word-break:break-all">{{ e.date }}</code>
            </div>
          </div>
        </div>

        <div v-if="result.entities.length" style="margin-top:14px">
          <h3 class="qt-stat-head" style="font-size:12px;margin:0 0 8px">{{ t(U + 'hEntities') }}</h3>
          <div class="rdap__table">
            <div v-for="(e, i) in result.entities" :key="i" class="rdap__table-row">
              <span class="qt-label rdap__table-key">{{ e.roles.join(', ') || t(U + 'entityFallback') }}</span>
              <code class="qt-mono" style="font-size:12.5px;color:var(--qt-text);flex:1;word-break:break-all">{{ e.name ?? e.handle ?? '—' }}</code>
            </div>
          </div>
        </div>

        <div v-if="result.nameservers.length" style="margin-top:14px">
          <h3 class="qt-stat-head" style="font-size:12px;margin:0 0 8px">{{ t(U + 'hNameservers') }}</h3>
          <div class="qt-row" style="--qt-row-gap:6px">
            <code v-for="ns in result.nameservers" :key="ns" class="qt-mono" style="font-size:12.5px;color:var(--qt-text);padding:4px 10px;background:var(--qt-bg);border:1px solid var(--qt-border);border-radius:var(--qt-radius-sm)">{{ ns }}</code>
          </div>
        </div>

        <div v-if="result.remarks.length" style="margin-top:14px">
          <h3 class="qt-stat-head" style="font-size:12px;margin:0 0 8px">{{ t(U + 'hRemarks') }}</h3>
          <p v-for="(r, i) in result.remarks" :key="i" style="margin:0 0 6px;font-size:12.5px;color:var(--qt-muted)">{{ r }}</p>
        </div>
      </template>
      <template v-else>
        <p class="qt-alert qt-alert--empty" style="display:flex;align-items:center;gap:8px">
          <Globe :size="14" />
          <span>{{ t(U + 'alertEmpty') }}</span>
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Overview-row label — fixed column width; wraps full-width on narrow. */
.rdap__row-label {
  flex: 0 0 110px;
}

/* Events/entities — bordered list table (rows separated by borders). */
.rdap__table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.rdap__table-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--qt-border);
  font-size: 13px;
}
.rdap__table-row:last-child {
  border-bottom: none;
}
.rdap__table-key {
  flex: 0 0 180px;
}

@media (max-width: 560px) {
  .rdap__row {
    flex-wrap: wrap;
  }
  .rdap__row-label {
    flex-basis: 100%;
  }
  .rdap__table-key {
    flex-basis: 120px;
  }
}
</style>
