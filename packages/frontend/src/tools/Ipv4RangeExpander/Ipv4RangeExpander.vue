<script setup lang="ts">
/**
 * Ipv4RangeExpander — IPv4 range expander.
 *
 * Takes a start IP + end IP (or a single range expression such as
 * `192.168.1.0 - 192.168.1.255` or a CIDR block `192.168.1.0/24`) and expands
 * it into the minimal list of CIDR blocks that exactly cover the inclusive
 * range, plus the total number of addresses.
 *
 * No external dependencies — all arithmetic uses 32-bit unsigned integers.
 *
 * Works in embed mode: receives `start`/`from`/`end`/`to`/`range`/`input`/
 * `value` PostMessages to pre-fill the fields; sends `output` PostMessages
 * with the full expansion whenever the result changes.
 */
import { computed } from 'vue';
import { AlertCircle, List, Layers } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpv4RangeExpander } from './useIpv4RangeExpander';

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
  <div class="range">
    <ToolInput
      title="IPv4 range"
      description="Enter a start and end IP, a single range expression (192.168.1.0 - 192.168.1.255), or a CIDR block (192.168.1.0/24) in the start field."
    >
      <div class="range__inputs">
        <div class="range__field">
          <label class="range__field-label" for="range-start">Start IP / range / CIDR</label>
          <input
            id="range-start"
            class="range__input"
            type="text"
            placeholder="192.168.1.0 or 192.168.1.0/24 or 192.168.1.0-192.168.1.255"
            :value="startInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onStartInput"
          />
        </div>
        <div class="range__field">
          <label class="range__field-label" for="range-end">End IP (optional)</label>
          <input
            id="range-end"
            class="range__input"
            type="text"
            placeholder="192.168.1.255"
            :value="endInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onEndInput"
          />
        </div>
      </div>

      <!-- Presets -->
      <div class="range__presets">
        <span class="range__presets-label">Examples:</span>
        <button
          v-for="p in PRESETS"
          :key="p.label"
          type="button"
          class="range__preset"
          @click="applyPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      title="CIDR expansion"
      :description="
        result
          ? `${result.start} – ${result.end} • ${result.totalIps.toLocaleString()} addresses • ${result.cidrCount} CIDR block${result.cidrCount === 1 ? '' : 's'}`
          : 'Enter an IPv4 range above to expand it into CIDR blocks.'
      "
      :copy-text="allCidrs"
      copy-label="Copy all CIDRs"
    >
      <template v-if="!hasInput">
        <p class="range__empty">Enter a start and end IP above to expand the range.</p>
      </template>
      <template v-else-if="error">
        <p class="range__error">
          <AlertCircle :size="14" />
          <span>{{ error }}</span>
        </p>
      </template>
      <template v-else-if="result">
        <!-- Summary badges -->
        <div class="range__badges">
          <span class="range__badge range__badge--total">
            <Layers :size="13" />
            <span>{{ result.totalIps.toLocaleString() }} addresses</span>
          </span>
          <span class="range__badge range__badge--count">
            <List :size="13" />
            <span>{{ result.cidrCount }} CIDR{{ result.cidrCount === 1 ? '' : 's' }}</span>
          </span>
          <span
            v-if="result.isSingleCidr"
            class="range__badge range__badge--single"
          >
            <span>Single block</span>
          </span>
        </div>

        <!-- Range boundary rows -->
        <div class="range__boundary">
          <div class="range__row">
            <span class="range__row-label">Start</span>
            <code class="range__row-value range__row-value--mono">{{ result.start }}</code>
            <CopyButton :text="result.start" icon-only label="Copy start" />
          </div>
          <div class="range__row">
            <span class="range__row-label">End</span>
            <code class="range__row-value range__row-value--mono">{{ result.end }}</code>
            <CopyButton :text="result.end" icon-only label="Copy end" />
          </div>
        </div>

        <!-- CIDR list -->
        <div class="range__cidrs">
          <div class="range__cidrs-header">
            <span>CIDR blocks</span>
          </div>
          <div
            v-for="(c, idx) in result.cidrs"
            :key="c.cidr"
            class="range__cidr"
          >
            <span class="range__cidr-index">{{ idx + 1 }}</span>
            <code class="range__cidr-value">{{ c.cidr }}</code>
            <span class="range__cidr-range">{{ c.first }} – {{ c.last }}</span>
            <span class="range__cidr-count">{{ c.count.toLocaleString() }}</span>
            <CopyButton :text="c.cidr" icon-only label="Copy CIDR" />
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.range {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}

/* Inputs */
.range__inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.range__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.range__field-label {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.range__input {
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
.range__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}

/* Presets */
.range__presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.range__presets-label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
  margin-right: 2px;
}
.range__preset {
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
.range__preset:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}

/* Empty / error */
.range__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.range__error {
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
.range__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}

/* Badges */
.range__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.range__badge {
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
.range__badge--total {
  background: oklch(from var(--qt-accent) 35% c h / 0.18);
  border-color: oklch(from var(--qt-accent) 60% c h / 0.5);
  color: var(--qt-accent);
}
.range__badge--count {
  background: var(--qt-bg);
  border-color: var(--qt-border);
  color: var(--qt-text);
}
.range__badge--single {
  background: oklch(from var(--qt-success) 35% c h / 0.2);
  border-color: oklch(from var(--qt-success) 60% c h / 0.55);
  color: var(--qt-success);
}

/* Boundary rows */
.range__boundary {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-bottom: 12px;
}
.range__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.range__row-label {
  flex: 0 0 80px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.range__row-value {
  flex: 1 1 auto;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
}
.range__row-value--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* CIDR list */
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
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
.range__cidr-range {
  flex: 1 1 auto;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas,
    monospace;
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
  .range__inputs {
    grid-template-columns: 1fr;
  }
  .range__cidr-range {
    display: none;
  }
}
</style>
