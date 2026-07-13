<script setup lang="ts">
/**
 * Ipv6UlaGenerator — generate IPv6 Unique Local Addresses per RFC 4193.
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
import { RefreshCw, Globe } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useIpv6UlaGenerator,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useIpv6UlaGenerator';

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
  <div class="ulagen">
    <ToolInput
      title="Configuration"
      description="RFC 4193 Unique Local Addresses — fd00::/8, 40-bit Global ID, 16-bit Subnet ID."
    >
      <template #actions>
        <button
          class="ulagen__generate"
          type="button"
          @click="regenerate"
        >
          <RefreshCw :size="14" />
          <span>Generate</span>
        </button>
      </template>

      <div class="ulagen__row">
        <label class="ulagen__field">
          <span class="ulagen__label">Quantity</span>
          <input
            class="ulagen__input"
            type="number"
            :min="MIN_QUANTITY"
            :max="MAX_QUANTITY"
            :value="config.quantity"
            @input="onQuantityInput"
          />
        </label>
        <label class="ulagen__field ulagen__field--wide">
          <span class="ulagen__label">Prefix (optional, 48-bit hex)</span>
          <input
            class="ulagen__input"
            type="text"
            placeholder="e.g. fd12:3456:7890  (empty = random)"
            :value="config.prefix"
            @input="onPrefixInput"
          />
        </label>
        <label class="ulagen__field">
          <span class="ulagen__label">Subnet ID (optional, 16-bit hex)</span>
          <input
            class="ulagen__input"
            type="text"
            placeholder="e.g. 0001  (empty = random)"
            :value="config.subnetId"
            @input="onSubnetInput"
          />
        </label>
      </div>

      <p class="ulagen__hint">
        <Globe :size="12" />
        <span>
          Leave prefix/subnet empty for fully random generation. The first byte
          is always forced to <code>fd</code> (locally-assigned ULA marker).
          Accepted prefix forms: <code>fd12:3456:7890</code>,
          <code>fd1234567890</code>, <code>fd12:3456:7890::/48</code>, or a
          bare 40-bit Global ID like <code>1234567890</code>.
        </span>
      </p>
    </ToolInput>

    <ToolOutput
      title="Generated ULA prefixes"
      :description="
        results.length
          ? `${results.length} ULA prefix${results.length === 1 ? '' : 'es'}`
          : ''
      "
      :copy-text="allResultsText"
      copy-label="Copy all"
    >
      <p v-if="results.length === 0" class="ulagen__empty">
        No ULA prefixes yet — click <strong>Generate</strong>.
      </p>
      <ul v-else class="ulagen__list">
        <li
          v-for="(r, i) in results"
          :key="i"
          class="ulagen__result"
        >
          <div class="ulagen__result-head">
            <span class="ulagen__index">{{ i + 1 }}</span>
            <code class="ulagen__prefix48">{{ r.prefix48 }}</code>
            <CopyButton :text="r.prefix48" label="" icon-only />
          </div>
          <dl class="ulagen__details">
            <div class="ulagen__detail">
              <dt>/64 prefix</dt>
              <dd>
                <code>{{ r.prefix64 }}</code>
                <CopyButton :text="r.prefix64" label="" icon-only />
              </dd>
            </div>
            <div class="ulagen__detail">
              <dt>Global ID</dt>
              <dd>
                <code>{{ r.globalId }}</code>
                <CopyButton :text="r.globalId" label="" icon-only />
              </dd>
            </div>
            <div class="ulagen__detail">
              <dt>Subnet ID</dt>
              <dd>
                <code>{{ r.subnetId }}</code>
                <CopyButton :text="r.subnetId" label="" icon-only />
              </dd>
            </div>
            <div class="ulagen__detail">
              <dt>Prefix bytes</dt>
              <dd>
                <code>{{ r.prefixBytes }}</code>
                <CopyButton :text="r.prefixBytes" label="" icon-only />
              </dd>
            </div>
          </dl>
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ulagen {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ulagen__row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.ulagen__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 140px;
}
.ulagen__field--wide {
  flex: 2 1 240px;
}
.ulagen__label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
}
.ulagen__input {
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
.ulagen__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ulagen__hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
  line-height: 1.5;
}
.ulagen__hint svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.ulagen__hint code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 3px;
  padding: 0 4px;
}
.ulagen__generate {
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
.ulagen__generate:hover:not(:disabled) {
  transform: translateY(-1px);
}
.ulagen__generate:active:not(:disabled) {
  transform: translateY(0);
}
.ulagen__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.ulagen__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ulagen__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ulagen__result-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ulagen__index {
  font-size: 11px;
  font-weight: 600;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
  text-align: right;
  flex-shrink: 0;
}
.ulagen__prefix48 {
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
  word-break: break-all;
}
.ulagen__details {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 4px 16px;
}
.ulagen__detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ulagen__detail dt {
  font-size: 11px;
  color: var(--qt-muted);
  font-weight: 600;
}
.ulagen__detail dd {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ulagen__detail dd code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
}
</style>
