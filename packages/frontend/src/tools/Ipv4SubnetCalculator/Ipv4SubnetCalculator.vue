<script setup lang="ts">
/**
 * Ipv4SubnetCalculator — IPv4 subnet calculator.
 *
 * Takes an IPv4 address and a CIDR prefix (e.g. `24`) or a dotted subnet mask
 * (e.g. `255.255.255.0`), then computes the full subnet breakdown: network
 * address, broadcast, first/last usable host, host count, wildcard mask,
 * subnet mask, CIDR notation, IP class, private/public scope, and binary
 * representations of the IP, mask, network, and wildcard.
 *
 * No external dependencies — all arithmetic uses 32-bit unsigned integers.
 *
 * Works in embed mode: receives `ip`/`address`/`input`/`value` PostMessages
 * to pre-fill the IP field and `cidr`/`prefix`/`mask`/`subnetMask` to pre-fill
 * the mask field; sends `output` PostMessages with the full subnet breakdown
 * whenever the result changes.
 */
import { computed } from 'vue';
import { AlertCircle, Globe, Lock, Network as NetworkIcon } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpv4SubnetCalculator } from './useIpv4SubnetCalculator';

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
    { label: 'Network address', value: r.network, mono: true },
    { label: 'Broadcast address', value: r.broadcast, mono: true },
    { label: 'First usable host', value: r.firstHost, mono: true },
    { label: 'Last usable host', value: r.lastHost, mono: true },
    { label: 'Subnet mask', value: r.subnetMask, mono: true },
    { label: 'Wildcard mask', value: r.wildcardMask, mono: true },
    { label: 'CIDR notation', value: r.cidr, mono: true },
    { label: 'IP class', value: `Class ${r.ipClass}`, mono: false },
    {
      label: 'Usable hosts',
      value: r.hostCount.toLocaleString(),
      mono: false,
    },
    {
      label: 'Total addresses',
      value: r.totalAddresses.toLocaleString(),
      mono: false,
    },
  ];
});

/** Binary rows for the binary representation grid. */
const binaryRows = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: 'IP address', value: r.binaryIp },
    { label: 'Subnet mask', value: r.binaryMask },
    { label: 'Network', value: r.binaryNetwork },
    { label: 'Wildcard', value: r.binaryWildcard },
  ];
});
</script>

