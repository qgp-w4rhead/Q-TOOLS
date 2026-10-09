<script setup lang="ts">
/**
 * PhoneParserFormatter - parse and format international phone numbers.
 *
 * Accepts a phone number in any format (with or without a leading `+` and
 * country code) plus an optional default country (used to disambiguate
 * national-format numbers). Produces four canonical formatted outputs
 * (national, international, E.164, RFC 3966 `tel:` URI) and metadata
 * (country, country calling code, national number, type, validity,
 * possibility, non-geographic flag, extension).
 *
 * Works in embed mode: receives `input` PostMessages to set the phone number
 * and default country, and sends `output` PostMessages with the structured
 * parse result.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  usePhoneParserFormatter,
  COUNTRY_OPTIONS,
  FORMAT_ORDER,
} from './usePhoneParserFormatter';
import type { PhoneParseResult, FormattedPhone, PhoneFormat, PhoneTypeLabel } from './usePhoneParserFormatter';

const {
  input,
  defaultCountry,
  result,
  loading,
  reset,
} = usePhoneParserFormatter();

// Debounce the recompute so typing stays responsive. The composable watches
// `input` directly; we just buffer the textarea value and flush on a timer.
const draft = ref<string>(input.value);
let timer: ReturnType<typeof setTimeout> | null = null;

function onInput(e: Event): void {
  draft.value = (e.target as HTMLTextAreaElement).value;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    input.value = draft.value;
  }, 150);
}

function onCountry(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  defaultCountry.value = v === '' ? null : v;
}

function onReset(): void {
  if (timer) clearTimeout(timer);
  reset();
  draft.value = '';
}

const { t } = useI18n();
const U = 'tools.phone-parser-and-formatter.ui.';

const FMT_KEYS: Record<PhoneFormat, string> = {
  NATIONAL: 'fmtNational',
  INTERNATIONAL: 'fmtInternational',
  'E.164': 'fmtE164',
  RFC3966: 'fmtRfc3966',
};
function fmtLabel(f: PhoneFormat): string {
  return t(U + FMT_KEYS[f]);
}
const TYPE_KEYS: Record<PhoneTypeLabel, string> = {
  'Mobile': 'typeMobile',
  'Fixed line': 'typeFixedLine',
  'Fixed line or mobile': 'typeFixedLineOrMobile',
  'VoIP': 'typeVoip',
  'Toll free': 'typeTollFree',
  'Premium rate': 'typePremiumRate',
  'Shared cost': 'typeSharedCost',
  'Personal number': 'typePersonalNumber',
  'Pager': 'typePager',
  'UAN': 'typeUan',
  'Voicemail': 'typeVoicemail',
  'Unknown': 'typeUnknown',
};
function typeLabel(v: PhoneTypeLabel | null | undefined): string {
  if (!v) return '-';
  const k = TYPE_KEYS[v];
  return k ? t(U + k) : v;
}

const emptyFormats = (): FormattedPhone[] =>
  FORMAT_ORDER.map((fmt) => ({
    format: fmt,
    label: fmtLabel(fmt),
    value: '',
  }));

const formats = (): FormattedPhone[] => result.value?.formats ?? emptyFormats();

const meta = (): Partial<PhoneParseResult> => result.value ?? {};

const validityBadge = (): { label: string; cls: string } => {
  const r = result.value;
  if (!r || !r.parsed) return { label: '-', cls: 'qt-badge--muted' };
  if (r.valid) return { label: t(U + 'badgeValid'), cls: 'qt-badge--success' };
  if (r.possible) return { label: t(U + 'badgePossible'), cls: 'qt-badge--warn' };
  return { label: t(U + 'badgeInvalid'), cls: 'qt-badge--error' };
};

const summary = (): string => {
  const r = result.value;
  if (!r) return t(U + 'descEmpty');
  if (r.error) return r.error;
  const parts: string[] = [];
  if (r.country) parts.push(r.country);
  if (r.countryCallingCode) parts.push(`+${r.countryCallingCode}`);
  if (r.type && r.type !== 'Unknown') parts.push(typeLabel(r.type));
  if (r.isNonGeographic) parts.push(t(U + 'nonGeographic'));
  return parts.length > 0 ? parts.join(' · ') : t(U + 'parsed');
};
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'clearTitle')"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.clear') }}</span>
        </button>
      </template>

      <textarea
        class="qt-input"
        style="min-height:90px;line-height:1.6;padding:12px 14px"
        spellcheck="false"
        :placeholder="t(U + 'placeholder')"
        :value="draft"
        @input="onInput"
        :aria-label="t(U + 'ariaInput')"
      ></textarea>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:16px;margin-top:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'defaultCountry') }}</span>
          <select
            class="qt-input"
            style="min-width:220px"
            :value="defaultCountry ?? ''"
            @change="onCountry"
            :aria-label="t(U + 'ariaCountry')"
          >
            <option value="">{{ t(U + 'autoDetect') }}</option>
            <option
              v-for="opt in COUNTRY_OPTIONS"
              :key="opt.code"
              :value="opt.code"
            >
              {{ opt.label }}
            </option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="summary()"
    >
      <template #actions>
        <span
          v-if="loading"
          class="qt-label"
          :title="t(U + 'parsing')"
        >
          <Loader2 :size="14" class="qt-spin" />
          <span>{{ t(U + 'parsing') }}</span>
        </span>
      </template>

      <div v-if="!result" class="qt-alert qt-alert--empty" style="padding:24px 12px;justify-content:center">
        {{ t(U + 'descEmpty') }}
      </div>

      <div v-else class="qt-stack" style="--qt-stack-gap:18px">
        <!-- Error banner -->
        <div v-if="result.error" class="qt-banner qt-banner--warn" role="alert">
          {{ result.error }}
        </div>

        <!-- Formatted outputs grid -->
        <div>
          <div class="qt-stat-head" style="margin-bottom:8px">{{ t(U + 'formattedOutputs') }}</div>
          <div class="qt-stack">
            <div
              v-for="fmt in formats()"
              :key="fmt.format"
              class="qt-result-row"
            >
              <div class="qt-label" style="flex:0 0 140px">{{ fmt.label }}</div>
              <div class="qt-row qt-row--center" style="--qt-row-gap:8px;flex:1 1 auto;min-width:0;flex-wrap:nowrap">
                <code
                  class="ppf__fmt-value"
                  :class="{ 'ppf__fmt-value--empty': !fmt.value }"
                >{{ fmt.value || '-' }}</code>
                <CopyButton
                  v-if="fmt.value"
                  :text="fmt.value"
                  label=""
                  style="flex:0 0 auto"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Metadata grid -->
        <div v-if="result.parsed">
          <div class="qt-stat-head" style="margin-bottom:8px">{{ t(U + 'metadata') }}</div>
          <dl class="ppf__meta">
            <div class="ppf__meta-row">
              <dt>{{ t(U + 'metaCountry') }}</dt>
              <dd>{{ meta().country || '-' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>{{ t(U + 'metaCountryCode') }}</dt>
              <dd>{{ meta().countryCallingCode ? `+${meta().countryCallingCode}` : '-' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>{{ t(U + 'metaNationalNumber') }}</dt>
              <dd class="qt-mono">{{ meta().nationalNumber || '-' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>{{ t(U + 'metaType') }}</dt>
              <dd>{{ typeLabel(meta().type) }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>{{ t(U + 'metaExtension') }}</dt>
              <dd class="qt-mono">{{ meta().extension || '-' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>{{ t(U + 'metaNonGeographic') }}</dt>
              <dd>{{ meta().isNonGeographic ? t(U + 'yes') : t(U + 'no') }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>{{ t(U + 'metaValidity') }}</dt>
              <dd>
                <span class="qt-badge" :class="validityBadge().cls">
                  {{ validityBadge().label }}
                </span>
              </dd>
            </div>
            <div class="ppf__meta-row">
              <dt>{{ t(U + 'metaPossible') }}</dt>
              <dd>{{ meta().possible ? t(U + 'yes') : t(U + 'no') }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Formatted-output value — mono, wraps, muted when empty. */
.ppf__fmt-value {
  flex: 1 1 auto;
  font-family: var(--qt-font-mono);
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.ppf__fmt-value--empty {
  color: var(--qt-muted);
}

/* Metadata <dl> — hairline-divider grid (1px gaps show the border color). */
.ppf__meta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1px;
  margin: 0;
  background: var(--qt-border);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.ppf__meta-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: var(--qt-bg);
}
.ppf__meta-row dt {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ppf__meta-row dd {
  margin: 0;
  font-size: 13.5px;
  color: var(--qt-text);
}
</style>
