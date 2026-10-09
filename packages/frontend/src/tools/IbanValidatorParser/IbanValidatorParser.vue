<script setup lang="ts">
/**
 * IbanValidatorParser - validate and parse an IBAN account number.
 *
 * Validates the IBAN structure (country code, length, character classes) and
 * the mod-97 checksum, then breaks it down into country, bank code, branch
 * code, account number, national check digits, and the IBAN check digits.
 * The formatted IBAN (4-char groups) is also displayed.
 *
 * No external dependencies - the country spec table and mod-97 algorithm are
 * hand-rolled.
 *
 * Works in embed mode: receives `iban`/`input`/`value`/`account`/`text`/
 * `content` PostMessages to pre-fill the field; sends `output` PostMessages
 * with `{ iban, formatted, valid, country, countryName, checksum, bankCode,
 * branchCode, accountNumber, nationalCheckDigits, error }` whenever the
 * result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  GitBranch,
  Hash,
  Landmark,
  RotateCcw,
  ShieldCheck,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useIbanValidatorParser } from './useIbanValidatorParser';

const { input, result } = useIbanValidatorParser();

const { t } = useI18n();
const U = 'tools.iban-validator-and-parser.ui.';

const hasInput = computed(() => input.value.trim().length > 0);

function onInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function reset(): void {
  input.value = '';
}

/** Metadata grid rows derived from the parse result. */
interface MetaRow {
  label: string;
  value: string | null;
  icon: typeof Landmark;
}

const metaRows = computed<MetaRow[]>(() => {
  const r = result.value;
  if (!r) return [];
  return [
    { label: t(U + 'metaCountry'), value: r.country, icon: Landmark },
    { label: t(U + 'metaCountryName'), value: r.countryName, icon: Landmark },
    { label: t(U + 'metaBankCode'), value: r.bankCode, icon: Building2 },
    { label: t(U + 'metaBranchCode'), value: r.branchCode, icon: GitBranch },
    { label: t(U + 'metaAccountNumber'), value: r.accountNumber, icon: CreditCard },
    { label: t(U + 'metaNationalCheckDigits'), value: r.nationalCheckDigits, icon: Hash },
    { label: t(U + 'metaChecksum'), value: r.checksum, icon: ShieldCheck },
  ];
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-input-wrap">
        <textarea
          class="qt-input qt-input--mono"
          style="padding:10px 36px 10px 12px;min-height:44px"
          :placeholder="t(U + 'placeholder')"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          rows="2"
          @input="onInput"
        />
        <button
          v-if="hasInput"
          class="ivp__reset"
          :title="t(U + 'clearTitle')"
          @click="reset"
        >
          <RotateCcw :size="14" />
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="
        result
          ? (result.valid ? t(U + 'descValid') : t(U + 'descInvalid'))
          : t(U + 'descEmpty')
      "
      :copy-text="result?.valid ? result.formatted : ''"
      :copy-label="t(U + 'copyFormatted')"
    >
      <template v-if="!hasInput">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'descEmpty') }}</p>
      </template>
      <template v-else-if="result">
        <!-- Validity badge -->
        <div class="qt-row" style="--qt-row-gap:8px;margin-bottom:12px">
          <span
            class="qt-badge"
            :class="result.valid ? 'qt-badge--success' : 'qt-badge--error'"
          >
            <component
              :is="result.valid ? CheckCircle2 : AlertTriangle"
              :size="13"
            />
            <span>{{ result.valid ? t(U + 'valid') : t(U + 'invalid') }}</span>
          </span>
          <span v-if="result.country" class="qt-badge qt-badge--info">
            <Landmark :size="13" />
            <span>{{ result.country }}</span>
          </span>
        </div>

        <!-- Validation error -->
        <p v-if="!result.valid && result.error" class="qt-banner qt-banner--error" style="margin:0 0 12px">
          <AlertTriangle :size="13" />
          <span>{{ result.error }}</span>
        </p>

        <!-- Formatted IBAN -->
        <div v-if="result.iban" class="qt-stack" style="margin-bottom:12px">
          <div class="qt-result-row">
            <span class="qt-stat-head" style="min-width:80px;white-space:nowrap">{{ t(U + 'formatted') }}</span>
            <code class="qt-mono" style="font-size:14px;word-break:break-all;flex:1">{{ result.formatted || '-' }}</code>
            <CopyButton
              v-if="result.formatted"
              :text="result.formatted"
              icon-only
              style="flex-shrink:0"
            />
          </div>
          <div class="qt-result-row">
            <span class="qt-stat-head" style="min-width:80px;white-space:nowrap">{{ t(U + 'normalised') }}</span>
            <code class="qt-mono" style="font-size:14px;word-break:break-all;flex:1">{{ result.iban }}</code>
            <CopyButton
              v-if="result.iban"
              :text="result.iban"
              icon-only
              style="flex-shrink:0"
            />
          </div>
        </div>

        <!-- Breakdown grid -->
        <div v-if="result.country" class="ivp__grid">
          <div
            v-for="row in metaRows"
            :key="row.label"
            class="qt-result"
            style="min-width:0"
          >
            <span class="qt-stat-head">
              <component :is="row.icon" :size="12" />
              <span>{{ row.label }}</span>
            </span>
            <code class="qt-mono" style="font-size:13px;word-break:break-all">{{ row.value || '-' }}</code>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Top-right clear button inside the input wrap. */
.ivp__reset {
  position: absolute;
  top: 8px;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--qt-radius-sm);
  background: transparent;
  color: var(--qt-muted);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.ivp__reset:hover {
  color: var(--qt-text);
  background: var(--qt-border);
}

/* Fixed 2-col breakdown grid — collapses to stacked on narrow. */
.ivp__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 560px) {
  .ivp__grid {
    grid-template-columns: 1fr;
  }
}
</style>
