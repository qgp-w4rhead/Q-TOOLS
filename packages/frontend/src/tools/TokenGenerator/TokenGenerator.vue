<script setup lang="ts">
/**
 * TokenGenerator - generate cryptographically secure random tokens.
 *
 * Configurable length (1-512), charset (lowercase/uppercase/numbers/symbols or
 * a custom string), and quantity (1-1000). Randomness comes from
 * `crypto.getRandomValues()` with rejection sampling (no modulo bias).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the config and
 * sends `output` PostMessages whenever the generated tokens change.
 */
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw, AlertCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useTokenGenerator,
  MIN_LENGTH,
  MAX_LENGTH,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useTokenGenerator';

const { t } = useI18n();

const {
  config,
  tokens,
  error,
  charset,
  isValid,
  regenerate,
} = useTokenGenerator();

/** All tokens joined by newlines - used for the "copy all" button. */
const allTokensText = computed(() => tokens.value.join('\n'));

/** True when at least one preset flag is on (or custom mode is active). */
const hasCharsetSelected = computed(
  () =>
    config.value.useCustom ||
    config.value.lowercase ||
    config.value.uppercase ||
    config.value.numbers ||
    config.value.symbols,
);

function onLengthInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  config.value.length = Number.isNaN(v) ? MIN_LENGTH : v;
}

function onQuantityInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  config.value.quantity = Number.isNaN(v) ? MIN_QUANTITY : v;
}

function onCustomCharsetInput(e: Event): void {
  config.value.customCharset = (e.target as HTMLInputElement).value;
}

// Generate an initial token on mount so the output area is never empty.
onMounted(() => {
  if (tokens.value.length === 0 && isValid.value) regenerate();
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.configuration')"
      :description="t('tools.token-generator.ui.desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="!hasCharsetSelected"
          @click="regenerate"
        >
          <RefreshCw :size="14" />
          <span>{{ t('common.generate') }}</span>
        </button>
      </template>

      <div class="qt-row">
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t('tools.token-generator.ui.length') }}</span>
          <input
            class="qt-input"
            type="number"
            :min="MIN_LENGTH"
            :max="MAX_LENGTH"
            :value="config.length"
            @input="onLengthInput"
          />
        </label>
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t('common.quantity') }}</span>
          <input
            class="qt-input"
            type="number"
            :min="MIN_QUANTITY"
            :max="MAX_QUANTITY"
            :value="config.quantity"
            @input="onQuantityInput"
          />
        </label>
      </div>

      <div class="qt-row qt-row--center qt-row--nowrap">
        <input
          class="token-gen__range"
          type="range"
          :min="MIN_LENGTH"
          :max="MAX_LENGTH"
          step="1"
          :value="config.length"
          @input="onLengthInput"
        />
        <span class="token-gen__range-value">{{ config.length }}</span>
      </div>

      <fieldset class="token-gen__fieldset">
        <legend class="qt-label token-gen__legend">{{ t('tools.token-generator.ui.charset') }}</legend>
        <div class="qt-grid" style="--qt-grid-min:180px; --qt-grid-gap:6px 12px">
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.lowercase"
              :disabled="config.useCustom"
              @change="config.lowercase = ($event.target as HTMLInputElement).checked"
            />
            <span>{{ t('tools.token-generator.ui.lowercase') }}</span>
          </label>
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.uppercase"
              :disabled="config.useCustom"
              @change="config.uppercase = ($event.target as HTMLInputElement).checked"
            />
            <span>{{ t('tools.token-generator.ui.uppercaseOpt') }}</span>
          </label>
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.numbers"
              :disabled="config.useCustom"
              @change="config.numbers = ($event.target as HTMLInputElement).checked"
            />
            <span>{{ t('tools.token-generator.ui.numbers') }}</span>
          </label>
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.symbols"
              :disabled="config.useCustom"
              @change="config.symbols = ($event.target as HTMLInputElement).checked"
            />
            <span>{{ t('tools.token-generator.ui.symbols') }}</span>
          </label>
          <label class="qt-check">
            <input
              type="checkbox"
              :checked="config.excludeAmbiguous"
              :disabled="config.useCustom"
              @change="config.excludeAmbiguous = ($event.target as HTMLInputElement).checked"
            />
            <span>{{ t('tools.token-generator.ui.excludeAmbiguous') }}</span>
          </label>
        </div>

        <label class="qt-check token-gen__check--custom">
          <input
            type="checkbox"
            :checked="config.useCustom"
            @change="config.useCustom = ($event.target as HTMLInputElement).checked"
          />
          <span>{{ t('tools.token-generator.ui.customCharset') }}</span>
        </label>
        <input
          v-if="config.useCustom"
          class="qt-input qt-input--mono"
          type="text"
          :placeholder="t('tools.token-generator.ui.customPlaceholder')"
          :value="config.customCharset"
          @input="onCustomCharsetInput"
        />
      </fieldset>

      <p class="token-gen__charset-preview">
        <span class="token-gen__charset-label">{{ t('tools.token-generator.ui.effectiveCharset') }}</span>
        <code class="qt-mono token-gen__charset-value">{{ charset || '-' }}</code>
        <span class="token-gen__charset-count">{{ t('common.chars', { n: charset.length }) }}</span>
      </p>
    </ToolInput>

    <ToolOutput
      :title="t('tools.token-generator.ui.outputTitle')"
      :description="tokens.length ? t('tools.token-generator.ui.outputDesc', { n: tokens.length, len: config.length }, tokens.length) : ''"
      :copy-text="allTokensText"
      :copy-label="t('common.copyAll')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="tokens.length === 0" class="qt-alert qt-alert--empty">
        {{ t('tools.token-generator.ui.empty') }}
      </p>
      <ul v-else class="qt-list qt-stack" style="--qt-stack-gap:6px">
        <li v-for="(token, i) in tokens" :key="i" class="qt-result-row">
          <code class="qt-mono token-gen__token-text">{{ token }}</code>
          <CopyButton :text="token" :label="t('common.copy')" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Range slider + readout. */
.token-gen__range {
  flex: 1 1 auto;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.token-gen__range-value {
  font-size: 13px;
  color: var(--qt-muted);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* Bordered checkbox group. */
.token-gen__fieldset {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.token-gen__legend {
  padding: 0 6px;
}
/* "Custom charset" check — emphasized + spaced. */
.token-gen__check--custom {
  margin-top: 4px;
  font-weight: 600;
}
/* Effective-charset preview line. */
.token-gen__charset-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.token-gen__charset-label {
  font-weight: 600;
}
.token-gen__charset-value {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 4px 8px;
  color: var(--qt-text);
  word-break: break-all;
  max-width: 100%;
}
.token-gen__charset-count {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
/* Token text (font via .qt-mono). */
.token-gen__token-text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
