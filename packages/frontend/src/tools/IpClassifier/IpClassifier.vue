<script setup lang="ts">
/**
 * IpClassifier - classify an IPv4 or IPv6 address against the IANA
 * special-purpose registries.
 *
 * Longest-prefix match over the RFC 6890 (IPv4) and RFC 4291+ (IPv6)
 * registries; reports the scope category (private, loopback, link-local,
 * multicast, CGNAT, documentation, reserved, …), the matching CIDR range,
 * the governing RFC, and global-routability.
 *
 * Works in embed mode: receives `ip`/`address`/`input`/`value` PostMessages;
 * sends `output` PostMessages with the classification.
 *
 * No external dependencies - 32-bit integer + 8-hextet array math only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Globe, Lock } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIpClassifier, type IpScope } from './useIpClassifier';

const { t } = useI18n();
const U = 'tools.ip-classifier.ui.';

const { input, result, error } = useIpClassifier();

const hasInput = computed(() => input.value.trim().length > 0);

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

const SCOPE_CLASSES: Record<IpScope, string> = {
  private: 'qt-badge--warn',
  loopback: 'qt-badge--info',
  'link-local': 'qt-badge--info',
  multicast: '',
  cgnat: 'qt-badge--warn',
  documentation: '',
  reserved: '',
  protocol: 'qt-badge--info',
  broadcast: '',
  public: 'qt-badge--success',
};

const rows = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: t(U + 'rowAddress'), value: r.address },
    { label: t(U + 'rowVersion'), value: `IPv${r.version}` },
    { label: t(U + 'rowClassification'), value: r.label },
    { label: t(U + 'rowRange'), value: r.range },
    { label: t(U + 'rowReference'), value: r.rfc },
    { label: t(U + 'rowGlobal'), value: r.isGlobal ? t(U + 'yes') : t(U + 'no') },
  ];
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
      :description="result ? t(U + 'descResult', { addr: result.address, label: result.label }) : t(U + 'descEmpty')"
      :copy-text="result ? `${result.address} ${result.label} (${result.range})` : ''"
      :copy-label="t(U + 'copySummary')"
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
        <div class="qt-row" style="--qt-row-gap:8px;margin-bottom:10px">
          <span
            class="qt-badge"
            style="text-transform:uppercase;font-weight:700"
            :class="SCOPE_CLASSES[result.scope]"
          >
            <component :is="result.isGlobal ? Globe : Lock" :size="13" />
            <span>{{ result.label }}</span>
          </span>
          <span class="qt-badge" style="font-family:var(--qt-font-mono);text-transform:none">{{ result.range }}</span>
          <span v-if="result.rfc !== '—'" class="qt-badge" style="font-family:var(--qt-font-mono);text-transform:none">{{ result.rfc }}</span>
        </div>

        <p style="margin:0 0 12px;font-size:13px;color:var(--qt-muted)">{{ result.description }}</p>

        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="row in rows" :key="row.label" class="qt-result-row cls__row">
            <span class="qt-label cls__row-label">{{ row.label }}</span>
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
.cls__row-label {
  flex: 0 0 140px;
}
@media (max-width: 560px) {
  .cls__row {
    flex-wrap: wrap;
  }
  .cls__row-label {
    flex-basis: 100%;
  }
}
</style>
