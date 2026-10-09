<script setup lang="ts">
/**
 * SubnetSplitter - split a CIDR into N equal subnets or plan VLSM
 * allocations by required host counts.
 *
 * Equal mode borrows ceil(log2(N)) bits and lists every resulting subnet.
 * VLSM mode sorts host requirements descending and packs the smallest
 * fitting block for each, starting at the base network address.
 *
 * Works in embed mode: receives `network`/`cidr`/`base`/`input`/`value` for
 * the base network, `mode` (`equal`|`vlsm`), `count`/`subnets` for equal
 * mode, and `hosts` (array or string) for VLSM mode; sends `output`
 * PostMessages with the allocation table.
 *
 * No external dependencies - 32-bit unsigned integer arithmetic only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Info } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useSubnetSplitter, type SplitMode } from './useSubnetSplitter';

const { t, locale } = useI18n();
const U = 'tools.subnet-splitter.ui.';

const {
  baseInput,
  mode,
  countInput,
  hostsInput,
  result,
  error,
} = useSubnetSplitter();

const hasInput = computed(() => baseInput.value.trim().length > 0);

const MODES = computed<{ id: SplitMode; label: string }[]>(() => [
  { id: 'equal', label: t(U + 'modeEqual') },
  { id: 'vlsm', label: t(U + 'modeVlsm') },
]);

function onBaseInput(e: Event): void {
  baseInput.value = (e.target as HTMLInputElement).value;
}
function onCountInput(e: Event): void {
  countInput.value = (e.target as HTMLInputElement).value;
}
function onHostsInput(e: Event): void {
  hostsInput.value = (e.target as HTMLTextAreaElement).value;
}

const copyAllText = computed(() =>
  result.value ? result.value.subnets.map((s) => s.cidr).join('\n') : '',
);

const summaryText = computed(() => {
  const r = result.value;
  if (!r) return '';
  const usedPct = r.baseSize > 0 ? ((r.usedAddresses / r.baseSize) * 100).toFixed(1) : '0';
  const subnets = t(U + (r.subnets.length === 1 ? 'summarySubnetsOne' : 'summarySubnets'), { n: r.subnets.length });
  const used = t(U + 'summaryUsed', { n: r.usedAddresses.toLocaleString(locale.value), pct: usedPct });
  const free = t(U + 'summaryFree', { n: r.freeAddresses.toLocaleString(locale.value) });
  return `${subnets} · ${used} · ${free}`;
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-row">
        <input
          class="qt-input qt-input--mono"
          style="font-size:13.5px"
          type="text"
          :placeholder="t(U + 'phBase')"
          :value="baseInput"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onBaseInput"
        />
      </div>

      <div class="qt-row" style="--qt-row-gap:6px">
        <button
          v-for="m in MODES"
          :key="m.id"
          type="button"
          class="qt-chip qt-chip--filled"
          style="padding:4px 12px"
          :class="{ 'qt-chip--active': mode === m.id }"
          @click="mode = m.id"
        >
          {{ m.label }}
        </button>
      </div>

      <div v-if="mode === 'equal'" class="qt-field" style="gap:4px">
        <label class="qt-stat-head" for="split-count">{{ t(U + 'countLabel') }}</label>
        <input
          id="split-count"
          class="qt-input qt-input--mono"
          style="font-size:13.5px"
          type="text"
          inputmode="numeric"
          :placeholder="t(U + 'phCount')"
          :value="countInput"
          spellcheck="false"
          autocomplete="off"
          @input="onCountInput"
        />
        <p class="qt-hint" style="margin:0;font-size:12px">
          {{ t(U + 'countHint') }}
        </p>
      </div>

      <div v-else class="qt-field" style="gap:4px">
        <label class="qt-stat-head" for="split-hosts">{{ t(U + 'hostsLabel') }}</label>
        <textarea
          id="split-hosts"
          class="qt-input qt-input--mono"
          style="font-size:13px"
          rows="3"
          :placeholder="t(U + 'phHosts')"
          :value="hostsInput"
          spellcheck="false"
          autocomplete="off"
          @input="onHostsInput"
        />
        <p class="qt-hint" style="margin:0;font-size:12px">
          {{ t(U + 'hostsHint') }}
        </p>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? `${result.base} → ${summaryText}` : t(U + 'descEmpty')"
      :copy-text="copyAllText"
      :copy-label="t(U + 'copyList')"
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
        <p v-if="result.note" class="qt-banner qt-banner--info" style="margin:0 0 10px;font-size:12.5px">
          <Info :size="14" />
          <span>{{ result.note }}</span>
        </p>

        <div class="splitter__table">
          <div class="splitter__thead">
            <span>#</span>
            <span>{{ t(U + 'colCidr') }}</span>
            <span>{{ t(U + 'colMask') }}</span>
            <span>{{ t(U + 'colRange') }}</span>
            <span>{{ t(U + 'colHosts') }}</span>
            <span />
          </div>
          <div
            v-for="s in result.subnets"
            :key="s.cidr"
            class="splitter__row"
          >
            <span class="splitter__idx">{{ s.index }}</span>
            <code class="splitter__cidr">{{ s.cidr }}</code>
            <code class="splitter__mask">{{ s.mask }}</code>
            <code class="splitter__range">{{ s.firstHost }} – {{ s.lastHost }}</code>
            <span class="splitter__hosts">
              {{ s.hosts.toLocaleString(locale) }}
              <span v-if="s.requested !== undefined" class="splitter__requested">
                {{ t(U + 'reqSuffix', { n: s.requested.toLocaleString(locale) }) }}
              </span>
            </span>
            <CopyButton :text="s.cidr" icon-only :label="t('common.copy')" />
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Allocations table — fixed-column grid with a header + narrow re-layout. */
.splitter__table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.splitter__thead,
.splitter__row {
  display: grid;
  grid-template-columns: 34px 130px 120px 1fr 110px 34px;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
}
.splitter__thead {
  background: var(--qt-bg);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
  border-bottom: 1px solid var(--qt-border);
}
.splitter__row {
  border-bottom: 1px solid var(--qt-border);
  font-size: 13px;
}
.splitter__row:last-child {
  border-bottom: none;
}
.splitter__idx {
  color: var(--qt-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.splitter__cidr,
.splitter__mask,
.splitter__range {
  font-family: var(--qt-font-mono);
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
}
.splitter__cidr {
  font-weight: 700;
}
.splitter__hosts {
  font-size: 12.5px;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
.splitter__requested {
  color: var(--qt-muted);
  font-size: 11.5px;
}

@media (max-width: 720px) {
  .splitter__thead {
    display: none;
  }
  .splitter__row {
    grid-template-columns: 30px 1fr 34px;
    grid-template-areas:
      'idx cidr copy'
      'idx mask copy'
      'idx range copy'
      'idx hosts copy';
    row-gap: 2px;
  }
  .splitter__idx { grid-area: idx; }
  .splitter__cidr { grid-area: cidr; }
  .splitter__mask { grid-area: mask; }
  .splitter__range { grid-area: range; }
  .splitter__hosts { grid-area: hosts; }
}
</style>
