<script setup lang="ts">
/**
 * MacAddressGenerator - generate cryptographically secure random MAC-48
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.mac-address-generator.ui.';

const { config, macs, regenerate } = useMacAddressGenerator();

const allMacsText = computed(() => macs.value.join('\n'));

const separatorOptions = computed<{ value: MacSeparator; label: string; sample: string }[]>(() => [
  { value: ':', label: t(U + 'sepColon'), sample: 'AA:BB:CC:DD:EE:FF' },
  { value: '-', label: t(U + 'sepDash'), sample: 'AA-BB-CC-DD-EE-FF' },
  { value: '.', label: t(U + 'sepCisco'), sample: 'AABB.CCDD.EEFF' },
  { value: 'none', label: t(U + 'sepBare'), sample: 'AABBCCDDEEFF' },
]);

const caseOptions = computed<{ value: MacCase; label: string }[]>(() => [
  { value: 'upper', label: t(U + 'caseUpper') },
  { value: 'lower', label: t(U + 'caseLower') },
]);

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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          @click="regenerate"
        >
          <RefreshCw :size="14" />
          <span>{{ t(U + 'generate') }}</span>
        </button>
      </template>

      <div class="qt-row" style="--qt-row-gap:12px">
        <label class="qt-field" style="gap:4px;flex:1 1 140px">
          <span class="qt-label">{{ t(U + 'quantity') }}</span>
          <input
            class="qt-input"
            type="number"
            :min="MIN_QUANTITY"
            :max="MAX_QUANTITY"
            :value="config.quantity"
            @input="onQuantityInput"
          />
        </label>
        <label class="qt-field" style="gap:4px;flex:1 1 140px">
          <span class="qt-label">{{ t(U + 'caseLabel') }}</span>
          <select
            class="qt-input"
            :value="config.case"
            @change="onCaseChange"
          >
            <option v-for="o in caseOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </label>
        <label class="qt-field" style="gap:4px;flex:1 1 140px">
          <span class="qt-label">{{ t(U + 'separator') }}</span>
          <select
            class="qt-input"
            :value="config.separator"
            @change="onSeparatorChange"
          >
            <option v-for="o in separatorOptions" :key="o.value" :value="o.value">
              {{ o.label }} - {{ o.sample }}
            </option>
          </select>
        </label>
      </div>

      <fieldset class="macgen__fieldset">
        <legend class="macgen__legend">{{ t(U + 'bitsLegend') }}</legend>
        <div class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:6px 12px">
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.locallyAdministered"
              @change="
                config.locallyAdministered = ($event.target as HTMLInputElement).checked
              "
            />
            <span>{{ t(U + 'locallyAdministered') }}</span>
          </label>
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.multicast"
              @change="
                config.multicast = ($event.target as HTMLInputElement).checked
              "
            />
            <span>{{ t(U + 'multicast') }}</span>
          </label>
        </div>
        <p class="qt-alert qt-alert--note" style="font-size:12px">
          <Network :size="12" style="flex-shrink:0;margin-top:2px" />
          <span>{{ t(U + 'bitsNote') }}</span>
        </p>
      </fieldset>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="
        macs.length
          ? t(U + (macs.length === 1 ? 'outDescOne' : 'outDesc'), { n: macs.length })
          : ''
      "
      :copy-text="allMacsText"
      :copy-label="t(U + 'copyAll')"
    >
      <p v-if="macs.length === 0" class="qt-alert qt-alert--empty">
        {{ t(U + 'alertEmpty') }}
      </p>
      <ul v-else class="qt-list qt-stack" style="--qt-stack-gap:6px">
        <li v-for="(m, i) in macs" :key="i" class="qt-result-row" style="padding:8px 10px">
          <span style="font-size:11px;font-weight:600;color:var(--qt-muted);font-variant-numeric:tabular-nums;min-width:28px;text-align:right;flex-shrink:0">{{ i + 1 }}</span>
          <code class="qt-value qt-value--sm" style="font-size:13px;flex:1;min-width:0;word-break:break-all;white-space:pre-wrap">{{ m }}</code>
          <CopyButton :text="m" label="" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* IEEE-bits fieldset — bordered group with an inline legend. */
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
</style>
