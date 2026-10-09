<script setup lang="ts">
/**
 * MacNormalizer - convert a MAC-48 address between notations and decode its
 * IEEE 802 flag bits.
 *
 * Accepts colon, hyphen, Cisco dot, or bare hex input (any case) and emits
 * every standard representation (colon/hyphen upper+lower, Cisco dot, bare,
 * 48-bit decimal + hex integer, dotted binary) plus the OUI prefix and the
 * I/G (multicast) and U/L (locally administered) flag bits.
 *
 * Works in embed mode: receives `mac`/`address`/`input`/`value` PostMessages;
 * sends `output` PostMessages with every representation.
 *
 * No external dependencies.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useMacNormalizer } from './useMacNormalizer';

const { t } = useI18n();
const U = 'tools.mac-normalizer.ui.';

const { input, result, error } = useMacNormalizer();

const hasInput = computed(() => input.value.trim().length > 0);

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

const rows = computed(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: t(U + 'rowColonUpper'), value: r.colonUpper },
    { label: t(U + 'rowColonLower'), value: r.colonLower },
    { label: t(U + 'rowHyphenUpper'), value: r.hyphenUpper },
    { label: t(U + 'rowHyphenLower'), value: r.hyphenLower },
    { label: t(U + 'rowCisco'), value: r.cisco },
    { label: t(U + 'rowBareUpper'), value: r.bareUpper },
    { label: t(U + 'rowBareLower'), value: r.bareLower },
    { label: t(U + 'rowDecimal'), value: r.decimal },
    { label: t(U + 'rowHex'), value: r.hexInteger },
    { label: t(U + 'rowBinary'), value: r.binary },
    { label: t(U + 'rowOui'), value: r.oui },
  ];
});

const badges = computed(() => {
  const r = result.value;
  if (!r) return [];
  const out: { label: string; kind: 'flag' | 'neutral' }[] = [];
  out.push({
    label: r.isMulticast ? t(U + 'badgeMulticast') : t(U + 'badgeUnicast'),
    kind: r.isMulticast ? 'flag' : 'neutral',
  });
  out.push({
    label: r.isLocallyAdministered
      ? t(U + 'badgeLocal')
      : t(U + 'badgeUniversal'),
    kind: r.isLocallyAdministered ? 'flag' : 'neutral',
  });
  if (r.isBroadcast) out.push({ label: t(U + 'badgeBroadcast'), kind: 'flag' });
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
      :description="result ? result.colonUpper : t(U + 'descEmpty')"
      :copy-text="result ? result.colonUpper : ''"
      :copy-label="t(U + 'copyCanonical')"
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
        <div class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
          <span
            v-for="b in badges"
            :key="b.label"
            class="qt-badge"
            style="font-weight:700"
            :class="{ 'qt-badge--warn': b.kind === 'flag' }"
          >{{ b.label }}</span>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="row in rows" :key="row.label" class="qt-result-row macn__row">
            <span class="qt-label macn__row-label">{{ row.label }}</span>
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
.macn__row-label {
  flex: 0 0 140px;
}
@media (max-width: 560px) {
  .macn__row {
    flex-wrap: wrap;
  }
  .macn__row-label {
    flex-basis: 100%;
  }
}
</style>
