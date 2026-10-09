<script setup lang="ts">
/**
 * CidrAggregator - merge a list of CIDRs, ranges, and single IPs into the
 * minimal set of covering CIDR blocks (inverse of the IPv4 range expander).
 *
 * Input accepts one entry per line (or comma-separated): `a.b.c.d/n`,
 * `a.b.c.d - e.f.g.h`, or a bare IP. `#` and `//` comments are stripped.
 * Overlapping and adjacent intervals are merged before the greedy
 * range-to-CIDR expansion.
 *
 * Works in embed mode: receives `input`/`value`/`cidrs` (string or array)
 * PostMessages; sends `output` PostMessages with the aggregated block list.
 *
 * No external dependencies - 32-bit unsigned integer arithmetic only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useCidrAggregator } from './useCidrAggregator';

const { t, locale } = useI18n();
const U = 'tools.cidr-aggregator.ui.';

const { input, result } = useCidrAggregator();

const hasInput = computed(() => input.value.trim().length > 0);

function onInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

const copyAllText = computed(() =>
  result.value ? result.value.cidrs.map((c) => c.cidr).join('\n') : '',
);

const summaryText = computed(() => {
  const r = result.value;
  if (!r) return '';
  const parts = [
    t(U + (r.cidrs.length === 1 ? 'summaryBlocksOne' : 'summaryBlocks'), { n: r.cidrs.length }),
    t(U + 'summaryAddresses', { n: r.totalAddresses.toLocaleString(locale.value) }),
  ];
  if (r.errors.length > 0) {
    parts.push(t(U + (r.errors.length === 1 ? 'summaryInvalidOne' : 'summaryInvalid'), { n: r.errors.length }));
  }
  return parts.join(' · ');
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <textarea
        class="qt-input qt-input--mono"
        style="font-size:13px"
        rows="7"
        :placeholder="t(U + 'phInput')"
        :value="input"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
        @input="onInput"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? summaryText : t(U + 'descEmpty')"
      :copy-text="copyAllText"
      :copy-label="t(U + 'copyList')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'alertEmpty') }}</p>
      </template>
      <template v-else-if="result">
        <div v-if="result.errors.length > 0" class="qt-stack" style="--qt-stack-gap:6px;margin-bottom:10px">
          <p
            v-for="(err, i) in result.errors"
            :key="i"
            class="qt-banner qt-banner--error"
            style="margin:0;font-size:12.5px;padding:8px 10px"
          >
            <AlertCircle :size="13" />
            <span>{{ t(U + 'errLine', { line: err.line, text: err.text, error: err.error }) }}</span>
          </p>
        </div>

        <template v-if="result.cidrs.length > 0">
          <div class="agg__table">
            <div class="agg__thead">
              <span>{{ t(U + 'colCidr') }}</span>
              <span>{{ t(U + 'colRange') }}</span>
              <span>{{ t(U + 'colAddr') }}</span>
              <span />
            </div>
            <div
              v-for="c in result.cidrs"
              :key="c.cidr"
              class="agg__row"
            >
              <code class="agg__cidr">{{ c.cidr }}</code>
              <code class="agg__range">{{ c.first }} – {{ c.last }}</code>
              <span class="agg__count">{{ c.count.toLocaleString(locale) }}</span>
              <CopyButton :text="c.cidr" icon-only :label="t('common.copy')" />
            </div>
          </div>

          <details v-if="result.mergedRanges.length > 1" class="qt-panel" style="margin-top:10px;padding:8px 10px">
            <summary class="qt-label" style="cursor:pointer">
              {{ t(U + 'mergedSummary', { n: result.mergedRanges.length }) }}
            </summary>
            <div class="qt-stack" style="--qt-stack-gap:4px;margin-top:8px">
              <code
                v-for="(m, i) in result.mergedRanges"
                :key="i"
                class="qt-mono"
                style="font-size:12.5px;color:var(--qt-text);padding:4px 8px;background:var(--qt-bg);border:1px solid var(--qt-border);border-radius:var(--qt-radius-sm)"
              >{{ m.start }} – {{ m.end }} ({{ m.count.toLocaleString(locale) }})</code>
            </div>
          </details>
        </template>
        <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'noValid') }}</p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Aggregated-blocks table — fixed-column grid + header + narrow re-layout. */
.agg__table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.agg__thead,
.agg__row {
  display: grid;
  grid-template-columns: 140px 1fr 90px 34px;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
}
.agg__thead {
  background: var(--qt-bg);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
  border-bottom: 1px solid var(--qt-border);
}
.agg__row {
  border-bottom: 1px solid var(--qt-border);
  font-size: 13px;
}
.agg__row:last-child {
  border-bottom: none;
}
.agg__cidr {
  font-family: var(--qt-font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}
.agg__range {
  font-family: var(--qt-font-mono);
  font-size: 12.5px;
  color: var(--qt-muted);
  word-break: break-all;
}
.agg__count {
  font-size: 12.5px;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

@media (max-width: 640px) {
  .agg__thead {
    display: none;
  }
  .agg__row {
    grid-template-columns: 1fr 34px;
    grid-template-areas:
      'cidr copy'
      'range copy'
      'count copy';
    row-gap: 2px;
  }
  .agg__cidr { grid-area: cidr; }
  .agg__range { grid-area: range; }
  .agg__count { grid-area: count; text-align: left; }
}
</style>
