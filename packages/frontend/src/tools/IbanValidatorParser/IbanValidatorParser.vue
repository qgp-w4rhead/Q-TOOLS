<script setup lang="ts">
/**
 * IbanValidatorParser — validate and parse an IBAN account number.
 *
 * Validates the IBAN structure (country code, length, character classes) and
 * the mod-97 checksum, then breaks it down into country, bank code, branch
 * code, account number, national check digits, and the IBAN check digits.
 * The formatted IBAN (4-char groups) is also displayed.
 *
 * No external dependencies — the country spec table and mod-97 algorithm are
 * hand-rolled.
 *
 * Works in embed mode: receives `iban`/`input`/`value`/`account`/`text`/
 * `content` PostMessages to pre-fill the field; sends `output` PostMessages
 * with `{ iban, formatted, valid, country, countryName, checksum, bankCode,
 * branchCode, accountNumber, nationalCheckDigits, error }` whenever the
 * result changes.
 */
import { computed } from 'vue';
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
    { label: 'Country', value: r.country, icon: Landmark },
    { label: 'Country name', value: r.countryName, icon: Landmark },
    { label: 'Bank code', value: r.bankCode, icon: Building2 },
    { label: 'Branch code', value: r.branchCode, icon: GitBranch },
    { label: 'Account number', value: r.accountNumber, icon: CreditCard },
    { label: 'National check digits', value: r.nationalCheckDigits, icon: Hash },
    { label: 'IBAN check digits', value: r.checksum, icon: ShieldCheck },
  ];
});
</script>

<template>
  <div class="ivp">
    <ToolInput
      title="IBAN"
      description="Enter an IBAN to validate and parse. Spaces, dashes, and dots are ignored. The IBAN is checked against its country-specific structure and the mod-97 checksum."
    >
      <div class="ivp__field">
        <textarea
          class="ivp__textarea"
          placeholder="GB82 WEST 1234 5698 7654 32"
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
          title="Clear input"
          @click="reset"
        >
          <RotateCcw :size="14" />
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      title="Validation result"
      :description="
        result
          ? result.valid
            ? 'The IBAN is valid.'
            : 'The IBAN is invalid.'
          : 'Enter an IBAN above to validate and parse it.'
      "
      :copy-text="result?.valid ? result.formatted : ''"
      copy-label="Copy formatted"
    >
      <template v-if="!hasInput">
        <p class="ivp__empty">Enter an IBAN above to validate and parse it.</p>
      </template>
      <template v-else-if="result">
        <!-- Validity badge -->
        <div class="ivp__badges">
          <span
            class="ivp__badge"
            :class="result.valid ? 'ivp__badge--ok' : 'ivp__badge--bad'"
          >
            <component
              :is="result.valid ? CheckCircle2 : AlertTriangle"
              :size="13"
            />
            <span>{{ result.valid ? 'Valid' : 'Invalid' }}</span>
          </span>
          <span v-if="result.country" class="ivp__badge ivp__badge--info">
            <Landmark :size="13" />
            <span>{{ result.country }}</span>
          </span>
        </div>

        <!-- Validation error -->
        <p v-if="!result.valid && result.error" class="ivp__error">
          <AlertTriangle :size="13" />
          <span>{{ result.error }}</span>
        </p>

        <!-- Formatted IBAN -->
        <div v-if="result.iban" class="ivp__formatted">
          <div class="ivp__formatted-row">
            <span class="ivp__formatted-label">Formatted</span>
            <code class="ivp__formatted-value">{{ result.formatted || '—' }}</code>
            <CopyButton
              v-if="result.formatted"
              :text="result.formatted"
              icon-only
              class="ivp__formatted-copy"
            />
          </div>
          <div class="ivp__formatted-row">
            <span class="ivp__formatted-label">Normalised</span>
            <code class="ivp__formatted-value">{{ result.iban }}</code>
            <CopyButton
              v-if="result.iban"
              :text="result.iban"
              icon-only
              class="ivp__formatted-copy"
            />
          </div>
        </div>

        <!-- Breakdown grid -->
        <div v-if="result.country" class="ivp__grid">
          <div
            v-for="row in metaRows"
            :key="row.label"
            class="ivp__cell"
          >
            <span class="ivp__cell-label">
              <component :is="row.icon" :size="12" />
              <span>{{ row.label }}</span>
            </span>
            <code class="ivp__cell-value">{{ row.value || '—' }}</code>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ivp {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ivp__field {
  position: relative;
}
.ivp__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 10px 36px 10px 12px;
  resize: vertical;
  min-height: 44px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.ivp__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
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
.ivp__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.ivp__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.ivp__badge {
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
.ivp__badge--ok {
  background: oklch(from var(--qt-success) 35% c h / 0.2);
  border-color: oklch(from var(--qt-success) 60% c h / 0.55);
  color: var(--qt-success);
}
.ivp__badge--bad {
  background: oklch(from var(--qt-danger) 35% c h / 0.2);
  border-color: oklch(from var(--qt-danger) 60% c h / 0.55);
  color: var(--qt-danger);
}
.ivp__badge--info {
  background: oklch(from var(--qt-accent) 35% c h / 0.18);
  border-color: oklch(from var(--qt-accent) 60% c h / 0.5);
  color: var(--qt-accent);
}
.ivp__error {
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
.ivp__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}
.ivp__formatted {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.ivp__formatted-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.ivp__formatted-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
  white-space: nowrap;
  min-width: 80px;
}
.ivp__formatted-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  flex: 1;
}
.ivp__formatted-copy {
  flex-shrink: 0;
}
.ivp__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.ivp__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  min-width: 0;
}
.ivp__cell-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.ivp__cell-label svg {
  flex-shrink: 0;
}
.ivp__cell-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
}
@media (max-width: 560px) {
  .ivp__grid {
    grid-template-columns: 1fr;
  }
}
</style>
