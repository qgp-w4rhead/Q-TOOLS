<script setup lang="ts">
/**
 * NumeronymGenerator — convert words or phrases into numeronyms.
 *
 * A numeronym keeps the first and last letters of a word and replaces the
 * middle with the count of omitted letters (e.g. "internationalization" →
 * "i18n"). Words shorter than the configurable minimum length are left
 * verbatim; non-word separators (whitespace, punctuation) are preserved. An
 * optional toggle controls whether the first/last letters keep their original
 * case.
 *
 * Works in embed mode: receives `input` PostMessages to set the text and
 * options, and sends `output` PostMessages with the generated numeronym and
 * per-word breakdown.
 */
import { ref } from 'vue';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useNumeronymGenerator,
  MIN_LENGTH_FLOOR,
  MIN_LENGTH_CEIL,
} from './useNumeronymGenerator';

const { input, minLength, preserveCase, output, tokens, reset } =
  useNumeronymGenerator();

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

function onMinLength(e: Event): void {
  minLength.value = Number((e.target as HTMLInputElement).value);
}

function onPreserveCase(e: Event): void {
  preserveCase.value = (e.target as HTMLInputElement).checked;
}

function onReset(): void {
  if (timer) clearTimeout(timer);
  reset();
  draft.value = '';
}

function onSwap(): void {
  if (timer) clearTimeout(timer);
  draft.value = output.value;
  input.value = output.value;
}

const abbreviatedCount = () => tokens.value.filter((t) => t.abbreviated).length;
const summary = () =>
  `${abbreviatedCount()} of ${tokens.value.length} words abbreviated`;
</script>

<template>
  <div class="ng">
    <ToolInput
      title="Input"
      description="Type a word or phrase. Numeronyms generate live."
    >
      <template #actions>
        <button
          type="button"
          class="ng__btn ng__btn--ghost"
          title="Clear input"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>Clear</span>
        </button>
      </template>

      <textarea
        class="ng__input"
        spellcheck="false"
        placeholder="e.g. internationalization accessibility localization…"
        :value="draft"
        @input="onInput"
        aria-label="Word or phrase to abbreviate"
      ></textarea>

      <div class="ng__options">
        <label class="ng__field">
          <span class="ng__label">Min. word length</span>
          <input
            type="number"
            class="ng__input-num"
            :min="MIN_LENGTH_FLOOR"
            :max="MIN_LENGTH_CEIL"
            :value="minLength"
            @input="onMinLength"
          />
        </label>
        <label class="ng__field ng__field--check">
          <input
            type="checkbox"
            class="ng__checkbox"
            :checked="preserveCase"
            @change="onPreserveCase"
          />
          <span class="ng__label">Preserve case</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Numeronym"
      :description="summary()"
    >
      <template #actions>
        <button
          type="button"
          class="ng__btn ng__btn--ghost"
          title="Feed output back into input"
          :disabled="output.length === 0"
          @click="onSwap"
        >
          <span>Use as input</span>
        </button>
      </template>

      <div class="ng__output-wrap">
        <textarea
          class="ng__output"
          readonly
          spellcheck="false"
          :value="output"
          aria-label="Generated numeronym"
        ></textarea>
        <CopyButton
          :text="output"
          label="Copy"
          class="ng__copy"
        />
      </div>

      <div v-if="tokens.length > 0" class="ng__breakdown">
        <div class="ng__breakdown-title">Per-word breakdown</div>
        <table class="ng__table">
          <thead>
            <tr>
              <th scope="col">Original</th>
              <th scope="col">Numeronym</th>
              <th scope="col" class="ng__num">Length</th>
              <th scope="col" class="ng__num">Omitted</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="token in tokens"
              :key="token.original"
              :class="{ 'ng__row--skip': !token.abbreviated }"
            >
              <td class="ng__mono">{{ token.original }}</td>
              <td class="ng__mono ng__mono--out">{{ token.numeronym }}</td>
              <td class="ng__num">{{ token.length }}</td>
              <td class="ng__num">
                {{ token.abbreviated ? token.omitted : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ng {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.ng__input {
  width: 100%;
  min-height: 120px;
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
.ng__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ng__options {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  margin-top: 12px;
}
.ng__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ng__field--check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.ng__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ng__input-num {
  width: 90px;
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
}
.ng__input-num:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ng__checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.ng__btn {
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
.ng__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.ng__btn--ghost:hover:not(:disabled) {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.ng__btn--ghost:active:not(:disabled) {
  transform: translateY(1px);
}
.ng__btn--ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ng__output-wrap {
  position: relative;
}
.ng__output {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  line-height: 1.6;
  padding: 12px 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.ng__output:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ng__copy {
  position: absolute;
  top: 8px;
  right: 8px;
}
.ng__breakdown {
  margin-top: 16px;
}
.ng__breakdown-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}
.ng__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
.ng__table th,
.ng__table td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--qt-border);
}
.ng__table th {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ng__table tbody tr:last-child td {
  border-bottom: none;
}
.ng__row--skip {
  opacity: 0.55;
}
.ng__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ng__mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.ng__mono--out {
  color: var(--qt-accent);
  font-weight: 600;
}
</style>
