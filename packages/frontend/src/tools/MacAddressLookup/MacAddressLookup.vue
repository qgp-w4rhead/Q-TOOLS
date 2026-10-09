<script setup lang="ts">
/**
 * MacAddressLookup - look up the vendor / manufacturer for a MAC address.
 *
 * Parses a MAC-48 address (or 3-octet OUI prefix) from any common notation,
 * normalises it, classifies it (multicast / locally-administered / broadcast),
 * and looks up the vendor from the bundled IEEE OUI database (~39k entries,
 * lazy-loaded as a separate Vite chunk).
 *
 * No external dependencies for lookup logic.
 *
 * Works in embed mode: receives `mac`/`address`/`input`/`value` PostMessages
 * to pre-fill the field; sends `output` PostMessages with
 * `{ oui, vendor, normalized, isMulticast, isLocallyAdministered, isBroadcast, … }`
 * whenever the result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  Network,
  Radio,
  Shield,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useMacAddressLookup } from './useMacAddressLookup';
import type { MacSeparator } from './useMacAddressLookup';

const { t } = useI18n();
const U = 'tools.mac-address-lookup.ui.';

const { input, result, loading, dbLoaded } = useMacAddressLookup();

const hasInput = computed(() => input.value.trim().length > 0);

const formatVariants = computed<{ label: string; value: string; sep: MacSeparator }[]>(() => {
  if (!result.value || !result.value.isValid || !result.value.octets) return [];
  if (result.value.isOuiOnly) return [];
  const f = result.value.formatted;
  return [
    { label: t(U + 'fmtColon'), value: f(':'), sep: ':' },
    { label: t(U + 'fmtDash'), value: f('-'), sep: '-' },
    { label: t(U + 'fmtCisco'), value: f('.'), sep: '.' },
    { label: t(U + 'fmtBare'), value: f('none'), sep: 'none' },
  ];
});

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-input-wrap">
        <Network :size="16" class="mac__field-icon" />
        <input
          class="qt-input"
          style="padding:10px 12px 10px 36px"
          type="text"
          :placeholder="t(U + 'phMac')"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onInput"
        />
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descOk') : t(U + 'descEmpty')"
      :copy-text="result?.vendor ?? ''"
      :copy-label="t(U + 'copyVendor')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'alertEmpty') }}</p>
      </template>
      <template v-else-if="result">
        <!-- Validation error -->
        <p v-if="!result.isValid && result.error" class="qt-banner qt-banner--error" style="margin:0 0 12px">
          <AlertTriangle :size="13" />
          <span>{{ result.error }}</span>
        </p>

        <template v-if="result.isValid">
          <!-- Status badges -->
          <div class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
            <span
              class="qt-badge"
              style="text-transform:uppercase;font-weight:700"
              :class="{ 'qt-badge--success': result.isKnown }"
            >
              <component
                :is="result.isKnown ? CheckCircle2 : AlertTriangle"
                :size="13"
              />
              <span>{{
                result.isKnown ? t(U + 'badgeFound') : t(U + 'badgeUnknown')
              }}</span>
            </span>
            <span
              v-if="result.isOuiOnly"
              class="qt-badge qt-badge--info"
              style="text-transform:uppercase;font-weight:700"
            >
              <span>{{ t(U + 'badgeOuiOnly') }}</span>
            </span>
            <span
              v-if="result.isMulticast"
              class="qt-badge qt-badge--warn"
              style="text-transform:uppercase;font-weight:700"
            >
              <Radio :size="13" />
              <span>{{ t(U + 'badgeMulticast') }}</span>
            </span>
            <span
              v-if="result.isLocallyAdministered"
              class="qt-badge qt-badge--info"
              style="text-transform:uppercase;font-weight:700"
            >
              <Shield :size="13" />
              <span>{{ t(U + 'badgeLocal') }}</span>
            </span>
            <span
              v-if="result.isBroadcast"
              class="qt-badge qt-badge--error"
              style="text-transform:uppercase;font-weight:700"
            >
              <span>{{ t(U + 'badgeBroadcast') }}</span>
            </span>
          </div>

          <!-- Loading indicator -->
          <p v-if="loading && !dbLoaded" class="qt-row qt-row--center" style="--qt-row-gap:8px;padding:8px 12px;color:var(--qt-muted);font-size:13px;margin:0 0 12px">
            <Loader2 :size="13" class="qt-spin" />
            <span>{{ t(U + 'loading') }}</span>
          </p>

          <!-- Vendor name -->
          <div class="qt-result" style="gap:6px;padding:12px 14px;margin-bottom:12px">
            <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
              <Building2 :size="15" style="color:var(--qt-muted)" />
              <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'vendorLabel') }}</span>
            </div>
            <code class="qt-value" style="font-size:15px;word-break:break-word">{{
              result.vendor ?? (dbLoaded ? t(U + 'vendorUnknown') : '-')
            }}</code>
          </div>

          <!-- Breakdown grid -->
          <div class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:10px;margin-bottom:12px">
            <div class="qt-result" style="padding:10px 12px;min-width:0">
              <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'ouiPrefix') }}</span>
              <div class="qt-row qt-row--center" style="--qt-row-gap:8px;min-width:0">
                <code class="qt-value qt-value--sm" style="font-size:13px;word-break:break-all;flex:1;min-width:0">{{ result.oui }}</code>
                <CopyButton
                  :text="result.oui ?? ''"
                  label=""
                  icon-only
                />
              </div>
            </div>
            <div class="qt-result" style="padding:10px 12px;min-width:0">
              <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'normalizedMac') }}</span>
              <div class="qt-row qt-row--center" style="--qt-row-gap:8px;min-width:0">
                <code class="qt-value qt-value--sm" style="font-size:13px;word-break:break-all;flex:1;min-width:0">{{ result.normalized }}</code>
                <CopyButton
                  :text="result.normalized ?? ''"
                  label=""
                  icon-only
                />
              </div>
            </div>
          </div>

          <!-- Format variants (full MAC only) -->
          <div v-if="formatVariants.length" class="qt-stack" style="--qt-stack-gap:8px">
            <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em">{{ t(U + 'formatVariants') }}</span>
            <div class="qt-stack" style="--qt-stack-gap:6px">
              <div
                v-for="v in formatVariants"
                :key="v.sep"
                class="qt-result-row"
                style="min-width:0"
              >
                <span class="qt-stat-head" style="font-size:11px;width:56px;flex-shrink:0">{{ v.label }}</span>
                <code class="qt-value qt-value--sm" style="font-size:13px;word-break:break-all;flex:1;min-width:0">{{ v.value }}</code>
                <CopyButton :text="v.value" label="" icon-only />
              </div>
            </div>
          </div>
        </template>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Leading icon inside .qt-input-wrap (the wrap only pads for a right button). */
.mac__field-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
</style>
