<script setup lang="ts">
/**
 * StringObfuscator — obfuscate text to deter casual reading.
 *
 * Two modes:
 *  - Obfuscate: replace ASCII characters with Unicode lookalike homoglyphs
 *    and/or insert zero-width characters between visible characters.
 *  - Deobfuscate: strip zero-width characters and reverse homoglyph
 *    substitution back to ASCII.
 *
 * Obfuscation options:
 *  - Method: homoglyph / zero-width / mixed
 *  - Intensity: low / medium / high (substitution rate + ZW char count)
 *
 * Works in embed mode: receives `input` PostMessages to set the text and
 * options, sends `output` PostMessages with the result.
 */
import { ref } from 'vue';
import { ArrowDownUp, RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useStringObfuscator,
  type ObfuscationMethod,
  type Intensity,
  type ObfuscatorMode,
} from './useStringObfuscator';

const {
  input,
  output,
  mode,
  method,
  intensity,
  swap,
  reset,
} = useStringObfuscator();

// Debounce the recompute so typing stays responsive.
const draft = ref<string>(input.value);
let timer: ReturnType<typeof setTimeout> | null = null;

function onInput(e: Event): void {
  draft.value = (e.target as HTMLTextAreaElement).value;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    input.value = draft.value;
  }, 150);
}

function onSwap(): void {
  if (timer) clearTimeout(timer);
  swap();
  draft.value = input.value;
}

function onReset(): void {
  if (timer) clearTimeout(timer);
  reset();
  draft.value = '';
}

const modes: { value: ObfuscatorMode; label: string }[] = [
  { value: 'obfuscate', label: 'Obfuscate' },
  { value: 'deobfuscate', label: 'Deobfuscate' },
];

const methods: { value: ObfuscationMethod; label: string; hint: string }[] = [
  { value: 'homoglyph', label: 'Homoglyph', hint: 'Lookalike Unicode chars' },
  { value: 'zero-width', label: 'Zero-width', hint: 'Invisible chars between letters' },
  { value: 'mixed', label: 'Mixed', hint: 'Both combined' },
];

const intensities: { value: Intensity; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function setMode(m: ObfuscatorMode): void {
  mode.value = m;
}
function setMethod(m: ObfuscationMethod): void {
  method.value = m;
}
function setIntensity(i: Intensity): void {
  intensity.value = i;
}

const inputLabel = () => (mode.value === 'deobfuscate' ? 'Obfuscated text' : 'Plain text');
const outputLabel = () => (mode.value === 'deobfuscate' ? 'Deobfuscated text' : 'Obfuscated text');
</script>

<template>
  <div class="so">
    <ToolInput
      title="Options"
      :description="mode === 'deobfuscate'
        ? 'Strip zero-width characters and reverse homoglyph substitution.'
        : 'Replace characters with lookalike Unicode and/or insert zero-width chars.'"
    >
      <template #actions>
        <button
          type="button"
          class="so__btn so__btn--ghost"
          title="Reset to defaults"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>Reset</span>
        </button>
      </template>

      <div class="so__row">
        <div class="so__seg">
          <button
            v-for="m in modes"
            :key="m.value"
            type="button"
            class="so__seg-btn"
            :class="{ 'so__seg-btn--active': mode === m.value }"
            @click="setMode(m.value)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <div v-if="mode === 'obfuscate'" class="so__row so__row--options">
        <div class="so__opt">
          <span class="so__opt-label">Method</span>
          <div class="so__chips">
            <button
              v-for="m in methods"
              :key="m.value"
              type="button"
              class="so__chip"
              :class="{ 'so__chip--active': method === m.value }"
              :title="m.hint"
              @click="setMethod(m.value)"
            >
              {{ m.label }}
            </button>
          </div>
        </div>
        <div class="so__opt">
          <span class="so__opt-label">Intensity</span>
          <div class="so__chips">
            <button
              v-for="i in intensities"
              :key="i.value"
              type="button"
              class="so__chip"
              :class="{ 'so__chip--active': intensity === i.value }"
              @click="setIntensity(i.value)"
            >
              {{ i.label }}
            </button>
          </div>
        </div>
      </div>
    </ToolInput>

    <div class="so__panes">
      <div class="so__pane">
        <div class="so__pane-head">
          <span class="so__pane-title">{{ inputLabel() }}</span>
        </div>
        <textarea
          class="so__textarea"
          spellcheck="false"
          placeholder="Type or paste text…"
          :value="draft"
          @input="onInput"
          :aria-label="inputLabel()"
        ></textarea>
      </div>

      <button
        type="button"
        class="so__swap"
        title="Feed output back into input"
        :disabled="output.length === 0"
        @click="onSwap"
      >
        <ArrowDownUp :size="16" />
      </button>

      <div class="so__pane">
        <div class="so__pane-head">
          <span class="so__pane-title">{{ outputLabel() }}</span>
          <CopyButton
            :text="output"
            label="Copy"
            class="so__copy"
          />
        </div>
        <textarea
          class="so__textarea so__textarea--out"
          readonly
          spellcheck="false"
          :value="output"
          :aria-label="outputLabel()"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<style scoped>
.so {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.so__row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.so__row--options {
  gap: 20px;
  margin-top: 10px;
}
.so__seg {
  display: inline-flex;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.so__seg-btn {
  background: transparent;
  border: none;
  border-right: 1px solid var(--qt-border);
  color: var(--qt-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 16px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.so__seg-btn:last-child {
  border-right: none;
}
.so__seg-btn:hover {
  color: var(--qt-text);
}
.so__seg-btn--active {
  background: var(--qt-accent);
  color: var(--qt-accent-contrast, #fff);
}
.so__seg-btn--active:hover {
  color: var(--qt-accent-contrast, #fff);
}
.so__opt {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.so__opt-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.so__chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
.so__chip {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 12px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.so__chip:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.so__chip--active {
  background: var(--qt-accent);
  border-color: var(--qt-accent);
  color: var(--qt-accent-contrast, #fff);
}
.so__btn {
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
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.so__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.so__btn--ghost:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.so__btn--ghost:active {
  transform: translateY(1px);
}
.so__panes {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: stretch;
}
.so__pane {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.so__pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.so__pane-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.so__textarea {
  width: 100%;
  min-height: 240px;
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
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.so__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.so__textarea--out {
  background: var(--qt-bg-alt, var(--qt-bg));
}
.so__swap {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    transform 0.1s ease;
}
.so__swap:hover:not(:disabled) {
  color: var(--qt-accent);
  border-color: var(--qt-accent);
}
.so__swap:active:not(:disabled) {
  transform: scale(0.94);
}
.so__swap:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.so__copy {
  flex-shrink: 0;
}
@media (max-width: 720px) {
  .so__panes {
    grid-template-columns: 1fr;
  }
  .so__swap {
    transform: rotate(90deg);
    align-self: center;
  }
}
</style>
