<script setup lang="ts">
/**
 * Bip39Generator — generate BIP39 mnemonic phrases.
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

/** Strength cards with word-count hints. */
const STRENGTH_OPTIONS: {
  value: Strength;
  label: string;
  hint: string;
}[] = STRENGTHS.map((s) => ({
  value: s,
  label: `${s}`,
  hint: `${STRENGTH_TO_WORDS[s]} words`,
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
  <div class="bip39">
    <ToolInput
      title="Configuration"
      description="BIP39 mnemonic phrases encode 128-256 bits of entropy as 12-24 human-readable words. Used as a human-friendly backup for HD wallet seeds."
    >
      <template #actions>
        <button
          class="bip39__generate"
          type="button"
          :disabled="!canGenerate"
          @click="generate"
        >
          <Loader2 v-if="generating" :size="14" class="bip39__spin" />
          <RefreshCw v-else :size="14" />
          <span>{{ generating ? 'Generating…' : 'Generate' }}</span>
        </button>
      </template>

      <div class="bip39__field">
        <span class="bip39__label">Entropy strength</span>
        <div
          class="bip39__strengths"
          role="radiogroup"
          aria-label="Entropy strength"
        >
          <button
            v-for="opt in STRENGTH_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="strength === opt.value"
            class="bip39__strength"
            :class="{ 'bip39__strength--active': strength === opt.value }"
            :title="`${opt.value} bits → ${opt.hint}`"
            @click="strength = opt.value"
          >
            <span class="bip39__strength-label">{{ opt.label }}</span>
            <span class="bip39__strength-hint">{{ opt.hint }}</span>
          </button>
        </div>
      </div>

      <label class="bip39__field">
        <span class="bip39__label">Wordlist</span>
        <select
          class="bip39__select"
          :value="wordlist"
          @change="wordlist = ($event.target as HTMLSelectElement).value as WordlistId"
        >
          <option v-for="opt in WORDLIST_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label class="bip39__field">
        <span class="bip39__label">
          Passphrase (optional — the BIP39 “25th word”)
        </span>
        <div class="bip39__passphrase">
          <input
            class="bip39__input"
            :type="showPassphrase ? 'text' : 'password'"
            spellcheck="false"
            autocomplete="off"
            placeholder="Empty = no passphrase (standard derivation)"
            :value="passphrase"
            @input="passphrase = ($event.target as HTMLInputElement).value"
          />
          <button
            class="bip39__peek"
            type="button"
            :title="showPassphrase ? 'Hide passphrase' : 'Show passphrase'"
            :aria-label="showPassphrase ? 'Hide passphrase' : 'Show passphrase'"
            @click="showPassphrase = !showPassphrase"
          >
            <EyeOff v-if="showPassphrase" :size="14" />
            <Eye v-else :size="14" />
          </button>
        </div>
      </label>
    </ToolInput>

    <ToolOutput
      title="Mnemonic phrase"
      :description="mnemonic ? `${wordCount} words • ${WORDLIST_LABELS[wordlist]}` : ''"
      :copy-text="mnemonic"
      copy-label="Copy mnemonic"
    >
      <p v-if="error" class="bip39__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!mnemonic" class="bip39__empty">
        No mnemonic yet — click <strong>Generate</strong>.
      </p>
      <template v-else>
        <ol class="bip39__words">
          <li v-for="(w, i) in mnemonicWords" :key="i" class="bip39__word">
            <span class="bip39__word-idx">{{ i + 1 }}</span>
            <code class="bip39__word-text">{{ w }}</code>
            <CopyButton :text="w" label="Copy word" icon-only />
          </li>
        </ol>
        <details class="bip39__raw">
          <summary>Raw mnemonic string</summary>
          <code class="bip39__raw-text">{{ mnemonic }}</code>
        </details>

        <div class="bip39__extra">
          <div class="bip39__extra-row">
            <span class="bip39__extra-label">
              <KeyRound :size="12" />
              Entropy (hex)
            </span>
            <code class="bip39__extra-value">{{ entropyHex }}</code>
            <CopyButton :text="entropyHex" label="Copy entropy" icon-only />
          </div>
          <div v-if="hasSeed" class="bip39__extra-row">
            <span class="bip39__extra-label">
              <KeyRound :size="12" />
              Seed (hex, 64 bytes)
            </span>
            <code class="bip39__extra-value bip39__extra-value--break">{{ seedHex }}</code>
            <CopyButton :text="seedHex" label="Copy seed" icon-only />
          </div>
          <p v-else-if="mnemonic" class="bip39__seed-hint">
            <Copy :size="12" />
            Enter a passphrase above to derive a BIP39 seed (PBKDF2-HMAC-SHA512,
            2048 iterations).
          </p>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.bip39 {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.bip39__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bip39__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bip39__input,
.bip39__select {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 9px 11px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.bip39__input:focus,
.bip39__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.bip39__passphrase {
  position: relative;
  display: flex;
  align-items: stretch;
}
.bip39__passphrase .bip39__input {
  padding-right: 38px;
}
.bip39__peek {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--qt-muted);
  cursor: pointer;
  transition: color 0.15s ease;
}
.bip39__peek:hover {
  color: var(--qt-text);
}
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
  will-change: border-color;
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
.bip39__generate {
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
.bip39__generate:hover:not(:disabled) {
  transform: translateY(-1px);
}
.bip39__generate:active:not(:disabled) {
  transform: translateY(0);
}
.bip39__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bip39__spin {
  animation: bip39-spin 0.8s linear infinite;
}
@keyframes bip39-spin {
  to {
    transform: rotate(360deg);
  }
}
.bip39__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.bip39__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.bip39__words {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px;
  counter-reset: bip39-word;
}
.bip39__word {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 6px 9px;
}
.bip39__word-idx {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--qt-muted);
  min-width: 22px;
  text-align: right;
}
.bip39__word-text {
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
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
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.bip39__extra {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bip39__extra-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 6px 9px;
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
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.bip39__extra-value--break {
  font-size: 11px;
}
.bip39__seed-hint {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--qt-muted);
}
</style>
