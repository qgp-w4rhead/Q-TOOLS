<script setup lang="ts">
/**
 * Bcrypt - hash and verify passwords with bcrypt.
 *
 * Hash mode: input password + cost factor (4-31) → output `$2a$XX$…` encoded
 * bcrypt hash. Salt is 16 random bytes from `crypto.getRandomValues()`.
 *
 * Verify mode: input password + encoded hash → match / no-match.
 *
 * Both operations use `hash-wasm` (`bcrypt` / `bcryptVerify`), lazy-loaded
 * into their own Vite chunk.
 *
 * Works in embed mode: receives `input` PostMessages to set mode/password/
 * hash/cost, and sends `output` PostMessages whenever the result changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, Check, Loader2, X } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useBcrypt,
  MIN_COST,
  MAX_COST,
  isValidBcryptHash,
} from './useBcrypt';

const { t, locale } = useI18n();

const {
  mode,
  password,
  cost,
  hash,
  result,
  computing,
  error,
  run,
  setMode,
} = useBcrypt();

/** Whether the verify-mode hash input is well-formed. */
const hashValid = computed(() => hash.value.length === 0 || isValidBcryptHash(hash.value));

/** Number of bcrypt iterations for the current cost factor (2^cost). */
const iterations = computed(() => Math.pow(2, cost.value));

/** Approximate time cost hint for the current cost factor. */
const costHint = computed(() => {
  const c = cost.value;
  if (c <= 8) return t('tools.bcrypt.ui.costFast');
  if (c <= 11) return t('tools.bcrypt.ui.costModerate');
  if (c <= 14) return t('tools.bcrypt.ui.costSlow');
  return t('tools.bcrypt.ui.costVerySlow');
});

/** Output text for the "copy" button - the encoded hash in hash mode. */
const outputCopyText = computed(() =>
  mode.value === 'hash' && result.value && result.value.mode === 'hash'
    ? result.value.hash
    : '',
);

function onPasswordInput(e: Event): void {
  password.value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
}

function onHashInput(e: Event): void {
  hash.value = (e.target as HTMLTextAreaElement).value;
}

function onCostInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(v)) cost.value = Math.max(MIN_COST, Math.min(MAX_COST, Math.floor(v)));
}
</script>

<template>
  <div class="qt-tool">
    <div class="qt-seg" role="tablist" :aria-label="t('tools.bcrypt.ui.modeLabel')">
      <button
        type="button"
        role="tab"
        class="qt-seg__btn"
        :class="{ 'qt-seg__btn--active': mode === 'hash' }"
        :aria-selected="mode === 'hash'"
        @click="setMode('hash')"
      >
        {{ t('tools.bcrypt.ui.hash') }}
      </button>
      <button
        type="button"
        role="tab"
        class="qt-seg__btn"
        :class="{ 'qt-seg__btn--active': mode === 'verify' }"
        :aria-selected="mode === 'verify'"
        @click="setMode('verify')"
      >
        {{ t('tools.bcrypt.ui.verify') }}
      </button>
    </div>

    <ToolInput
      :title="mode === 'hash' ? t('tools.bcrypt.ui.titleHash') : t('tools.bcrypt.ui.titleVerify')"
      :description="mode === 'hash'
        ? t('tools.bcrypt.ui.descHash', { cost, iterations: iterations.toLocaleString(locale), hint: costHint })
        : t('tools.bcrypt.ui.descVerify')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="computing || password.length === 0 || (mode === 'verify' && hash.length === 0)"
          @click="run"
        >
          <Loader2 v-if="computing" :size="14" class="qt-spin" />
          <span>{{ computing ? t('tools.bcrypt.ui.working') : (mode === 'hash' ? t('tools.bcrypt.ui.hash') : t('tools.bcrypt.ui.verify')) }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t('common.password') }}</span>
        <input
          class="qt-input qt-input--mono"
          type="text"
          :placeholder="t('tools.bcrypt.ui.passwordPlaceholder')"
          :value="password"
          spellcheck="false"
          autocomplete="off"
          @input="onPasswordInput"
        />
      </label>

      <div v-if="mode === 'hash'" class="qt-field">
        <div class="qt-row qt-row--center qt-row--between qt-row--nowrap">
          <span class="qt-label">{{ t('tools.bcrypt.ui.costFactor') }}</span>
          <span class="bcrypt__cost-val">{{ cost }}</span>
        </div>
        <input
          class="qt-range"
          type="range"
          :min="MIN_COST"
          :max="MAX_COST"
          step="1"
          :value="cost"
          @input="onCostInput"
        />
        <div class="bcrypt__cost-marks">
          <span>{{ MIN_COST }}</span>
          <span>{{ MAX_COST }}</span>
        </div>
      </div>

      <label v-else class="qt-field">
        <span class="qt-label">{{ t('tools.bcrypt.ui.hashLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono bcrypt__textarea"
          rows="2"
          :placeholder="t('tools.bcrypt.ui.hashPlaceholder')"
          :value="hash"
          :class="{ 'qt-input--error': !hashValid }"
          spellcheck="false"
          autocomplete="off"
          @input="onHashInput"
        />
        <span v-if="!hashValid" class="qt-hint qt-hint--error">
          {{ t('tools.bcrypt.ui.hashFormatHint') }}
        </span>
      </label>
    </ToolInput>

    <ToolOutput
      :title="mode === 'hash' ? t('tools.bcrypt.ui.outputHash') : t('tools.bcrypt.ui.outputVerify')"
      :description="mode === 'hash' && result && result.mode === 'hash'
        ? t('tools.bcrypt.ui.outputDesc', { chars: result.hash.length, cost: result.cost })
        : ''"
      :copy-text="outputCopyText"
      :copy-label="t('tools.bcrypt.ui.copyHash')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else-if="mode === 'hash'">
        <p v-if="!result || result.mode !== 'hash'" class="qt-alert qt-alert--empty">
          {{ t('tools.bcrypt.ui.emptyHash') }}
        </p>
        <div v-else class="qt-result-row">
          <code class="qt-mono bcrypt__hash">{{ result.hash }}</code>
          <CopyButton :text="result.hash" :label="t('common.copy')" icon-only />
        </div>
      </template>
      <template v-else>
        <p v-if="!result || result.mode !== 'verify'" class="qt-alert qt-alert--empty">
          {{ t('tools.bcrypt.ui.emptyVerify') }}
        </p>
        <div
          v-else
          class="qt-banner"
          :class="result.match ? 'qt-banner--success' : 'qt-banner--error'"
        >
          <component
            :is="result.match ? Check : X"
            :size="18"
          />
          <span>{{ result.match ? t('tools.bcrypt.ui.match') : t('tools.bcrypt.ui.noMatch') }}</span>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Cost-factor readout. */
.bcrypt__cost-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
/* Min/max marks under the range slider. */
.bcrypt__cost-marks {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
/* Hash textarea floor + break (control + mono via .qt-input--mono). */
.bcrypt__textarea {
  min-height: 56px;
  word-break: break-all;
}
/* Encoded hash (font via .qt-mono). */
.bcrypt__hash {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
