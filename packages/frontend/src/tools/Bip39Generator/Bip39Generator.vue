<script setup lang="ts">
/**
 * Bip39Generator - generate BIP39 mnemonic phrases.
 *
 *   - Entropy strength selectable: 128 / 160 / 192 / 224 / 256 bits
 *     → 12 / 15 / 18 / 21 / 24 words.
 *   - Wordlist selectable across 8 languages (English is the default and is
 *     bundled with the main `@scure/bip39` lazy chunk; the others are loaded
 *     on demand).
 *   - Optional BIP39 passphrase ("25th word") → derives a 64-byte seed via
 *     PBKDF2-HMAC-SHA512 (2048 iterations, per BIP39). The seed is shown as
 *     hex only when a passphrase is supplied.
 *   - Copy mnemonic button (and per-word copy on click).
 *
 * All cryptography happens locally in the browser via `@scure/bip39` (which
 * uses `@noble/hashes`'s CSPRNG-backed `randomBytes`). No data leaves the
 * device.
 *
 * Works in embed mode: receives `input` PostMessages to set strength/wordlist/
 * passphrase and sends `output` PostMessages with `{ mnemonic, entropy, seed }`.
 */
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useBip39Generator,
  STRENGTHS,
  STRENGTH_TO_WORDS,
  WORDLISTS,
  WORDLIST_LABELS,
  type Strength,
  type WordlistId,
} from './useBip39Generator';

const { t } = useI18n();

const {
  strength,
  wordlist,
  passphrase,
  showPassphrase,
  mnemonic,
  mnemonicWords,
  entropyHex,
  seedHex,
  generating,
  error,
  generate,
} = useBip39Generator();

/** Strength cards with word-count hints (hint resolved via i18n). */
const STRENGTH_OPTIONS: {
  value: Strength;
  label: string;
  words: number;
}[] = STRENGTHS.map((s) => ({
  value: s,
  label: `${s}`,
  words: STRENGTH_TO_WORDS[s],
}));

/** Wordlist options derived from the constant table. */
const WORDLIST_OPTIONS: { value: WordlistId; label: string }[] = WORDLISTS.map(
  (id) => ({ value: id, label: WORDLIST_LABELS[id] }),
);

/** Whether the Generate button should be enabled. */
const canGenerate = computed(() => !generating.value);

/** Word count for the currently selected strength (for the output header). */
const wordCount = computed(() => STRENGTH_TO_WORDS[strength.value]);

/** Whether a seed should be displayed (only when a passphrase is set). */
const hasSeed = computed(() => passphrase.value.length > 0 && seedHex.value);

