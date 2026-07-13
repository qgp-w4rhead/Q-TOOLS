<script setup lang="ts">
/**
 * MacAddressLookup — look up the vendor / manufacturer for a MAC address.
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

const { input, result, loading, dbLoaded } = useMacAddressLookup();

const hasInput = computed(() => input.value.trim().length > 0);

const formatVariants = computed<{ label: string; value: string; sep: MacSeparator }[]>(() => {
  if (!result.value || !result.value.isValid || !result.value.octets) return [];
  if (result.value.isOuiOnly) return [];
  const f = result.value.formatted;
  return [
    { label: 'Colon', value: f(':'), sep: ':' },
    { label: 'Dash', value: f('-'), sep: '-' },
    { label: 'Cisco', value: f('.'), sep: '.' },
    { label: 'Bare', value: f('none'), sep: 'none' },
  ];
});

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="mac">
    <ToolInput
      title="MAC address"
      description="Enter a MAC-48 address or 3-octet OUI prefix. Accepts colon, dash, dot (Cisco), or bare hex notation."
    >
      <div class="mac__field">
        <Network :size="16" class="mac__field-icon" />
        <input
          class="mac__input"
          type="text"
          placeholder="00:1A:2B:3C:4D:5E"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onInput"
        />
      </div>
    </ToolInput>

    <ToolOutput
      title="Vendor lookup"
      :description="
        result
          ? 'Vendor / manufacturer from the IEEE OUI database.'
          : 'Enter a MAC address above to look up its vendor.'
      "
      :copy-text="result?.vendor ?? ''"
      copy-label="Copy vendor"
    >
      <template v-if="!hasInput">
        <p class="mac__empty">Enter a MAC address above to look up its vendor.</p>
      </template>
      <template v-else-if="result">
        <!-- Validation error -->
        <p v-if="!result.isValid && result.error" class="mac__error">
          <AlertTriangle :size="13" />
          <span>{{ result.error }}</span>
        </p>

        <template v-if="result.isValid">
          <!-- Status badges -->
          <div class="mac__badges">
            <span
              class="mac__badge"
              :class="result.isKnown ? 'mac__badge--ok' : 'mac__badge--muted'"
            >
              <component
                :is="result.isKnown ? CheckCircle2 : AlertTriangle"
                :size="13"
              />
              <span>{{
                result.isKnown ? 'Vendor found' : 'Unknown OUI'
              }}</span>
            </span>
            <span
              v-if="result.isOuiOnly"
              class="mac__badge mac__badge--info"
            >
              <span>OUI only (3 octets)</span>
            </span>
            <span
              v-if="result.isMulticast"
              class="mac__badge mac__badge--warn"
            >
              <Radio :size="13" />
              <span>Multicast</span>
            </span>
            <span
              v-if="result.isLocallyAdministered"
              class="mac__badge mac__badge--info"
            >
              <Shield :size="13" />
              <span>Locally administered</span>
            </span>
            <span
              v-if="result.isBroadcast"
              class="mac__badge mac__badge--bad"
            >
              <span>Broadcast</span>
            </span>
          </div>

          <!-- Loading indicator -->
          <p v-if="loading && !dbLoaded" class="mac__loading">
            <Loader2 :size="13" class="mac__spin" />
            <span>Loading OUI database…</span>
          </p>

          <!-- Vendor name -->
          <div class="mac__vendor">
            <div class="mac__vendor-head">
              <Building2 :size="15" class="mac__vendor-icon" />
              <span class="mac__vendor-label">Vendor / manufacturer</span>
            </div>
            <code class="mac__vendor-value">{{
              result.vendor ?? (dbLoaded ? 'Unknown — not in OUI database' : '—')
            }}</code>
          </div>

          <!-- Breakdown grid -->
          <div class="mac__grid">
            <div class="mac__cell">
              <span class="mac__cell-label">OUI prefix</span>
              <div class="mac__cell-row">
                <code class="mac__cell-value">{{ result.oui }}</code>
                <CopyButton
                  :text="result.oui ?? ''"
                  label=""
                  icon-only
                />
              </div>
            </div>
            <div class="mac__cell">
              <span class="mac__cell-label">Normalised MAC</span>
              <div class="mac__cell-row">
                <code class="mac__cell-value">{{ result.normalized }}</code>
                <CopyButton
                  :text="result.normalized ?? ''"
                  label=""
                  icon-only
                />
              </div>
            </div>
          </div>

          <!-- Format variants (full MAC only) -->
          <div v-if="formatVariants.length" class="mac__formats">
            <span class="mac__formats-title">Format variants</span>
            <div class="mac__format-list">
              <div
                v-for="v in formatVariants"
                :key="v.sep"
                class="mac__format-row"
              >
                <span class="mac__format-label">{{ v.label }}</span>
                <code class="mac__format-value">{{ v.value }}</code>
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
.mac {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.mac__field {
  position: relative;
  display: flex;
  align-items: center;
}
.mac__field-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
.mac__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px 10px 36px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.mac__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.mac__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.mac__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.mac__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
}
.mac__badge--ok {
  background: oklch(from var(--qt-success) 35% c h / 0.2);
  border-color: oklch(from var(--qt-success) 60% c h / 0.55);
  color: var(--qt-success);
}
.mac__badge--bad {
  background: oklch(from var(--qt-danger) 35% c h / 0.2);
  border-color: oklch(from var(--qt-danger) 60% c h / 0.55);
  color: var(--qt-danger);
}
.mac__badge--warn {
  background: oklch(from var(--qt-warning) 35% c h / 0.2);
  border-color: oklch(from var(--qt-warning) 60% c h / 0.55);
  color: var(--qt-warning);
}
.mac__badge--info {
  background: oklch(from var(--qt-accent) 35% c h / 0.18);
  border-color: oklch(from var(--qt-accent) 60% c h / 0.5);
  color: var(--qt-accent);
}
.mac__badge--muted {
  background: var(--qt-bg);
  border-color: var(--qt-border);
  color: var(--qt-muted);
}
.mac__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: oklch(from var(--qt-danger) 35% c h / 0.18);
  border: 1px solid oklch(from var(--qt-danger) 60% c h / 0.5);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-size: 13.5px;
  margin: 0 0 12px;
}
.mac__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}
.mac__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: var(--qt-muted);
  font-size: 13px;
  margin: 0 0 12px;
}
.mac__spin {
  animation: mac-spin 0.8s linear infinite;
}
@keyframes mac-spin {
  to {
    transform: rotate(360deg);
  }
}
.mac__vendor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  margin-bottom: 12px;
}
.mac__vendor-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mac__vendor-icon {
  color: var(--qt-muted);
}
.mac__vendor-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.mac__vendor-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 15px;
  color: var(--qt-text);
  word-break: break-word;
}
.mac__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.mac__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  min-width: 0;
}
.mac__cell-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.mac__cell-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.mac__cell-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  flex: 1;
  min-width: 0;
}
.mac__formats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mac__formats-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.mac__format-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mac__format-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  min-width: 0;
}
.mac__format-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
  width: 56px;
  flex-shrink: 0;
}
.mac__format-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  flex: 1;
  min-width: 0;
}
@media (max-width: 560px) {
  .mac__grid {
    grid-template-columns: 1fr;
  }
}
</style>
