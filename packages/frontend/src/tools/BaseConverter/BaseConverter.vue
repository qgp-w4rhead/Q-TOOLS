<script setup lang="ts">
/**
 * BaseConverter — convert integers between bases 2-36.
 *
 * Input is parsed in a selectable base (2-36, with quick-pick buttons for
 * binary/octal/decimal/hex). Outputs are shown in binary, octal, decimal,
 * hex, and a user-selected custom base. A signed/unsigned toggle plus a bit
 * width selector (8/16/32/64/128 or unbounded) control two's-complement
 * interpretation.
 *
 * No external dependencies — uses only `BigInt` + `BigInt.prototype.toString`.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input and
 * settings, and sends `output` PostMessages whenever the computed outputs
 * change.
 */
import { computed } from 'vue';
import { AlertCircle, ArrowLeftRight, RefreshCw, TriangleAlert } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useBaseConverter,
  STANDARD_BASES,
  BIT_WIDTHS,
  MIN_BASE,
  MAX_BASE,
  isValidBase,
} from './useBaseConverter';

const {
  input,
  inputBase,
  outputBase,
  signed,
  bitWidth,
  value,
  outputs,
  error,
  warning,
  recompute,
  setInputBase,
  setOutputBase,
  setBitWidth,
  setSigned,
  swap,
} = useBaseConverter();

/** Output rows for the results grid. */
const outputRows = computed(() => {
  const o = outputs.value;
  if (!o) return [];
  return [
    { key: 'binary', label: 'Binary', base: 2, value: o.binary, hint: 'base 2' },
    { key: 'octal', label: 'Octal', base: 8, value: o.octal, hint: 'base 8' },
    { key: 'decimal', label: 'Decimal', base: 10, value: o.decimal, hint: 'base 10' },
    { key: 'hex', label: 'Hexadecimal', base: 16, value: o.hex, hint: 'base 16' },
    { key: 'custom', label: `Custom (base ${outputBase.value})`, base: outputBase.value, value: o.custom, hint: `base ${outputBase.value}` },
  ];
});

/** Quick-pick input-base buttons (binary/octal/decimal/hex). */
const quickBases = STANDARD_BASES;

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}

function onInputBaseChange(e: Event): void {
  const n = Number((e.target as HTMLSelectElement).value);
  if (isValidBase(n)) setInputBase(n);
}

function onOutputBaseInput(e: Event): void {
  const n = Number((e.target as HTMLInputElement).value);
  if (isValidBase(n)) setOutputBase(n);
}

function onBitWidthChange(e: Event): void {
  const n = Number((e.target as HTMLSelectElement).value);
  setBitWidth(n);
}
</script>

