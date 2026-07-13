<script setup lang="ts">
/**
 * Ipv4AddressConverter — IPv4 address converter.
 *
 * Takes an IPv4 dotted-decimal address (e.g. `192.168.1.10`) and converts it
 * into eight numeric representations: decimal (32-bit unsigned), hex, binary,
 * octal, dotted decimal, dotted hex, dotted binary, and dotted octal. Also
 * reports the IP class (A-E) and private/loopback/link-local scope.
 *
 * No external dependencies — all arithmetic uses 32-bit unsigned integers.
 *
 * Works in embed mode: receives `ip`/`address`/`input`/`value` PostMessages
 * to pre-fill the IP field; sends `output` PostMessages with all eight
 * representations whenever the result changes.
 */
import { computed } from 'vue';
import { AlertCircle, Globe, Lock, Network as NetworkIcon } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpv4AddressConverter } from './useIpv4AddressConverter';

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
    { label: 'Dotted decimal', value: r.dottedDecimal, mono: true },
    { label: 'Decimal', value: r.decimal.toLocaleString(), mono: true },
    { label: 'Hexadecimal', value: r.hex, mono: true },
    { label: 'Octal', value: r.octal, mono: true },
    { label: 'Binary', value: r.binary, mono: true },
    { label: 'Dotted hex', value: r.dottedHex, mono: true },
    { label: 'Dotted octal', value: r.dottedOctal, mono: true },
    { label: 'Dotted binary', value: r.dottedBinary, mono: true },
  ];
});
</script>

<template>
  <div class="converter">
    <ToolInput
      title="IPv4 address"
      description="Enter an IPv4 dotted-decimal address (e.g. 192.168.1.10) to convert it into decimal, hex, binary, octal, and dotted variants."
    >
      <div class="converter__field">
        <label class="converter__field-label" for="ipv4-input">IP address</label>
        <input
          id="ipv4-input"
          class="converter__input"
          type="text"
          placeholder="192.168.1.10"
          :value="ipInput"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onIpInput"
        />
      </div>

      <!-- Presets -->
      <div class="converter__presets">
        <span class="converter__presets-label">Examples:</span>
        <button
          v-for="p in PRESETS"
          :key="p.ip"
          type="button"
          class="converter__preset"
          :class="{ 'converter__preset--active': ipInput.trim() === p.ip }"
          @click="applyPreset(p.ip)"
        >
          {{ p.label }}
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      title="Conversions"
      :description="result ? `Converted ${result.dottedDecimal}` : 'Enter an IPv4 address to see all conversions.'"
      :copy-text="result ? result.dottedDecimal : ''"
      copy-label="Copy dotted decimal"
    >
      <template v-if="!hasInput">
        <p class="converter__empty">Enter an IPv4 address above to convert it.</p>
      </template>
      <template v-else-if="error">
        <p class="converter__error">
          <AlertCircle :size="14" />
          <span>{{ error }}</span>
        </p>
      </template>
      <template v-else-if="result">
        <!-- Scope + class badges -->
        <div class="converter__badges">
          <span
            class="converter__badge"
            :class="result.isPrivate ? 'converter__badge--private' : 'converter__badge--public'"
          >
            <component :is="result.isPrivate ? Lock : Globe" :size="13" />
            <span>{{ result.scope }}</span>
          </span>
          <span class="converter__badge converter__badge--class">
            <NetworkIcon :size="13" />
            <span>Class {{ result.ipClass }}</span>
          </span>
        </div>

        <!-- Conversion grid -->
        <div class="converter__grid">
          <div
            v-for="row in resultRows"
            :key="row.label"
            class="converter__row"
          >
            <span class="converter__row-label">{{ row.label }}</span>
            <code
              class="converter__row-value"
              :class="{ 'converter__row-value--mono': row.mono }"
            >{{ row.value }}</code>
            <CopyButton :text="row.value" icon-only label="Copy" />
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.converter {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}

/* Inputs */
.converter__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.converter__field-label {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.converter__input {
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
.converter__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}

/* Presets */
.converter__presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.converter__presets-label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
  margin-right: 2px;
}
.converter__preset {
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
.converter__preset:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.converter__preset--active {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 90% c h / 0.12);
}

/* Empty / error */
.converter__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.converter__error {
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
.converter__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}

/* Badges */
.converter__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.converter__badge {
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
.converter__badge--private {
  background: oklch(from var(--qt-warning) 35% c h / 0.2);
  border-color: oklch(from var(--qt-warning) 60% c h / 0.55);
  color: var(--qt-warning);
}
.converter__badge--public {
  background: oklch(from var(--qt-success) 35% c h / 0.2);
  border-color: oklch(from var(--qt-success) 60% c h / 0.55);
  color: var(--qt-success);
}
.converter__badge--class {
  background: oklch(from var(--qt-accent) 35% c h / 0.18);
  border-color: oklch(from var(--qt-accent) 60% c h / 0.5);
  color: var(--qt-accent);
}

/* Conversion grid */
.converter__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.converter__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.converter__row-label {
  flex: 0 0 140px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.converter__row-value {
  flex: 1 1 auto;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
}
.converter__row-value--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 13.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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
