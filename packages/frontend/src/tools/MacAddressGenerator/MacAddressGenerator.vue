<script setup lang="ts">
/**
 * MacAddressGenerator — generate cryptographically secure random MAC-48
 * addresses.
 *
 * Configurable quantity (1-1000), case (upper/lower), separator
 * (`:`/`-`/`.` Cisco/`none` bare), and toggles for the IEEE 802
 * locally-administered (U/L) bit and the multicast (I/G) bit. Randomness
 * comes from `crypto.getRandomValues()`.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the config
 * and sends `output` PostMessages with `{ macs, quantity, options }` whenever
 * the generated list changes.
 */
import { computed } from 'vue';
import { RefreshCw, Network } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useMacAddressGenerator,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useMacAddressGenerator';
import type { MacCase, MacSeparator } from './useMacAddressGenerator';

const { config, macs, regenerate } = useMacAddressGenerator();

const allMacsText = computed(() => macs.value.join('\n'));

const separatorOptions: { value: MacSeparator; label: string; sample: string }[] = [
  { value: ':', label: 'Colon', sample: 'AA:BB:CC:DD:EE:FF' },
  { value: '-', label: 'Dash', sample: 'AA-BB-CC-DD-EE-FF' },
  { value: '.', label: 'Cisco', sample: 'AABB.CCDD.EEFF' },
  { value: 'none', label: 'Bare', sample: 'AABBCCDDEEFF' },
];

const caseOptions: { value: MacCase; label: string }[] = [
  { value: 'upper', label: 'UPPER' },
  { value: 'lower', label: 'lower' },
];

function onQuantityInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  config.value.quantity = Number.isNaN(v) ? MIN_QUANTITY : v;
}

function onSeparatorChange(e: Event): void {
  config.value.separator = (e.target as HTMLSelectElement).value as MacSeparator;
}

function onCaseChange(e: Event): void {
  config.value.case = (e.target as HTMLSelectElement).value as MacCase;
}
</script>

<template>
  <div class="macgen">
    <ToolInput
      title="Configuration"
      description="Cryptographically secure random MAC-48 addresses (Web Crypto API)."
    >
      <template #actions>
        <button
          class="macgen__generate"
          type="button"
          @click="regenerate"
        >
          <RefreshCw :size="14" />
          <span>Generate</span>
        </button>
      </template>

      <div class="macgen__row">
        <label class="macgen__field">
          <span class="macgen__label">Quantity</span>
          <input
            class="macgen__input"
            type="number"
            :min="MIN_QUANTITY"
            :max="MAX_QUANTITY"
            :value="config.quantity"
            @input="onQuantityInput"
          />
        </label>
        <label class="macgen__field">
          <span class="macgen__label">Case</span>
          <select
            class="macgen__input macgen__select"
            :value="config.case"
            @change="onCaseChange"
          >
            <option v-for="o in caseOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <label class="macgen__field">
          <span class="macgen__label">Separator</span>
          <select
            class="macgen__input macgen__select"
            :value="config.separator"
            @change="onSeparatorChange"
          >
            <option v-for="o in separatorOptions" :key="o.value" :value="o.value">
              {{ o.label }} — {{ o.sample }}
            </option>
          </select>
        </label>
      </div>

      <fieldset class="macgen__fieldset">
        <legend class="macgen__legend">IEEE 802 bits (first octet)</legend>
        <div class="macgen__checks">
          <label class="macgen__check">
            <input
              type="checkbox"
              :checked="config.locallyAdministered"
              @change="
                config.locallyAdministered = ($event.target as HTMLInputElement).checked
              "
            />
            <span>Locally administered (U/L bit)</span>
          </label>
          <label class="macgen__check">
            <input
              type="checkbox"
              :checked="config.multicast"
              @change="
                config.multicast = ($event.target as HTMLInputElement).checked
              "
            />
            <span>Multicast / group (I/G bit)</span>
          </label>
        </div>
        <p class="macgen__hint">
          <Network :size="12" />
          <span>
            The U/L bit marks the address as locally administered (not globally
            unique). The I/G bit marks it as a multicast/group address.
          </span>
        </p>
      </fieldset>
    </ToolInput>

    <ToolOutput
      title="Generated MAC addresses"
      :description="
        macs.length
          ? `${macs.length} MAC address${macs.length === 1 ? '' : 'es'}`
          : ''
      "
      :copy-text="allMacsText"
      copy-label="Copy all"
    >
      <p v-if="macs.length === 0" class="macgen__empty">
        No MACs yet — click <strong>Generate</strong>.
      </p>
      <ul v-else class="macgen__list">
        <li v-for="(m, i) in macs" :key="i" class="macgen__mac">
          <span class="macgen__index">{{ i + 1 }}</span>
          <code class="macgen__mac-text">{{ m }}</code>
          <CopyButton :text="m" label="" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.macgen {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.macgen__row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.macgen__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 140px;
}
.macgen__label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
}
.macgen__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.macgen__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.macgen__select {
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--qt-muted) 50%),
    linear-gradient(135deg, var(--qt-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 16px) 50%,
    calc(100% - 11px) 50%;
  background-size:
    5px 5px,
    5px 5px;
  background-repeat: no-repeat;
  padding-right: 28px;
}
.macgen__fieldset {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.macgen__legend {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  padding: 0 6px;
}
.macgen__checks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px 12px;
}
.macgen__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--qt-text);
  cursor: pointer;
}
.macgen__check input[type='checkbox'] {
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.macgen__hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
  line-height: 1.4;
}
.macgen__hint svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.macgen__generate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.macgen__generate:hover:not(:disabled) {
  transform: translateY(-1px);
}
.macgen__generate:active:not(:disabled) {
  transform: translateY(0);
}
.macgen__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.macgen__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.macgen__mac {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.macgen__index {
  font-size: 11px;
  font-weight: 600;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
  text-align: right;
  flex-shrink: 0;
}
.macgen__mac-text {
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
