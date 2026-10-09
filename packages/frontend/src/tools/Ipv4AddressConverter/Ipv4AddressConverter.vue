<script setup lang="ts">
/**
 * Ipv4AddressConverter - IPv4 address converter.
 *
 * Takes an IPv4 dotted-decimal address (e.g. `192.168.1.10`) and converts it
 * into eight numeric representations: decimal (32-bit unsigned), hex, binary,
 * octal, dotted decimal, dotted hex, dotted binary, and dotted octal. Also
 * reports the IP class (A-E) and private/loopback/link-local scope.
 *
 * No external dependencies - all arithmetic uses 32-bit unsigned integers.
 *
 * Works in embed mode: receives `ip`/`address`/`input`/`value` PostMessages
 * to pre-fill the IP field; sends `output` PostMessages with all eight
 * representations whenever the result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Globe, Lock, Network as NetworkIcon } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpv4AddressConverter } from './useIpv4AddressConverter';

const { t, locale } = useI18n();
const U = 'tools.ipv4-address-converter.ui.';

const { ipInput, result, error } = useIpv4AddressConverter();

const hasInput = computed(() => ipInput.value.trim().length > 0);

function onIpInput(e: Event): void {
  ipInput.value = (e.target as HTMLInputElement).value;
}

/** Quick-pick example presets. */
const PRESETS: { label: string; ip: string }[] = [
  { label: '192.168.1.10', ip: '192.168.1.10' },
  { label: '10.0.0.1', ip: '10.0.0.1' },
  { label: '172.16.0.1', ip: '172.16.0.1' },
  { label: '8.8.8.8', ip: '8.8.8.8' },
  { label: '127.0.0.1', ip: '127.0.0.1' },
  { label: '169.254.1.1', ip: '169.254.1.1' },
  { label: '0.0.0.0', ip: '0.0.0.0' },
  { label: '255.255.255.255', ip: '255.255.255.255' },
];

function applyPreset(ip: string): void {
  ipInput.value = ip;
}

/** Result rows for the conversion grid. */
const resultRows = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: t(U + 'rowDottedDecimal'), value: r.dottedDecimal, mono: true },
    { label: t(U + 'rowDecimal'), value: r.decimal.toLocaleString(locale.value), mono: true },
    { label: t(U + 'rowHex'), value: r.hex, mono: true },
    { label: t(U + 'rowOctal'), value: r.octal, mono: true },
    { label: t(U + 'rowBinary'), value: r.binary, mono: true },
    { label: t(U + 'rowDottedHex'), value: r.dottedHex, mono: true },
    { label: t(U + 'rowDottedOctal'), value: r.dottedOctal, mono: true },
    { label: t(U + 'rowDottedBinary'), value: r.dottedBinary, mono: true },
  ];
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-field" style="gap:4px">
        <label class="qt-stat-head" for="ipv4-input">{{ t(U + 'ipLabel') }}</label>
        <input
          id="ipv4-input"
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

      <!-- Presets -->
      <div class="qt-row qt-row--center" style="--qt-row-gap:6px;margin-top:10px">
        <span class="qt-label" style="margin-right:2px">{{ t(U + 'examples') }}</span>
        <button
          v-for="p in PRESETS"
          :key="p.ip"
          type="button"
          class="qt-chip qt-chip--filled"
          style="font-family:var(--qt-font-mono)"
          :class="{ 'qt-chip--active': ipInput.trim() === p.ip }"
          @click="applyPreset(p.ip)"
        >
          {{ p.label }}
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descDone', { ip: result.dottedDecimal }) : t(U + 'descEmpty')"
      :copy-text="result ? result.dottedDecimal : ''"
      :copy-label="t(U + 'copyDotted')"
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
        </div>

        <!-- Conversion grid -->
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div
            v-for="row in resultRows"
            :key="row.label"
            class="qt-result-row converter__row"
          >
            <span class="qt-label converter__row-label">{{ row.label }}</span>
            <code
              style="flex:1;font-size:13.5px;color:var(--qt-text);word-break:break-all"
              :style="row.mono ? 'font-family:var(--qt-font-mono);font-weight:700;font-variant-numeric:tabular-nums' : 'font-family:inherit'"
            >{{ row.value }}</code>
            <CopyButton :text="row.value" icon-only :label="t('common.copy')" />
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Result-row label — fixed column width; wraps full-width on narrow. */
.converter__row-label {
  flex: 0 0 140px;
}
@media (max-width: 560px) {
  .converter__row {
    flex-wrap: wrap;
  }
  .converter__row-label {
    flex-basis: 100%;
  }
}
</style>
