<script setup lang="ts">
/**
 * PhoneParserFormatter — parse and format international phone numbers.
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
import { RotateCcw, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  usePhoneParserFormatter,
  COUNTRY_OPTIONS,
  FORMAT_ORDER,
  FORMAT_LABELS,
} from './usePhoneParserFormatter';
import type { PhoneParseResult, FormattedPhone } from './usePhoneParserFormatter';

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

const emptyFormats = (): FormattedPhone[] =>
  FORMAT_ORDER.map((fmt) => ({
    format: fmt,
    label: FORMAT_LABELS[fmt],
    value: '',
  }));

const formats = (): FormattedPhone[] => result.value?.formats ?? emptyFormats();

const meta = (): Partial<PhoneParseResult> => result.value ?? {};

const validityBadge = (): { label: string; cls: string } => {
  const r = result.value;
  if (!r || !r.parsed) return { label: '—', cls: 'ppf-badge--muted' };
  if (r.valid) return { label: 'Valid', cls: 'ppf-badge--ok' };
  if (r.possible) return { label: 'Possible', cls: 'ppf-badge--warn' };
  return { label: 'Invalid', cls: 'ppf-badge--err' };
};

const summary = (): string => {
  const r = result.value;
  if (!r) return 'Enter a phone number to parse.';
  if (r.error) return r.error;
  const parts: string[] = [];
  if (r.country) parts.push(r.country);
  if (r.countryCallingCode) parts.push(`+${r.countryCallingCode}`);
  if (r.type && r.type !== 'Unknown') parts.push(r.type);
  if (r.isNonGeographic) parts.push('non-geographic');
  return parts.length > 0 ? parts.join(' · ') : 'Parsed';
};
</script>

<template>
  <div class="ppf">
    <ToolInput
      title="Input"
      description="Type a phone number in any format. Add a default country for national-format numbers."
    >
      <template #actions>
        <button
          type="button"
          class="ppf__btn ppf__btn--ghost"
          title="Clear input"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>Clear</span>
        </button>
      </template>

      <textarea
        class="ppf__input"
        spellcheck="false"
        placeholder="e.g. +1 (415) 555-2671  ·  020 7946 0958  ·  06 12 34 56 78"
        :value="draft"
        @input="onInput"
        aria-label="Phone number to parse"
      ></textarea>

      <div class="ppf__options">
        <label class="ppf__field">
          <span class="ppf__label">Default country</span>
          <select
            class="ppf__select"
            :value="defaultCountry ?? ''"
            @change="onCountry"
            aria-label="Default country for national-format numbers"
          >
            <option value="">Auto-detect (from + prefix)</option>
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
      title="Parsed phone number"
      :description="summary()"
    >
      <template #actions>
        <span
          v-if="loading"
          class="ppf__loading"
          title="Parsing…"
        >
          <Loader2 :size="14" class="ppf__spin" />
          <span>Parsing…</span>
        </span>
      </template>

      <div v-if="!result" class="ppf__empty">
        Enter a phone number above to see the parsed result.
      </div>

      <div v-else class="ppf__body">
        <!-- Error banner -->
        <div v-if="result.error" class="ppf__error" role="alert">
          {{ result.error }}
        </div>

        <!-- Formatted outputs grid -->
        <div class="ppf__section">
          <div class="ppf__section-title">Formatted outputs</div>
          <div class="ppf__formats">
            <div
              v-for="fmt in formats()"
              :key="fmt.format"
              class="ppf__fmt-row"
            >
              <div class="ppf__fmt-label">{{ fmt.label }}</div>
              <div class="ppf__fmt-value-wrap">
                <code
                  class="ppf__fmt-value"
                  :class="{ 'ppf__fmt-value--empty': !fmt.value }"
                >{{ fmt.value || '—' }}</code>
                <CopyButton
                  v-if="fmt.value"
                  :text="fmt.value"
                  label=""
                  class="ppf__fmt-copy"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Metadata grid -->
        <div v-if="result.parsed" class="ppf__section">
          <div class="ppf__section-title">Metadata</div>
          <dl class="ppf__meta">
            <div class="ppf__meta-row">
              <dt>Country</dt>
              <dd>{{ meta().country || '—' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>Country code</dt>
              <dd>{{ meta().countryCallingCode ? `+${meta().countryCallingCode}` : '—' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>National number</dt>
              <dd class="ppf__mono">{{ meta().nationalNumber || '—' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>Type</dt>
              <dd>{{ meta().type || '—' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>Extension</dt>
              <dd class="ppf__mono">{{ meta().extension || '—' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>Non-geographic</dt>
              <dd>{{ meta().isNonGeographic ? 'Yes' : 'No' }}</dd>
            </div>
            <div class="ppf__meta-row">
              <dt>Validity</dt>
              <dd>
                <span class="ppf-badge" :class="validityBadge().cls">
                  {{ validityBadge().label }}
                </span>
              </dd>
            </div>
            <div class="ppf__meta-row">
              <dt>Possible</dt>
              <dd>{{ meta().possible ? 'Yes' : 'No' }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ppf {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ppf__input {
  width: 100%;
  min-height: 90px;
  resize: vertical;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.ppf__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ppf__options {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  margin-top: 12px;
}
.ppf__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ppf__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ppf__select {
  min-width: 220px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.ppf__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ppf__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--qt-radius-sm);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.ppf__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.ppf__btn--ghost:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.ppf__btn--ghost:active {
  transform: translateY(1px);
}
.ppf__loading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ppf__spin {
  animation: ppf-spin 0.9s linear infinite;
}
@keyframes ppf-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.ppf__empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.ppf__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.ppf__error {
  padding: 10px 14px;
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-warning, #c0392b) 95% c h / 0.12);
  border: 1px solid oklch(from var(--qt-warning, #c0392b) 60% c h / 0.4);
  color: var(--qt-warning, #c0392b);
  font-size: 13.5px;
  font-weight: 600;
}
.ppf__section-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.ppf__formats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ppf__fmt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.ppf__fmt-label {
  flex: 0 0 140px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ppf__fmt-value-wrap {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ppf__fmt-value {
  flex: 1 1 auto;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.ppf__fmt-value--empty {
  color: var(--qt-muted);
}
.ppf__fmt-copy {
  flex: 0 0 auto;
}
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
.ppf__mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.ppf-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.ppf-badge--ok {
  background: oklch(from #2ecc71 90% c h / 0.18);
  color: #2ecc71;
}
.ppf-badge--warn {
  background: oklch(from #f39c12 90% c h / 0.18);
  color: #f39c12;
}
.ppf-badge--err {
  background: oklch(from #e74c3c 90% c h / 0.18);
  color: #e74c3c;
}
.ppf-badge--muted {
  background: var(--qt-border);
  color: var(--qt-muted);
}
</style>