// Generate an initial mnemonic on mount so the output area is never empty.
onMounted(() => {
  if (mnemonic.value.length === 0 && canGenerate.value) void generate();
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.configuration')"
      :description="t('tools.bip39-generator.ui.desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="!canGenerate"
          @click="generate"
        >
          <Loader2 v-if="generating" :size="14" class="qt-spin" />
          <RefreshCw v-else :size="14" />
          <span>{{ generating ? t('common.generating') : t('common.generate') }}</span>
        </button>
      </template>

      <div class="qt-field">
        <span class="qt-label">{{ t('tools.bip39-generator.ui.strength') }}</span>
        <div
          class="bip39__strengths"
          role="radiogroup"
          :aria-label="t('tools.bip39-generator.ui.strengthLabel')"
        >
          <button
            v-for="opt in STRENGTH_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="strength === opt.value"
            class="bip39__strength"
            :class="{ 'bip39__strength--active': strength === opt.value }"
            :title="t('tools.bip39-generator.ui.strengthTitle', { bits: opt.value, words: t('tools.bip39-generator.ui.words', { n: opt.words }) })"
            @click="strength = opt.value"
          >
            <span class="bip39__strength-label">{{ opt.label }}</span>
            <span class="bip39__strength-hint">{{ t('tools.bip39-generator.ui.words', { n: opt.words }) }}</span>
          </button>
        </div>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t('tools.bip39-generator.ui.wordlist') }}</span>
        <select
          class="qt-input"
          :value="wordlist"
          @change="wordlist = ($event.target as HTMLSelectElement).value as WordlistId"
        >
          <option v-for="opt in WORDLIST_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label class="qt-field">
        <span class="qt-label">
          {{ t('tools.bip39-generator.ui.passphrase') }}
        </span>
        <div class="qt-input-wrap">
          <input
            class="qt-input"
            :type="showPassphrase ? 'text' : 'password'"
            spellcheck="false"
            autocomplete="off"
            :placeholder="t('tools.bip39-generator.ui.passphrasePlaceholder')"
            :value="passphrase"
            @input="passphrase = ($event.target as HTMLInputElement).value"
          />
          <button
            class="qt-input-btn"
            type="button"
            :title="showPassphrase ? t('tools.bip39-generator.ui.hidePassphrase') : t('tools.bip39-generator.ui.showPassphrase')"
            :aria-label="showPassphrase ? t('tools.bip39-generator.ui.hidePassphrase') : t('tools.bip39-generator.ui.showPassphrase')"
            @click="showPassphrase = !showPassphrase"
          >
            <EyeOff v-if="showPassphrase" :size="14" />
            <Eye v-else :size="14" />
          </button>
        </div>
      </label>
    </ToolInput>

    <ToolOutput
      :title="t('tools.bip39-generator.ui.outputTitle')"
      :description="mnemonic ? t('tools.bip39-generator.ui.outputDesc', { words: t('tools.bip39-generator.ui.words', { n: wordCount }), wordlist: WORDLIST_LABELS[wordlist] }) : ''"
      :copy-text="mnemonic"
      :copy-label="t('tools.bip39-generator.ui.copyMnemonic')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!mnemonic" class="qt-alert qt-alert--empty">
        {{ t('tools.bip39-generator.ui.empty') }}
      </p>
      <template v-else>
        <ol class="qt-list qt-grid" style="--qt-grid-min:180px; --qt-grid-gap:6px">
          <li v-for="(w, i) in mnemonicWords" :key="i" class="qt-result-row">
            <span class="bip39__word-idx">{{ i + 1 }}</span>
            <code class="qt-mono bip39__word-text">{{ w }}</code>
            <CopyButton :text="w" :label="t('tools.bip39-generator.ui.copyWord')" icon-only />
          </li>
        </ol>
        <details class="bip39__raw">
          <summary>{{ t('tools.bip39-generator.ui.rawMnemonic') }}</summary>
          <code class="qt-mono bip39__raw-text">{{ mnemonic }}</code>
        </details>

        <div class="qt-stack bip39__extra" style="--qt-stack-gap:6px">
          <div class="qt-result-row">
            <span class="bip39__extra-label">
              <KeyRound :size="12" />
              {{ t('tools.bip39-generator.ui.entropy') }}
            </span>
            <code class="qt-mono bip39__extra-value">{{ entropyHex }}</code>
            <CopyButton :text="entropyHex" :label="t('tools.bip39-generator.ui.copyEntropy')" icon-only />
          </div>
          <div v-if="hasSeed" class="qt-result-row">
            <span class="bip39__extra-label">
              <KeyRound :size="12" />
              {{ t('tools.bip39-generator.ui.seed') }}
            </span>
            <code class="qt-mono bip39__extra-value bip39__extra-value--break">{{ seedHex }}</code>
            <CopyButton :text="seedHex" :label="t('tools.bip39-generator.ui.copySeed')" icon-only />
          </div>
          <p v-else-if="mnemonic" class="bip39__seed-hint">
            <Copy :size="12" />
            {{ t('tools.bip39-generator.ui.seedHint') }}
          </p>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Strength picker — fixed 5-col grid of selectable cards. */
.bip39__strengths {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
@media (max-width: 640px) {
  .bip39__strengths {
    grid-template-columns: repeat(3, 1fr);
  }
}
.bip39__strength {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  padding: 8px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}
.bip39__strength:hover {
  border-color: var(--qt-accent);
  color: var(--qt-text);
}
.bip39__strength--active {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.15);
  color: var(--qt-accent);
}
.bip39__strength-label {
  font-size: 14px;
  font-weight: 700;
}
.bip39__strength-hint {
  font-size: 10.5px;
  opacity: 0.85;
}
/* Word index. */
.bip39__word-idx {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--qt-muted);
  min-width: 22px;
  text-align: right;
}
/* Word text (font via .qt-mono). */
.bip39__word-text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Raw-mnemonic disclosure. */
.bip39__raw {
  margin-top: 10px;
  font-size: 12.5px;
  color: var(--qt-muted);
}
.bip39__raw summary {
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
}
.bip39__raw-text {
  display: block;
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Entropy/seed extra rows. */
.bip39__extra {
  margin-top: 10px;
}
.bip39__extra-label {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.bip39__extra-value {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.bip39__extra-value--break {
  font-size: 11px;
}
/* Seed hint line. */
.bip39__seed-hint {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--qt-muted);
}
</style>
