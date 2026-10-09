<script setup lang="ts">
/**
 * BaseConverter - convert integers between bases 2-36.
 *
 * Input is parsed in a selectable base (2-36, with quick-pick buttons for
 * binary/octal/decimal/hex). Outputs are shown in binary, octal, decimal,
 * hex, and a user-selected custom base. A signed/unsigned toggle plus a bit
 * width selector (8/16/32/64/128 or unbounded) control two's-complement
 * interpretation.
 *
 * No external dependencies - uses only `BigInt` + `BigInt.prototype.toString`.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input and
 * settings, and sends `output` PostMessages whenever the computed outputs
 * change.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.integer-base-converter.ui.';

/** Localized label for a standard base chip title. */
const BASE_LABELS: Record<number, string> = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hexadecimal' };
function baseTitle(base: number): string {
  const key = BASE_LABELS[base];
  return key ? t(U + key) : t(U + 'baseHint', { n: base });
}
/** Localized label for a bit-width option. */
function bitWidthLabel(w: { width: number }): string {
  return w.width === 0 ? t(U + 'unbounded') : t(U + 'bitsN', { n: w.width });
}

/** Output rows for the results grid. */
const outputRows = computed(() => {
  const o = outputs.value;
  if (!o) return [];
  return [
    { key: 'binary', label: t(U + 'binary'), base: 2, value: o.binary, hint: t(U + 'baseHint', { n: 2 }) },
    { key: 'octal', label: t(U + 'octal'), base: 8, value: o.octal, hint: t(U + 'baseHint', { n: 8 }) },
    { key: 'decimal', label: t(U + 'decimal'), base: 10, value: o.decimal, hint: t(U + 'baseHint', { n: 10 }) },
    { key: 'hex', label: t(U + 'hexadecimal'), base: 16, value: o.hex, hint: t(U + 'baseHint', { n: 16 }) },
    { key: 'custom', label: t(U + 'customBase', { n: outputBase.value }), base: outputBase.value, value: o.custom, hint: t(U + 'baseHint', { n: outputBase.value }) },
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
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc', { min: MIN_BASE, max: MAX_BASE })"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :title="t(U + 'swapTitle')"
          :disabled="!outputs"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'integerInput') }}</span>
        <input
          class="qt-input qt-input--mono"
          type="text"
          inputmode="text"
          :placeholder="`e.g. ${inputBase === 16 ? 'deadbeef' : inputBase === 2 ? '1010' : inputBase === 8 ? '777' : '255'}`"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>

      <div class="qt-row qt-row--center">
        <span class="qt-label">{{ t(U + 'quickBase') }}</span>
        <div class="qt-row" style="--qt-row-gap:6px">
          <button
            v-for="b in quickBases"
            :key="b.base"
            class="qt-chip qt-chip--filled"
            type="button"
            :class="{ 'qt-chip--active': inputBase === b.base }"
            :title="baseTitle(b.base)"
            @click="setInputBase(b.base)"
          >
            {{ b.short }} ({{ b.base }})
          </button>
        </div>
      </div>

      <div class="qt-row qt-row--bottom">
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'inputBase', { min: MIN_BASE, max: MAX_BASE }) }}</span>
          <select class="qt-input" :value="inputBase" @change="onInputBaseChange">
            <option v-for="b in MAX_BASE - MIN_BASE + 1" :key="b + MIN_BASE - 1" :value="b + MIN_BASE - 1">
              {{ t(U + 'baseN', { n: b + MIN_BASE - 1 }) }}
            </option>
          </select>
        </label>

        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'bitWidth') }}</span>
          <select class="qt-input" :value="bitWidth" @change="onBitWidthChange">
            <option v-for="w in BIT_WIDTHS" :key="w.width" :value="w.width">{{ bitWidthLabel(w) }}</option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'interpretation') }}</span>
          <button
            type="button"
            class="bc__toggle"
            :class="{ 'bc__toggle--signed': signed }"
            :aria-pressed="signed"
            @click="setSigned(!signed)"
          >
            <span class="bc__toggle-opt" :class="{ 'bc__toggle-opt--active': !signed }">{{ t(U + 'unsigned') }}</span>
            <span class="bc__toggle-opt" :class="{ 'bc__toggle-opt--active': signed }">{{ t(U + 'signed') }}</span>
          </button>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="value !== null ? t(U + 'outputDesc', { value: value.toString(10) }) : t(U + 'empty')"
      :copy-text="outputs?.hex ?? ''"
      :copy-label="t(U + 'copyHex')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="warning" class="qt-alert qt-alert--warn">
          <TriangleAlert :size="14" />
          <span>{{ warning }}</span>
        </p>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t(U + 'empty') }}
        </p>
        <div v-if="outputs" class="qt-grid" style="--qt-grid-min:280px">
          <div v-for="row in outputRows" :key="row.key" class="qt-result">
            <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
              <span class="bc__row-label">{{ row.label }}</span>
              <span class="bc__row-hint">{{ row.hint }}</span>
              <CopyButton :text="row.value" :label="t('common.copy')" icon-only />
            </div>
            <code class="qt-mono bc__code">{{ row.value || '-' }}</code>
          </div>
        </div>

        <label v-if="outputs" class="qt-field bc__field--custom-out">
          <span class="qt-label">{{ t(U + 'customOutputBase', { min: MIN_BASE, max: MAX_BASE }) }}</span>
          <input
            class="qt-input bc__input--narrow"
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
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Pill toggle (Unsigned/Signed) — a distinct control, not a generic seg. */
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
/* Narrow number input cap. */
.bc__input--narrow {
  max-width: 140px;
}
/* Result-row header label (text-colored, not muted). */
.bc__row-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
/* Result-row hint — flexible, truncates. */
.bc__row-hint {
  font-size: 11px;
  color: var(--qt-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Mono code value (font via .qt-mono). */
.bc__code {
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Extra spacing above the custom-output field. */
.bc__field--custom-out {
  margin-top: 4px;
}
</style>
