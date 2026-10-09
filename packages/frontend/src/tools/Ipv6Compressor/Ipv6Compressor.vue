<script setup lang="ts">
/**
 * Ipv6Compressor - convert an IPv6 address between its textual forms.
 *
 * Accepts full 8-hextet, `::`-compressed, and IPv4-embedded
 * (`::ffff:1.2.3.4`) input; emits the RFC 5952 compressed form, the fully
 * expanded form, the un-padded uncompressed form, and IPv4-mapped /
 * IPv4-compatible forms when applicable.
 *
 * Works in embed mode: receives `address`/`ipv6`/`ip`/`input`/`value`
 * PostMessages; sends `output` PostMessages with every representation.
 *
 * No external dependencies - byte-array math only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpv6Compressor } from './useIpv6Compressor';

const { t } = useI18n();
const U = 'tools.ipv6-compressor.ui.';

const { input, result, error } = useIpv6Compressor();

const hasInput = computed(() => input.value.trim().length > 0);

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

const rows = computed(() => {
  const r = result.value;
  if (!r) return [];
  const out: { label: string; value: string }[] = [
    { label: t(U + 'rowCompressed'), value: r.compressed },
    { label: t(U + 'rowExpanded'), value: r.expanded },
    { label: t(U + 'rowUncompressed'), value: r.uncompressed },
  ];
  if (r.ipv4Mapped) out.push({ label: t(U + 'rowIpv4Mapped'), value: r.ipv4Mapped });
  if (r.ipv4Compatible) {
    out.push({ label: t(U + 'rowIpv4Compatible'), value: r.ipv4Compatible });
  }
  if (r.embeddedIpv4) {
    out.push({ label: t(U + 'rowEmbedded'), value: r.embeddedIpv4 });
  }
  return out;
});

const badges = computed(() => {
  const r = result.value;
  if (!r) return [];
  const out: string[] = [];
  if (r.isUnspecified) out.push(t(U + 'badgeUnspecified'));
  if (r.isLoopback) out.push(t(U + 'badgeLoopback'));
  if (r.isIpv4Mapped) out.push(t(U + 'badgeMapped'));
  return out;
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <input
        class="qt-input qt-input--mono"
        style="font-size:13.5px"
        type="text"
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
      :description="result ? result.compressed : t(U + 'descEmpty')"
      :copy-text="result ? result.compressed : ''"
      :copy-label="t(U + 'copyCompressed')"
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
        <div v-if="badges.length" class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
          <span v-for="b in badges" :key="b" class="qt-badge qt-badge--info" style="text-transform:uppercase;font-weight:700">{{ b }}</span>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="row in rows" :key="row.label" class="qt-result-row v6__row">
            <span class="qt-label v6__row-label">{{ row.label }}</span>
            <code class="qt-value" style="font-size:13.5px;flex:1;word-break:break-all">{{ row.value }}</code>
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
.v6__row-label {
  flex: 0 0 170px;
}
@media (max-width: 560px) {
  .v6__row {
    flex-wrap: wrap;
  }
  .v6__row-label {
    flex-basis: 100%;
  }
}
</style>
