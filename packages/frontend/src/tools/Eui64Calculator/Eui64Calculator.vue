<script setup lang="ts">
/**
 * Eui64Calculator - convert a MAC-48 address into a modified EUI-64
 * interface identifier and IPv6 addresses.
 *
 * Inserts `FF FE` between the OUI and device halves and inverts the U/L bit
 * (RFC 4291 §A), then combines the IID with `fe80::/64` (link-local) or a
 * user-supplied /64 prefix to form a full IPv6 address.
 *
 * Works in embed mode: receives `mac`/`address`/`input`/`value` and
 * `prefix` PostMessages; sends `output` PostMessages with the identifier
 * and derived addresses.
 *
 * No external dependencies - byte-array math only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useEui64Calculator } from './useEui64Calculator';

const { t } = useI18n();
const U = 'tools.eui-64-calculator.ui.';

const { macInput, prefixInput, result, error } = useEui64Calculator();

const hasInput = computed(() => macInput.value.trim().length > 0);

function onMacInput(e: Event): void {
  macInput.value = (e.target as HTMLInputElement).value;
}
function onPrefixInput(e: Event): void {
  prefixInput.value = (e.target as HTMLInputElement).value;
}

const rows = computed(() => {
  const r = result.value;
  if (!r) return [];
  const out: { label: string; value: string }[] = [
    { label: t(U + 'rowMac'), value: r.mac },
    { label: t(U + 'rowEui64'), value: r.eui64 },
    { label: t(U + 'rowEui64Colon'), value: r.eui64Colon },
    { label: t(U + 'rowLinkLocal'), value: r.linkLocal },
  ];
  if (r.prefixed && r.prefixUsed) {
    out.push({ label: t(U + 'rowPrefixed', { prefix: r.prefixUsed }), value: r.prefixed });
  }
  return out;
});

const ulNote = computed(() => {
  const r = result.value;
  if (!r) return '';
  return t(U + 'ulNote', { from: r.originalUL ? 1 : 0, to: r.modifiedUL ? 1 : 0 });
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:10px">
        <div class="qt-field" style="gap:4px">
          <label class="qt-stat-head" for="eui-mac">{{ t(U + 'macLabel') }}</label>
          <input
            id="eui-mac"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            :placeholder="t(U + 'phMac')"
            :value="macInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onMacInput"
          />
        </div>
        <div class="qt-field" style="gap:4px">
          <label class="qt-stat-head" for="eui-prefix">{{ t(U + 'prefixLabel') }}</label>
          <input
            id="eui-prefix"
            class="qt-input qt-input--mono"
            style="font-size:13.5px"
            type="text"
            :placeholder="t(U + 'phPrefix')"
            :value="prefixInput"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            @input="onPrefixInput"
          />
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? result.linkLocal : t(U + 'descEmpty')"
      :copy-text="result ? result.linkLocal : ''"
      :copy-label="t(U + 'copyLinkLocal')"
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
        <p style="margin:0 0 10px;font-size:12.5px;color:var(--qt-muted)">{{ ulNote }}</p>
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="row in rows" :key="row.label" class="qt-result-row eui__row">
            <span class="qt-label eui__row-label">{{ row.label }}</span>
            <code class="qt-mono" style="font-size:13px;color:var(--qt-text);flex:1;word-break:break-all">{{ row.value }}</code>
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
.eui__row-label {
  flex: 0 0 170px;
}
@media (max-width: 560px) {
  .eui__row {
    flex-wrap: wrap;
  }
  .eui__row-label {
    flex-basis: 100%;
  }
}
</style>
