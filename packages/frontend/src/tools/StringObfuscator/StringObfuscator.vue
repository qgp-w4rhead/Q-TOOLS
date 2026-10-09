<script setup lang="ts">
/**
 * StringObfuscator - obfuscate text to deter casual reading.
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
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.string-obfuscator.ui.';

const modes = computed<{ value: ObfuscatorMode; label: string }[]>(() => [
  { value: 'obfuscate', label: t(U + 'modeObfuscate') },
  { value: 'deobfuscate', label: t(U + 'modeDeobfuscate') },
]);

const methods = computed<{ value: ObfuscationMethod; label: string; hint: string }[]>(() => [
  { value: 'homoglyph', label: t(U + 'methodHomoglyph'), hint: t(U + 'methodHomoglyphHint') },
  { value: 'zero-width', label: t(U + 'methodZeroWidth'), hint: t(U + 'methodZeroWidthHint') },
  { value: 'mixed', label: t(U + 'methodMixed'), hint: t(U + 'methodMixedHint') },
]);

const intensities = computed<{ value: Intensity; label: string }[]>(() => [
  { value: 'low', label: t(U + 'intensityLow') },
  { value: 'medium', label: t(U + 'intensityMedium') },
  { value: 'high', label: t(U + 'intensityHigh') },
]);

function setMode(m: ObfuscatorMode): void {
  mode.value = m;
}
function setMethod(m: ObfuscationMethod): void {
  method.value = m;
}
function setIntensity(i: Intensity): void {
  intensity.value = i;
}

const inputLabel = () => (mode.value === 'deobfuscate' ? t(U + 'labelObfuscated') : t(U + 'labelPlain'));
const outputLabel = () => (mode.value === 'deobfuscate' ? t(U + 'labelDeobfuscated') : t(U + 'labelObfuscated'));
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="mode === 'deobfuscate'
        ? t(U + 'descDeobfuscate')
        : t(U + 'descObfuscate')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'resetTitle')"
          @click="onReset"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center">
        <div class="qt-seg">
          <button
            v-for="m in modes"
            :key="m.value"
            type="button"
            class="qt-seg__btn"
            :class="{ 'qt-seg__btn--active': mode === m.value }"
            @click="setMode(m.value)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <div v-if="mode === 'obfuscate'" class="qt-row qt-row--center" style="--qt-row-gap:20px;margin-top:10px">
        <div class="qt-field">
          <span class="qt-label">{{ t(U + 'method') }}</span>
          <div class="qt-row" style="--qt-row-gap:6px">
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
        <div class="qt-field">
          <span class="qt-label">{{ t(U + 'intensity') }}</span>
          <div class="qt-row" style="--qt-row-gap:6px">
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
      <div class="qt-field" style="min-width:0">
        <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <span class="qt-stat-head">{{ inputLabel() }}</span>
        </div>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:240px;font-size:13.5px;line-height:1.6;padding:12px 14px"
          spellcheck="false"
          :placeholder="t(U + 'placeholder')"
          :value="draft"
          @input="onInput"
          :aria-label="inputLabel()"
        ></textarea>
      </div>

      <button
        type="button"
        class="so__swap"
        :title="t(U + 'swapTitle')"
        :disabled="output.length === 0"
        @click="onSwap"
      >
        <ArrowDownUp :size="16" />
      </button>

      <div class="qt-field" style="min-width:0">
        <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <span class="qt-stat-head">{{ outputLabel() }}</span>
          <CopyButton
            :text="output"
            :label="t('common.copy')"
            style="flex-shrink:0"
          />
        </div>
        <textarea
          class="qt-input qt-input--mono"
          style="min-height:240px;font-size:13.5px;line-height:1.6;padding:12px 14px;background:var(--qt-bg-alt, var(--qt-bg))"
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
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Option chip — rounded-sm toggle chip (vs the pill .qt-chip). */
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

/* 3-pane input / swap / output grid — collapses to stacked on narrow. */
.so__panes {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: stretch;
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
