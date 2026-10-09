<script setup lang="ts">
/**
 * WildcardMaskConverter - convert between CIDR prefix, subnet mask, and
 * wildcard mask (Cisco ACL style).
 *
 * Auto-detects the input form (bare integer → prefix; contiguous dotted
 * quad → subnet mask; inverted contiguous quad → wildcard) or accepts an
 * explicit mode. An optional network address field renders a ready-to-paste
 * Cisco ACL fragment (`network wildcard`).
 *
 * Works in embed mode: receives `input`/`value`/`mask`/`wildcard`/`prefix`/
 * `cidr`, `mode`, and `network` PostMessages; sends `output` PostMessages
 * with all three forms.
 *
 * No external dependencies - 32-bit unsigned integer arithmetic only.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useWildcardMaskConverter, type MaskMode } from './useWildcardMaskConverter';

const { t, locale } = useI18n();
const U = 'tools.wildcard-mask-converter.ui.';

const { input, mode, networkInput, result, error } = useWildcardMaskConverter();

const hasInput = computed(() => input.value.trim().length > 0);

const MODES = computed<{ id: MaskMode; label: string }[]>(() => [
  { id: 'auto', label: t(U + 'modeAuto') },
  { id: 'prefix', label: t(U + 'modePrefix') },
  { id: 'mask', label: t(U + 'modeMask') },
  { id: 'wildcard', label: t(U + 'modeWildcard') },
]);

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}
function onNetworkInput(e: Event): void {
  networkInput.value = (e.target as HTMLInputElement).value;
}

const rows = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: t(U + 'rowPrefix'), value: `/${r.prefix}` },
    { label: t(U + 'rowMask'), value: r.subnetMask },
    { label: t(U + 'rowWildcard'), value: r.wildcardMask },
    { label: t(U + 'rowBinaryMask'), value: r.binaryMask },
    { label: t(U + 'rowBinaryWildcard'), value: r.binaryWildcard },
    { label: t(U + 'rowTotal'), value: r.totalAddresses.toLocaleString(locale.value) },
    { label: t(U + 'rowHosts'), value: r.usableHosts.toLocaleString(locale.value) },
  ];
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-field" style="gap:4px">
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
      <div class="qt-field" style="gap:4px">
        <label class="qt-stat-head" for="wc-network">{{ t(U + 'networkLabel') }}</label>
        <input
          id="wc-network"
          class="qt-input qt-input--mono"
          style="font-size:13.5px"
          type="text"
          :placeholder="t(U + 'phNetwork')"
          :value="networkInput"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onNetworkInput"
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descResult', { prefix: result.prefix, mask: result.subnetMask, wildcard: result.wildcardMask }) : t(U + 'descEmpty')"
      :copy-text="result ? result.wildcardMask : ''"
      :copy-label="t(U + 'copyWildcard')"
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
        <p style="margin:0 0 10px;font-size:12.5px;color:var(--qt-muted)">
          {{ t(U + 'interpretedAs') }} <strong style="color:var(--qt-text)">{{ result.interpretedAs === 'prefix' ? t(U + 'asPrefix') : result.interpretedAs === 'mask' ? t(U + 'asMask') : t(U + 'asWildcard') }}</strong>
        </p>
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="row in rows" :key="row.label" class="qt-result-row wc__row">
            <span class="qt-label wc__row-label">{{ row.label }}</span>
            <code class="qt-mono" style="font-size:13px;color:var(--qt-text);flex:1;word-break:break-all">{{ row.value }}</code>
            <CopyButton :text="row.value" icon-only :label="t('common.copy')" />
          </div>
        </div>
        <div v-if="result.aclFragment" class="qt-result-row wc__acl" style="margin-top:12px;background:oklch(from var(--qt-accent) 35% c h / 0.12);border-color:oklch(from var(--qt-accent) 60% c h / 0.4)">
          <span class="qt-label wc__acl-label">{{ t(U + 'aclLabel') }}</span>
          <code class="qt-value" style="font-size:13px;flex:1;word-break:break-all">permit ip {{ result.aclFragment }} any</code>
          <CopyButton :text="`permit ip ${result.aclFragment} any`" icon-only :label="t('common.copy')" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Result-row/ACL label — fixed column width; wraps full-width on narrow. */
.wc__row-label,
.wc__acl-label {
  flex: 0 0 130px;
}
@media (max-width: 560px) {
  .wc__row,
  .wc__acl {
    flex-wrap: wrap;
  }
  .wc__row-label,
  .wc__acl-label {
    flex-basis: 100%;
  }
}
</style>
