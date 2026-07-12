<script setup lang="ts">
/**
 * TokenGenerator — generate cryptographically secure random tokens.
 *
 * Configurable length (1-512), charset (lowercase/uppercase/numbers/symbols or
 * a custom string), and quantity (1-1000). Randomness comes from
 * `crypto.getRandomValues()` with rejection sampling (no modulo bias).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the config and
 * sends `output` PostMessages whenever the generated tokens change.
 */
import { computed, onMounted } from 'vue';
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

const {
  config,
  tokens,
  error,
  charset,
  isValid,
  regenerate,
} = useTokenGenerator();

/** All tokens joined by newlines — used for the "copy all" button. */
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
  <div class="token-gen">
    <ToolInput
      title="Configuration"
      description="Cryptographically secure random tokens (Web Crypto API)."
    >
      <template #actions>
        <button
          class="token-gen__generate"
          type="button"
          :disabled="!hasCharsetSelected"
          @click="regenerate"
        >
          <RefreshCw :size="14" />
          <span>Generate</span>
        </button>
      </template>

      <div class="token-gen__row">
        <label class="token-gen__field">
          <span class="token-gen__label">Length</span>
          <input
            class="token-gen__input"
            type="number"
            :min="MIN_LENGTH"
            :max="MAX_LENGTH"
            :value="config.length"
            @input="onLengthInput"
          />
        </label>
        <label class="token-gen__field">
          <span class="token-gen__label">Quantity</span>
          <input
            class="token-gen__input"
            type="number"
            :min="MIN_QUANTITY"
            :max="MAX_QUANTITY"
            :value="config.quantity"
            @input="onQuantityInput"
          />
        </label>
      </div>

      <div class="token-gen__range-row">
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
        <legend class="token-gen__legend">Charset</legend>
        <div class="token-gen__checks">
          <label class="token-gen__check">
            <input
              type="checkbox"
              :checked="config.lowercase"
              :disabled="config.useCustom"
              @change="config.lowercase = ($event.target as HTMLInputElement).checked"
            />
            <span>lowercase (a-z)</span>
          </label>
          <label class="token-gen__check">
            <input
              type="checkbox"
              :checked="config.uppercase"
              :disabled="config.useCustom"
              @change="config.uppercase = ($event.target as HTMLInputElement).checked"
            />
            <span>UPPERCASE (A-Z)</span>
          </label>
          <label class="token-gen__check">
            <input
              type="checkbox"
              :checked="config.numbers"
              :disabled="config.useCustom"
              @change="config.numbers = ($event.target as HTMLInputElement).checked"
            />
            <span>Numbers (0-9)</span>
          </label>
          <label class="token-gen__check">
            <input
              type="checkbox"
              :checked="config.symbols"
              :disabled="config.useCustom"
              @change="config.symbols = ($event.target as HTMLInputElement).checked"
            />
            <span>Symbols</span>
          </label>
          <label class="token-gen__check">
            <input
              type="checkbox"
              :checked="config.excludeAmbiguous"
              :disabled="config.useCustom"
              @change="config.excludeAmbiguous = ($event.target as HTMLInputElement).checked"
            />
            <span>Exclude ambiguous (l 1 I 0 O o)</span>
          </label>
        </div>

        <label class="token-gen__check token-gen__check--custom">
          <input
            type="checkbox"
            :checked="config.useCustom"
            @change="config.useCustom = ($event.target as HTMLInputElement).checked"
          />
          <span>Custom charset</span>
        </label>
        <input
          v-if="config.useCustom"
          class="token-gen__input token-gen__input--mono"
          type="text"
          placeholder="Enter custom characters, e.g. abc123!@#"
          :value="config.customCharset"
          @input="onCustomCharsetInput"
        />
      </fieldset>

      <p class="token-gen__charset-preview">
        <span class="token-gen__charset-label">Effective charset</span>
        <code class="token-gen__charset-value">{{ charset || '—' }}</code>
        <span class="token-gen__charset-count">{{ charset.length }} chars</span>
      </p>
    </ToolInput>

    <ToolOutput
      title="Generated tokens"
      :description="tokens.length ? `${tokens.length} token${tokens.length === 1 ? '' : 's'} of ${config.length} characters` : ''"
      :copy-text="allTokensText"
      copy-label="Copy all"
    >
      <p v-if="error" class="token-gen__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="tokens.length === 0" class="token-gen__empty">
        No tokens yet — click <strong>Generate</strong>.
      </p>
      <ul v-else class="token-gen__list">
        <li v-for="(t, i) in tokens" :key="i" class="token-gen__token">
          <code class="token-gen__token-text">{{ t }}</code>
          <CopyButton :text="t" label="Copy" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.token-gen {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.token-gen__row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.token-gen__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 120px;
}
.token-gen__label {
  font-size: 12.5px;
  color: var(--qt-muted);
  font-weight: 600;
}
.token-gen__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.token-gen__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.token-gen__input--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.token-gen__range-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
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
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  padding: 0 6px;
}
.token-gen__checks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px 12px;
}
.token-gen__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--qt-text);
  cursor: pointer;
}
.token-gen__check input[type='checkbox'] {
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.token-gen__check input:disabled + span {
  color: var(--qt-muted);
  opacity: 0.6;
}
.token-gen__check--custom {
  margin-top: 4px;
  font-weight: 600;
}
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
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
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
.token-gen__generate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.token-gen__generate:hover:not(:disabled) {
  transform: translateY(-1px);
}
.token-gen__generate:active:not(:disabled) {
  transform: translateY(0);
}
.token-gen__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.token-gen__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.token-gen__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.token-gen__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.token-gen__token {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
}
.token-gen__token-text {
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
