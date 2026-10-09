<script setup lang="ts">
/**
 * Ipv6UlaGenerator - generate IPv6 Unique Local Addresses per RFC 4193.
 *
 * Produces ULA prefixes in the `fd00::/8` range with a random 40-bit Global
 * ID and a 16-bit Subnet ID (both via `crypto.getRandomValues()`). The user
 * can optionally supply a 48-bit prefix and/or a 16-bit subnet ID to override
 * the random generation.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the config
 * and sends `output` PostMessages with `{ results, quantity, options }`
 * whenever the generated list changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw, Globe } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useIpv6UlaGenerator,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useIpv6UlaGenerator';

const { t } = useI18n();
const U = 'tools.ipv6-ula-generator.ui.';

const { config, results, regenerate } = useIpv6UlaGenerator();

const allResultsText = computed(() =>
  results.value.map((r) => `${r.prefix48}\t${r.prefix64}\t${r.globalId}\t${r.subnetId}`).join('\n'),
);

function onQuantityInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  config.value.quantity = Number.isNaN(v) ? MIN_QUANTITY : v;
}

function onPrefixInput(e: Event): void {
  config.value.prefix = (e.target as HTMLInputElement).value;
}

function onSubnetInput(e: Event): void {
  config.value.subnetId = (e.target as HTMLInputElement).value;
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
        <label class="qt-field" style="gap:4px;flex:2 1 240px">
          <span class="qt-label">{{ t(U + 'prefixLabel') }}</span>
          <input
            class="qt-input"
            type="text"
            :placeholder="t(U + 'phPrefix')"
            :value="config.prefix"
            @input="onPrefixInput"
          />
        </label>
        <label class="qt-field" style="gap:4px;flex:1 1 140px">
          <span class="qt-label">{{ t(U + 'subnetLabel') }}</span>
          <input
            class="qt-input"
            type="text"
            :placeholder="t(U + 'phSubnet')"
            :value="config.subnetId"
            @input="onSubnetInput"
          />
        </label>
      </div>

      <p class="qt-alert qt-alert--note" style="font-size:12px;line-height:1.5">
        <Globe :size="12" style="flex-shrink:0;margin-top:2px" />
        <span>
          {{ t(U + 'noteLead') }} <code class="qt-kbd">fd</code> {{ t(U + 'noteMid') }}
          <code class="qt-kbd">fd12:3456:7890</code>,
          <code class="qt-kbd">fd1234567890</code>, <code class="qt-kbd">fd12:3456:7890::/48</code>,
          {{ t(U + 'noteTail') }} <code class="qt-kbd">1234567890</code>.
        </span>
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="
        results.length
          ? t(U + (results.length === 1 ? 'outDescOne' : 'outDesc'), { n: results.length })
          : ''
      "
      :copy-text="allResultsText"
      :copy-label="t(U + 'copyAll')"
    >
      <p v-if="results.length === 0" class="qt-alert qt-alert--empty">
        {{ t(U + 'alertEmpty') }}
      </p>
      <ul v-else class="qt-list qt-stack" style="--qt-stack-gap:8px">
        <li
          v-for="(r, i) in results"
          :key="i"
          class="qt-result"
          style="padding:10px 12px;gap:8px"
        >
          <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
            <span style="font-size:11px;font-weight:600;color:var(--qt-muted);font-variant-numeric:tabular-nums;min-width:28px;text-align:right;flex-shrink:0">{{ i + 1 }}</span>
            <code class="qt-value qt-value--sm" style="font-size:14px;flex:1;min-width:0;word-break:break-all">{{ r.prefix48 }}</code>
            <CopyButton :text="r.prefix48" label="" icon-only />
          </div>
          <dl class="qt-grid" style="--qt-grid-min:220px;--qt-grid-gap:4px 16px;margin:0">
            <div class="qt-field" style="gap:2px">
              <dt class="qt-label" style="font-size:11px">{{ t(U + 'row64') }}</dt>
              <dd class="qt-row qt-row--center" style="--qt-row-gap:6px;margin:0">
                <code class="qt-value qt-value--sm" style="font-size:12.5px;word-break:break-all">{{ r.prefix64 }}</code>
                <CopyButton :text="r.prefix64" label="" icon-only />
              </dd>
            </div>
            <div class="qt-field" style="gap:2px">
              <dt class="qt-label" style="font-size:11px">{{ t(U + 'rowGlobalId') }}</dt>
              <dd class="qt-row qt-row--center" style="--qt-row-gap:6px;margin:0">
                <code class="qt-value qt-value--sm" style="font-size:12.5px;word-break:break-all">{{ r.globalId }}</code>
                <CopyButton :text="r.globalId" label="" icon-only />
              </dd>
            </div>
            <div class="qt-field" style="gap:2px">
              <dt class="qt-label" style="font-size:11px">{{ t(U + 'rowSubnetId') }}</dt>
              <dd class="qt-row qt-row--center" style="--qt-row-gap:6px;margin:0">
                <code class="qt-value qt-value--sm" style="font-size:12.5px;word-break:break-all">{{ r.subnetId }}</code>
                <CopyButton :text="r.subnetId" label="" icon-only />
              </dd>
            </div>
            <div class="qt-field" style="gap:2px">
              <dt class="qt-label" style="font-size:11px">{{ t(U + 'rowPrefixBytes') }}</dt>
              <dd class="qt-row qt-row--center" style="--qt-row-gap:6px;margin:0">
                <code class="qt-value qt-value--sm" style="font-size:12.5px;word-break:break-all">{{ r.prefixBytes }}</code>
                <CopyButton :text="r.prefixBytes" label="" icon-only />
              </dd>
            </div>
          </dl>
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