<template>
  <div class="bc">
    <ToolInput
      title="Input"
      :description="`Enter an integer in any base ${MIN_BASE}-${MAX_BASE}. Pick a bit width for two's-complement interpretation.`"
    >
      <template #actions>
        <button
          class="bc__btn bc__btn--ghost"
          type="button"
          title="Swap input base with custom output base"
          :disabled="!outputs"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="bc__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <label class="bc__field">
        <span class="bc__label">Integer input</span>
        <input
          class="bc__input bc__input--mono"
          type="text"
          inputmode="text"
          :placeholder="`e.g. ${inputBase === 16 ? 'deadbeef' : inputBase === 2 ? '1010' : inputBase === 8 ? '777' : '255'}`"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>

      <div class="bc__quick-row">
        <span class="bc__label">Quick base:</span>
        <div class="bc__quick-buttons">
          <button
            v-for="b in quickBases"
            :key="b.base"
            class="bc__chip"
            type="button"
            :class="{ 'bc__chip--active': inputBase === b.base }"
            :title="b.label"
            @click="setInputBase(b.base)"
          >
            {{ b.short }} ({{ b.base }})
          </button>
        </div>
      </div>

      <div class="bc__row">
        <label class="bc__field bc__field--grow">
          <span class="bc__label">Input base ({{ MIN_BASE }}-{{ MAX_BASE }})</span>
          <select class="bc__select" :value="inputBase" @change="onInputBaseChange">
            <option v-for="b in MAX_BASE - MIN_BASE + 1" :key="b + MIN_BASE - 1" :value="b + MIN_BASE - 1">
              Base {{ b + MIN_BASE - 1 }}
            </option>
          </select>
        </label>

        <label class="bc__field bc__field--grow">
          <span class="bc__label">Bit width</span>
          <select class="bc__select" :value="bitWidth" @change="onBitWidthChange">
            <option v-for="w in BIT_WIDTHS" :key="w.width" :value="w.width">{{ w.label }}</option>
          </select>
        </label>

        <label class="bc__field bc__field--toggle">
          <span class="bc__label">Interpretation</span>
          <button
            type="button"
            class="bc__toggle"
            :class="{ 'bc__toggle--signed': signed }"
            :aria-pressed="signed"
            @click="setSigned(!signed)"
          >
            <span class="bc__toggle-opt" :class="{ 'bc__toggle-opt--active': !signed }">Unsigned</span>
            <span class="bc__toggle-opt" :class="{ 'bc__toggle-opt--active': signed }">Signed</span>
          </button>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Outputs"
      :description="value !== null ? `Interpreted value: ${value.toString(10)}` : 'Enter an integer above to see all base conversions.'"
      :copy-text="outputs?.hex ?? ''"
      copy-label="Copy hex"
    >
      <p v-if="error" class="bc__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="warning" class="bc__warning">
          <TriangleAlert :size="14" />
          <span>{{ warning }}</span>
        </p>
        <p v-if="!outputs" class="bc__empty">
          Enter an integer above to see all base conversions.
        </p>
        <div v-if="outputs" class="bc__results">
          <div v-for="row in outputRows" :key="row.key" class="bc__row-out">
            <div class="bc__row-head">
              <span class="bc__row-label">{{ row.label }}</span>
              <span class="bc__row-hint">{{ row.hint }}</span>
              <CopyButton :text="row.value" label="Copy" icon-only />
            </div>
            <code class="bc__code">{{ row.value || '—' }}</code>
          </div>
        </div>

        <label v-if="outputs" class="bc__field bc__field--custom-out">
          <span class="bc__label">Custom output base ({{ MIN_BASE }}-{{ MAX_BASE }})</span>
          <input
            class="bc__input bc__input--narrow"
            type="number"
            :min="MIN_BASE"
            :max="MAX_BASE"
            :value="outputBase"
            @input="onOutputBaseInput"
          />
        </label>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.bc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.bc__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bc__field--grow {
  flex: 1;
  min-width: 0;
}
.bc__field--toggle {
  flex: 0 0 auto;
}
.bc__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.bc__input,
.bc__select {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.bc__input--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.bc__input--narrow {
  max-width: 140px;
}
.bc__input:focus,
.bc__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.bc__select {
  appearance: none;
  cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--qt-muted) 50%),
    linear-gradient(135deg, var(--qt-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 50%,
    calc(100% - 13px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 32px;
}
.bc__row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: flex-end;
}
.bc__quick-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.bc__quick-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.bc__chip {
  display: inline-flex;
  align-items: center;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-text);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 11px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
  will-change: border-color, color;
}
.bc__chip:hover {
  border-color: var(--qt-accent-soft);
  color: var(--qt-accent);
}
.bc__chip--active {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.12);
}
.bc__toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
  cursor: pointer;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  transition: border-color 0.15s ease;
  will-change: border-color;
}
.bc__toggle:hover {
  border-color: var(--qt-accent-soft);
}
.bc__toggle-opt {
  padding: 5px 11px;
  border-radius: 999px;
  color: var(--qt-muted);
  transition:
    color 0.15s ease,
    background 0.15s ease;
}
.bc__toggle-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.bc__btn {
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
.bc__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.bc__btn:active:not(:disabled) {
  transform: translateY(0);
}
.bc__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bc__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.bc__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.bc__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.bc__warning {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
  color: var(--qt-warning);
  font-size: 13px;
}
.bc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.bc__results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.bc__row-out {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bc__row-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bc__row-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
.bc__row-hint {
  font-size: 11px;
  color: var(--qt-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bc__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.bc__field--custom-out {
  margin-top: 4px;
}
</style>
