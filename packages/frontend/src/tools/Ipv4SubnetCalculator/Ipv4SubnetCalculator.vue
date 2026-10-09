<script setup lang="ts">
/**
 * Ipv4SubnetCalculator - IPv4 subnet calculator.
 *
 * Takes an IPv4 address and a CIDR prefix (e.g. `24`) or a dotted subnet mask
 * (e.g. `255.255.255.0`), then computes the full subnet breakdown: network
 * address, broadcast, first/last usable host, host count, wildcard mask,
 * subnet mask, CIDR notation, IP class, private/public scope, and binary
 * representations of the IP, mask, network, and wildcard.
 *
 * No external dependencies - all arithmetic uses 32-bit unsigned integers.
 *
 * Works in embed mode: receives `ip`/`address`/`input`/`value` PostMessages
 * to pre-fill the IP field and `cidr`/`prefix`/`mask`/`subnetMask` to pre-fill
 * the mask field; sends `output` PostMessages with the full subnet breakdown
 * whenever the result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Globe, Lock, Network as NetworkIcon } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpv4SubnetCalculator } from './useIpv4SubnetCalculator';

const { t, locale } = useI18n();
const U = 'tools.ipv4-subnet-calculator.ui.';

const { ipInput, maskInput, result, error } = useIpv4SubnetCalculator();

const hasInput = computed(() => ipInput.value.trim().length > 0);

function onIpInput(e: Event): void {
  ipInput.value = (e.target as HTMLInputElement).value;
}
function onMaskInput(e: Event): void {
  maskInput.value = (e.target as HTMLInputElement).value;
}

/** Quick-pick CIDR presets. */
const PRESETS: { label: string; prefix: string }[] = [
  { label: '/8', prefix: '8' },
  { label: '/16', prefix: '16' },
  { label: '/20', prefix: '20' },
  { label: '/24', prefix: '24' },
  { label: '/25', prefix: '25' },
  { label: '/26', prefix: '26' },
  { label: '/27', prefix: '27' },
  { label: '/30', prefix: '30' },
  { label: '/31', prefix: '31' },
  { label: '/32', prefix: '32' },
];

function applyPreset(prefix: string): void {
  maskInput.value = prefix;
}

/** Result rows for the main breakdown grid. */
const resultRows = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: t(U + 'rowNetwork'), value: r.network, mono: true },
    { label: t(U + 'rowBroadcast'), value: r.broadcast, mono: true },
    { label: t(U + 'rowFirstHost'), value: r.firstHost, mono: true },
    { label: t(U + 'rowLastHost'), value: r.lastHost, mono: true },
    { label: t(U + 'rowSubnetMask'), value: r.subnetMask, mono: true },
    { label: t(U + 'rowWildcard'), value: r.wildcardMask, mono: true },
    { label: t(U + 'rowCidr'), value: r.cidr, mono: true },
    { label: t(U + 'rowIpClass'), value: t(U + 'classBadge', { c: r.ipClass }), mono: false },
    {
      label: t(U + 'rowUsableHosts'),
      value: r.hostCount.toLocaleString(locale.value),
      mono: false,
    },
    {
      label: t(U + 'rowTotal'),
      value: r.totalAddresses.toLocaleString(locale.value),
      mono: false,
    },
  ];
});

/** Binary rows for the binary representation grid. */
const binaryRows = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: t(U + 'binIp'), value: r.binaryIp },
    { label: t(U + 'binMask'), value: r.binaryMask },
    { label: t(U + 'binNetwork'), value: r.binaryNetwork },
    { label: t(U + 'binWildcard'), value: r.binaryWildcard },
  ];
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
          <label class="qt-stat-head" for="subnet-ip">{{ t(U + 'ipLabel') }}</label>
          <input
            id="subnet-ip"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            :placeholder="t(U + 'phIp')"
            :value="ipInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onIpInput"
          />
        </div>
        <div class="qt-field" style="gap:4px">
          <label class="qt-stat-head" for="subnet-mask">{{ t(U + 'maskLabel') }}</label>
          <input
            id="subnet-mask"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            :placeholder="t(U + 'phMask')"
            :value="maskInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onMaskInput"
          />
        </div>
      </div>

      <!-- Presets -->
      <div class="qt-row qt-row--center" style="--qt-row-gap:6px;margin-top:10px">
        <span class="qt-label" style="margin-right:2px">{{ t(U + 'presets') }}</span>
        <button
          v-for="p in PRESETS"
          :key="p.prefix"
          type="button"
          class="qt-chip qt-chip--filled"
          style="font-family:var(--qt-font-mono)"
          :class="{ 'qt-chip--active': maskInput.trim() === p.prefix }"
          @click="applyPreset(p.prefix)"
        >
          {{ p.label }}
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descComputed', { cidr: result.cidr }) : t(U + 'descEmpty')"
      :copy-text="result ? `${result.network}/${result.prefix}` : ''"
      :copy-label="t(U + 'copyNetwork')"
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
        <!-- Scope + class badges -->
        <div class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
          <span
            class="qt-badge"
            style="text-transform:uppercase;font-weight:700"
            :class="result.isPrivate ? 'qt-badge--warn' : 'qt-badge--success'"
          >
            <component :is="result.isPrivate ? Lock : Globe" :size="13" />
            <span>{{ result.scope }}</span>
          </span>
          <span class="qt-badge qt-badge--info" style="text-transform:uppercase;font-weight:700">
            <NetworkIcon :size="13" />
            <span>{{ t(U + 'classBadge', { c: result.ipClass }) }}</span>
          </span>
          <span class="qt-badge" style="color:var(--qt-text);text-transform:uppercase;font-weight:700">
            <span>{{ t(U + 'hostsBadge', { n: result.hostCount.toLocaleString(locale) }) }}</span>
          </span>
        </div>

        <!-- Main breakdown grid -->
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div
            v-for="row in resultRows"
            :key="row.label"
            class="qt-result-row subnet__row"
          >
            <span class="qt-label subnet__row-label">{{ row.label }}</span>
            <code
              style="flex:1;font-size:13.5px;color:var(--qt-text);word-break:break-all"
              :style="row.mono ? 'font-family:var(--qt-font-mono);font-weight:700;font-variant-numeric:tabular-nums' : 'font-family:inherit'"
            >{{ row.value }}</code>
            <CopyButton :text="row.value" icon-only :label="t('common.copy')" />
          </div>
        </div>

        <!-- Binary representation -->
        <details class="qt-panel" style="margin-top:12px;padding:8px 10px" open>
          <summary class="qt-label" style="cursor:pointer">{{ t(U + 'binaryTitle') }}</summary>
          <div class="qt-stack" style="--qt-stack-gap:6px;margin-top:8px">
            <div
              v-for="row in binaryRows"
              :key="row.label"
              class="qt-result"
              style="gap:3px;padding:6px 8px"
            >
              <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ row.label }}</span>
              <code class="qt-mono" style="font-size:12.5px;color:var(--qt-text);letter-spacing:0.04em;word-break:break-all">{{ row.value }}</code>
            </div>
          </div>
        </details>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Result-row label — fixed column width; wraps full-width on narrow. */
.subnet__row-label {
  flex: 0 0 140px;
}
@media (max-width: 560px) {
  .subnet__row {
    flex-wrap: wrap;
  }
  .subnet__row-label {
    flex-basis: 100%;
  }
}
</style>