<template>
  <div class="subnet">
    <ToolInput
      title="IPv4 address & subnet"
      description="Enter an IPv4 address and a CIDR prefix (e.g. 24) or dotted subnet mask (e.g. 255.255.255.0). You can also type the full CIDR (192.168.1.10/24) in the IP field."
    >
      <div class="subnet__inputs">
        <div class="subnet__field">
          <label class="subnet__field-label" for="subnet-ip">IP address</label>
          <input
            id="subnet-ip"
            class="subnet__input"
            type="text"
            placeholder="192.168.1.10"
            :value="ipInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onIpInput"
          />
        </div>
        <div class="subnet__field">
          <label class="subnet__field-label" for="subnet-mask">CIDR / mask</label>
          <input
            id="subnet-mask"
            class="subnet__input"
            type="text"
            placeholder="24 or 255.255.255.0"
            :value="maskInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onMaskInput"
          />
        </div>
      </div>

      <!-- Presets -->
      <div class="subnet__presets">
        <span class="subnet__presets-label">Common prefixes:</span>
        <button
          v-for="p in PRESETS"
          :key="p.prefix"
          type="button"
          class="subnet__preset"
          :class="{ 'subnet__preset--active': maskInput.trim() === p.prefix }"
          @click="applyPreset(p.prefix)"
        >
          {{ p.label }}
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      title="Subnet breakdown"
      :description="result ? `Computed for ${result.cidr}` : 'Enter an IP address and prefix to compute the subnet.'"
      :copy-text="result ? `${result.network}/${result.prefix}` : ''"
      copy-label="Copy network"
    >
      <template v-if="!hasInput">
        <p class="subnet__empty">Enter an IPv4 address above to compute the subnet.</p>
      </template>
      <template v-else-if="error">
        <p class="subnet__error">
          <AlertCircle :size="14" />
          <span>{{ error }}</span>
        </p>
      </template>
      <template v-else-if="result">
        <!-- Scope + class badges -->
        <div class="subnet__badges">
          <span
            class="subnet__badge"
            :class="result.isPrivate ? 'subnet__badge--private' : 'subnet__badge--public'"
          >
            <component :is="result.isPrivate ? Lock : Globe" :size="13" />
            <span>{{ result.scope }}</span>
          </span>
          <span class="subnet__badge subnet__badge--class">
            <NetworkIcon :size="13" />
            <span>Class {{ result.ipClass }}</span>
          </span>
          <span class="subnet__badge subnet__badge--hosts">
            <span>{{ result.hostCount.toLocaleString() }} hosts</span>
          </span>
        </div>

        <!-- Main breakdown grid -->
        <div class="subnet__grid">
          <div
            v-for="row in resultRows"
            :key="row.label"
            class="subnet__row"
          >
            <span class="subnet__row-label">{{ row.label }}</span>
            <code
              class="subnet__row-value"
              :class="{ 'subnet__row-value--mono': row.mono }"
            >{{ row.value }}</code>
            <CopyButton :text="row.value" icon-only label="Copy" />
          </div>
        </div>

        <!-- Binary representation -->
        <details class="subnet__binary" open>
          <summary class="subnet__binary-summary">Binary representation</summary>
          <div class="subnet__binary-grid">
            <div
              v-for="row in binaryRows"
              :key="row.label"
              class="subnet__binary-row"
            >
              <span class="subnet__binary-label">{{ row.label }}</span>
              <code class="subnet__binary-value">{{ row.value }}</code>
            </div>
          </div>
        </details>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.subnet {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}

/* Inputs */
.subnet__inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.subnet__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.subnet__field-label {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.subnet__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 13.5px;
  padding: 8px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.subnet__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}

/* Presets */
.subnet__presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.subnet__presets-label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
  margin-right: 2px;
}
.subnet__preset {
  padding: 4px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-text);
  font: inherit;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.subnet__preset:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.subnet__preset--active {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 90% c h / 0.12);
}

/* Empty / error */
.subnet__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.subnet__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: oklch(from var(--qt-danger) 35% c h / 0.18);
  border: 1px solid oklch(from var(--qt-danger) 60% c h / 0.5);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-size: 13.5px;
  margin: 0;
}
.subnet__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}

/* Badges */
.subnet__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.subnet__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
}
.subnet__badge--private {
  background: oklch(from var(--qt-warning) 35% c h / 0.2);
  border-color: oklch(from var(--qt-warning) 60% c h / 0.55);
  color: var(--qt-warning);
}
.subnet__badge--public {
  background: oklch(from var(--qt-success) 35% c h / 0.2);
  border-color: oklch(from var(--qt-success) 60% c h / 0.55);
  color: var(--qt-success);
}
.subnet__badge--class {
  background: oklch(from var(--qt-accent) 35% c h / 0.18);
  border-color: oklch(from var(--qt-accent) 60% c h / 0.5);
  color: var(--qt-accent);
}
.subnet__badge--hosts {
  background: var(--qt-bg);
  border-color: var(--qt-border);
  color: var(--qt-text);
}

/* Main grid */
.subnet__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.subnet__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.subnet__row-label {
  flex: 0 0 140px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.subnet__row-value {
  flex: 1 1 auto;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
}
.subnet__row-value--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 13.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* Binary */
.subnet__binary {
  margin-top: 12px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.subnet__binary-summary {
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.subnet__binary-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.subnet__binary-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.subnet__binary-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.subnet__binary-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  letter-spacing: 0.04em;
  word-break: break-all;
}

@media (max-width: 560px) {
  .subnet__inputs {
    grid-template-columns: 1fr;
  }
  .subnet__row {
    flex-wrap: wrap;
  }
  .subnet__row-label {
    flex-basis: 100%;
  }
}
</style>
