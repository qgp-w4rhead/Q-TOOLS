<script setup lang="ts">
/**
 * HashText — hash text with multiple algorithms.
 *
 * Supported: MD5, SHA-1, SHA-256, SHA-384, SHA-512, SHA3-256, SHA3-512, Blake3.
 * SHA-1/256/384/512 use the Web Crypto API; MD5, SHA3, and Blake3 use
 * `hash-wasm` (lazy-loaded into its own Vite chunk).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text and
 * selected algorithms, and sends `output` PostMessages whenever the computed
 * hashes change.
 */
import { computed } from 'vue';
import { AlertCircle, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useHashText,
  ALGORITHMS,
} from './useHashText';

const {
  text,
  algorithms,
  results,
  computing,
  error,
  recompute,
  toggleAlgorithm,
} = useHashText();

/** All hashes as `algorithm: hex` lines — used for the "copy all" button. */
const allHashesText = computed(() =>
  results.value.map((r) => `${r.algorithm}: ${r.hex}`).join('\n'),
);

/** Char count of the input (for the description line). */
const charCount = computed(() => text.value.length);

function onTextInput(e: Event): void {
  text.value = (e.target as HTMLTextAreaElement).value;
}

function onToggle(e: Event, algo: string): void {
  const checked = (e.target as HTMLInputElement).checked;
  const current = algorithms.value.includes(algo as never);
  if (checked && !current) toggleAlgorithm(algo as never);
  if (!checked && current) toggleAlgorithm(algo as never);
}
</script>

<template>
  <div class="hash-text">
    <ToolInput
      title="Input"
      description="Text to hash. SHA-1/256/384/512 use Web Crypto; MD5, SHA3, Blake3 use hash-wasm."
    >
      <template #actions>
        <button
          class="hash-text__btn"
          type="button"
          :disabled="computing || text.length === 0"
          @click="recompute"
        >
          <Loader2 v-if="computing" :size="14" class="hash-text__spin" />
          <span>{{ computing ? 'Hashing…' : 'Hash' }}</span>
        </button>
      </template>

      <textarea
        class="hash-text__textarea"
        rows="6"
        placeholder="Enter text to hash…"
        :value="text"
        spellcheck="false"
        autocomplete="off"
        @input="onTextInput"
      />

      <fieldset class="hash-text__fieldset">
        <legend class="hash-text__legend">Algorithms</legend>
        <div class="hash-text__checks">
          <label
            v-for="a in ALGORITHMS"
            :key="a.id"
            class="hash-text__check"
          >
            <input
              type="checkbox"
              :checked="algorithms.includes(a.id)"
              @change="onToggle($event, a.id)"
            />
            <span>{{ a.label }}</span>
          </label>
        </div>
      </fieldset>
    </ToolInput>

    <ToolOutput
      title="Hashes"
      :description="results.length ? `${results.length} digest${results.length === 1 ? '' : 's'} · ${charCount} input char${charCount === 1 ? '' : 's'}` : ''"
      :copy-text="allHashesText"
      copy-label="Copy all"
    >
      <p v-if="error" class="hash-text__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="results.length === 0" class="hash-text__empty">
        Enter text above to compute hashes.
      </p>
      <ul v-else class="hash-text__list">
        <li v-for="r in results" :key="r.algorithm" class="hash-text__row">
          <div class="hash-text__row-head">
            <span class="hash-text__algo">{{ r.label }}</span>
            <span class="hash-text__bits">{{ r.bits }} bits</span>
          </div>
          <div class="hash-text__row-body">
            <code class="hash-text__hex">{{ r.hex || '—' }}</code>
            <CopyButton :text="r.hex" label="Copy" icon-only />
          </div>
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.hash-text {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.hash-text__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 10px 12px;
  resize: vertical;
  min-height: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.hash-text__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.hash-text__fieldset {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  margin: 0;
}
.hash-text__legend {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  padding: 0 6px;
}
.hash-text__checks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 6px 12px;
}
.hash-text__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--qt-text);
  cursor: pointer;
}
.hash-text__check input[type='checkbox'] {
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.hash-text__btn {
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
.hash-text__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.hash-text__btn:active:not(:disabled) {
  transform: translateY(0);
}
.hash-text__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.hash-text__spin {
  animation: hash-text-spin 0.8s linear infinite;
}
@keyframes hash-text-spin {
  to {
    transform: rotate(360deg);
  }
}
.hash-text__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.hash-text__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.hash-text__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hash-text__row {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hash-text__row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.hash-text__algo {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
.hash-text__bits {
  font-size: 11.5px;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.hash-text__row-body {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hash-text__hex {
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
