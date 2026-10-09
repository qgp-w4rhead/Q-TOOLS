<script setup lang="ts">
/**
 * IpGeolocation - look up an IP's approximate geolocation via the free
 * ipapi.co JSON endpoint.
 *
 * Reports country, region, city, postal code, coordinates (with an
 * OpenStreetMap link), timezone, ASN, and organisation. An empty input
 * looks up the caller's own IP.
 *
 * Requires network access; the free tier is rate-limited (~1k req/day) and
 * failures are surfaced as errors. Works in embed mode: receives
 * `ip`/`address`/`input`/`value` PostMessages (any of which triggers the
 * lookup) plus `lookup: true`; sends `output` PostMessages with the result.
 *
 * No external dependencies - browser `fetch` only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, ExternalLink, Loader2, MapPin, Search } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpGeolocation } from './useIpGeolocation';

const { t } = useI18n();
const U = 'tools.ip-geolocation.ui.';

const { ipInput, result, loading, error, lookup } = useIpGeolocation();

function onIpInput(e: Event): void {
  ipInput.value = (e.target as HTMLInputElement).value;
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') void lookup();
}

const rows = computed(() => {
  const r = result.value;
  if (!r) return [];
  const out: { label: string; value: string }[] = [
    { label: t(U + 'rowIp'), value: r.ip },
  ];
  if (r.city) out.push({ label: t(U + 'rowCity'), value: r.city });
  if (r.region) out.push({ label: t(U + 'rowRegion'), value: r.region });
  if (r.postal) out.push({ label: t(U + 'rowPostal'), value: r.postal });
  if (r.countryName) {
    out.push({
      label: t(U + 'rowCountry'),
      value: r.countryCode ? `${r.countryName} (${r.countryCode})` : r.countryName,
    });
  }
  if (r.continentCode) out.push({ label: t(U + 'rowContinent'), value: r.continentCode });
  if (r.coordinates) out.push({ label: t(U + 'rowCoords'), value: r.coordinates });
  if (r.timezone) out.push({ label: t(U + 'rowTimezone'), value: r.timezone });
  if (r.utcOffset) out.push({ label: t(U + 'rowUtc'), value: r.utcOffset });
  if (r.asn) out.push({ label: t(U + 'rowAsn'), value: r.asn });
  if (r.org) out.push({ label: t(U + 'rowOrg'), value: r.org });
  return out;
});

const copyAllText = computed(() =>
  rows.value.map((r) => `${r.label}: ${r.value}`).join('\n'),
);
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
          :placeholder="t(U + 'phIp')"
          :value="ipInput"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onIpInput"
          @keydown="onKeydown"
        />
        <button
          type="button"
          class="qt-btn qt-btn--primary"
          style="padding:8px 14px;font-weight:700;white-space:nowrap"
          :disabled="loading"
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
      :description="result ? t(U + 'descResult', { ip: result.ip, place: [result.city, result.countryName].filter(Boolean).join(', ') || t(U + 'descUnknown') }) : t(U + 'descEmpty')"
      :copy-text="copyAllText"
      :copy-label="t(U + 'copyResult')"
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
          <div v-for="row in rows" :key="row.label" class="qt-result-row geo__row">
            <span class="qt-label geo__row-label">{{ row.label }}</span>
            <code class="qt-mono" style="font-size:13px;color:var(--qt-text);flex:1;word-break:break-all">{{ row.value }}</code>
            <CopyButton :text="row.value" icon-only :label="t('common.copy')" />
          </div>
        </div>
        <a
          v-if="result.mapUrl"
          class="geo__map"
          :href="result.mapUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin :size="14" />
          <span>{{ t(U + 'mapLink') }}</span>
          <ExternalLink :size="12" />
        </a>
      </template>
      <template v-else>
        <p class="qt-alert qt-alert--empty" style="display:flex;align-items:center;gap:8px">
          <MapPin :size="14" />
          <span>{{ t(U + 'alertEmpty') }}</span>
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Result-row label — fixed column width; wraps full-width on narrow. */
.geo__row-label {
  flex: 0 0 120px;
}

/* OpenStreetMap link — accent-tinted chip. */
.geo__map {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  background: oklch(from var(--qt-accent) 35% c h / 0.12);
  border: 1px solid oklch(from var(--qt-accent) 60% c h / 0.4);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-accent);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  align-self: flex-start;
}
.geo__map:hover {
  filter: brightness(1.15);
}

@media (max-width: 560px) {
  .geo__row {
    flex-wrap: wrap;
  }
  .geo__row-label {
    flex-basis: 100%;
  }
}
</style>
