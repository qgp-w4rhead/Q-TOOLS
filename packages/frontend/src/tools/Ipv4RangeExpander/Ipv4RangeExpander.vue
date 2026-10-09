<script setup lang="ts">
/**
 * Ipv4RangeExpander - IPv4 range expander.
 *
 * Takes a start IP + end IP (or a single range expression such as
 * `192.168.1.0 - 192.168.1.255` or a CIDR block `192.168.1.0/24`) and expands
 * it into the minimal list of CIDR blocks that exactly cover the inclusive
 * range, plus the total number of addresses.
 *
 * No external dependencies - all arithmetic uses 32-bit unsigned integers.
 *
 * Works in embed mode: receives `start`/`from`/`end`/`to`/`range`/`input`/
 * `value` PostMessages to pre-fill the fields; sends `output` PostMessages
 * with the full expansion whenever the result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, List, Layers } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpv4RangeExpander } from './useIpv4RangeExpander';

const { t, locale } = useI18n();
const U = 'tools.ipv4-range-expander.ui.';

const { startInput, endInput, result, error } = useIpv4RangeExpander();

const hasInput = computed(
  () => startInput.value.trim().length > 0 || endInput.value.trim().length > 0,
);

function onStartInput(e: Event): void {
  startInput.value = (e.target as HTMLInputElement).value;
}
function onEndInput(e: Event): void {
  endInput.value = (e.target as HTMLInputElement).value;
}

/** Quick-pick range presets. */
const PRESETS: { label: string; start: string; end: string }[] = [
  { label: '10.0.0.0/8', start: '10.0.0.0/8', end: '' },
  { label: '172.16.0.0/12', start: '172.16.0.0/12', end: '' },
  { label: '192.168.1.0/24', start: '192.168.1.0/24', end: '' },
  { label: '192.168.1.1 - .254', start: '192.168.1.1', end: '192.168.1.254' },
  { label: '0.0.0.0 - 255.255.255.255', start: '0.0.0.0', end: '255.255.255.255' },
];

function applyPreset(p: { start: string; end: string }): void {
  startInput.value = p.start;
  endInput.value = p.end;
}

/** All CIDR lines joined for copy-all. */
const allCidrs = computed(() => {
  const r = result.value;
  if (!r) return '';
  return r.cidrs.map((c) => c.cidr).join('\n');
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:10px">
        <div class="qt-field" style="gap:4px">
          <label class="qt-stat-head" for="range-start">{{ t(U + 'startLabel') }}</label>
          <input
            id="range-start"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            :placeholder="t(U + 'phStart')"
            :value="startInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onStartInput"
          />
        </div>
        <div class="qt-field" style="gap:4px">
          <label class="qt-stat-head" for="range-end">{{ t(U + 'endLabel') }}</label>
          <input
            id="range-end"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            :placeholder="t(U + 'phEnd')"
            :value="endInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onEndInput"
          />
        </div>
      </div>

      <!-- Presets -->
      <div class="qt-row qt-row--center" style="--qt-row-gap:6px;margin-top:10px">
        <span class="qt-label" style="margin-right:2px">{{ t(U + 'examples') }}</span>
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="qt-chip qt-chip--filled"
          style="font-family:var(--qt-font-mono)"
          @click="applyPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="
        result
          ? t(U + (result.cidrCount === 1 ? 'descResultOne' : 'descResult'), { start: result.start, end: result.end, n: result.totalIps.toLocaleString(locale), c: result.cidrCount })
          : t(U + 'descEmpty')
      "
      :copy-text="allCidrs"
      :copy-label="t(U + 'copyAll')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'alertEmpty') }}</p>
      </template>
      <template v-else-if="error">
        <p class="qt-banner qt-banner--error" style="margin:0">
          <AlertCircle :size="14" />
          <span>{{ error }}</span>
        </p>
      </template>
      <template v-else-if="result">
        <!-- Summary badges -->
        <div class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
          <span class="qt-badge qt-badge--info" style="text-transform:uppercase;font-weight:700">
            <Layers :size="13" />
            <span>{{ t(U + 'badgeAddresses', { n: result.totalIps.toLocaleString(locale) }) }}</span>
          </span>
          <span class="qt-badge" style="color:var(--qt-text);text-transform:uppercase;font-weight:700">
            <List :size="13" />
            <span>{{ t(U + (result.cidrCount === 1 ? 'badgeCidrsOne' : 'badgeCidrs'), { n: result.cidrCount }) }}</span>
          </span>
          <span
            v-if="result.isSingleCidr"
            class="qt-badge qt-badge--success"
            style="text-transform:uppercase;font-weight:700"
          >
            <span>{{ t(U + 'badgeSingle') }}</span>
          </span>
        </div>

        <!-- Range boundary rows -->
        <div class="qt-stack" style="--qt-stack-gap:6px;margin-bottom:12px">
          <div class="qt-result-row">
            <span class="qt-label" style="flex:0 0 80px">{{ t(U + 'startRow') }}</span>
            <code style="flex:1;font-family:var(--qt-font-mono);font-size:13.5px;font-weight:700;color:var(--qt-text);font-variant-numeric:tabular-nums;word-break:break-all">{{ result.start }}</code>
            <CopyButton :text="result.start" icon-only :label="t(U + 'copyStart')" />
          </div>
          <div class="qt-result-row">
            <span class="qt-label" style="flex:0 0 80px">{{ t(U + 'endRow') }}</span>
            <code style="flex:1;font-family:var(--qt-font-mono);font-size:13.5px;font-weight:700;color:var(--qt-text);font-variant-numeric:tabular-nums;word-break:break-all">{{ result.end }}</code>
            <CopyButton :text="result.end" icon-only :label="t(U + 'copyEnd')" />
          </div>
        </div>

        <!-- CIDR list -->
        <div class="range__cidrs">
          <div class="range__cidrs-header">
            <span>{{ t(U + 'cidrBlocks') }}</span>
          </div>
          <div
            v-for="(c, idx) in result.cidrs"
            :key="c.cidr"
            class="range__cidr"
          >
            <span class="range__cidr-index">{{ idx + 1 }}</span>
            <code class="range__cidr-value">{{ c.cidr }}</code>
            <span class="range__cidr-range">{{ c.first }} – {{ c.last }}</span>
            <span class="range__cidr-count">{{ c.count.toLocaleString(locale) }}</span>
            <CopyButton :text="c.cidr" icon-only :label="t(U + 'copyCidr')" />
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* CIDR list — bordered table with a header row + hover + narrow-screen hide. */
.range__cidrs {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.range__cidrs-header {
  padding: 6px 12px;
  background: var(--qt-bg);
  border-bottom: 1px solid var(--qt-border);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.range__cidr {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--qt-border);
  transition: background 0.15s ease;
}
.range__cidr:last-child {
  border-bottom: none;
}
.range__cidr:hover {
  background: var(--qt-bg);
}
.range__cidr-index {
  flex: 0 0 28px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--qt-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.range__cidr-value {
  flex: 0 0 auto;
  font-family: var(--qt-font-mono);
  font-size: 13.5px;
  font-weight: 700;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
.range__cidr-range {
  flex: 1 1 auto;
  font-family: var(--qt-font-mono);
  font-size: 12px;
  color: var(--qt-muted);
  word-break: break-all;
}
.range__cidr-count {
  flex: 0 0 auto;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 560px) {
  .range__cidr-range {
    display: none;
  }
}
</style>
