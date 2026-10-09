<script setup lang="ts">
/**
 * TextToUnicode - convert text to Unicode escape sequences and back.
 *
 * Bidirectional: text → `\uXXXX` escapes (encode) and `\uXXXX` → text
 * (decode). Encode renders each UTF-16 code unit as one `\uXXXX` escape, so
 * supplementary-plane code points emit a surrogate pair (`\uD83D\uDE00`).
 * Decode parses `\uXXXX` / `\UXXXX` escapes (4 hex digits, case-insensitive)
 * and preserves any unrecognized characters verbatim.
 *
 * The analysis panel shows, for the converted output's underlying text:
 *   - code points (count + `U+XXXX` list)
 *   - UTF-16 code units + byte length
 *   - UTF-8 byte length
 *   - per-character breakdown table
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input,
 * select the mode, and set the escape prefix; sends `output` PostMessages
 * whenever the computed output changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, ArrowLeftRight, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useTextToUnicode,
  type UnicodeMode,
} from './useTextToUnicode';

const {
  input,
  mode,
  prefix,
  outputs,
  error,
  recompute,
  setMode,
  setPrefix,
  swap,
} = useTextToUnicode();

const { t } = useI18n();
const U = 'tools.text-to-unicode.ui.';

const placeholder = computed(() =>
  mode.value === 'encode'
    ? t(U + 'placeholderEncode')
    : t(U + 'placeholderDecode'),
);

const inputLabel = computed(() => (mode.value === 'encode' ? t('common.text') : t(U + 'unicodeEscapes')));
const outputLabel = computed(() => (mode.value === 'encode' ? t(U + 'unicodeEscapes') : t('common.text')));

const description = computed(() =>
  mode.value === 'encode'
    ? t(U + 'descEncode')
    : t(U + 'descDecode'),
);

const analysis = computed(() => outputs.value?.analysis ?? null);

const codePointsPreview = computed(() => {
  const a = analysis.value;
  if (!a) return '';
  // Show up to 32 code points, then an ellipsis.
  const list = a.codePoints.slice(0, 32);
  const suffix = a.codePoints.length > 32 ? ` … (+${a.codePoints.length - 32})` : '';
  return list.join(' ') + suffix;
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onModeChange(m: UnicodeMode): void {
  setMode(m);
}

function onPrefixChange(e: Event): void {
  setPrefix((e.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t('common.input')" :description="description">
      <template #actions>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :title="t('common.swapTitle')"
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

      <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <span class="qt-label">{{ t('common.direction') }}</span>
        <div class="uni__mode-toggle">
          <button
            type="button"
            class="uni__mode-opt"
            :class="{ 'uni__mode-opt--active': mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            @click="onModeChange('encode')"
          >
            {{ t('common.encode') }}
          </button>
          <button
            type="button"
            class="uni__mode-opt"
            :class="{ 'uni__mode-opt--active': mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            @click="onModeChange('decode')"
          >
            {{ t('common.decode') }}
          </button>
        </div>
      </div>

      <div v-if="mode === 'encode'" class="qt-row qt-row--center" style="--qt-row-gap:10px">
        <label class="qt-label" for="uni-prefix">{{ t(U + 'escapePrefix') }}</label>
        <select
          id="uni-prefix"
          class="qt-input"
          :value="prefix"
          @change="onPrefixChange"
        >
          <option value="\u">{{ t(U + 'prefixLower') }}</option>
          <option value="\U">{{ t(U + 'prefixUpper') }}</option>
        </select>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ inputLabel }}</span>
        <textarea
          class="qt-input qt-input--mono uni__textarea"
          :placeholder="placeholder"
          :value="input"
          rows="6"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="outputLabel"
      :description="outputs ? t(U + 'outputDesc', { codePoints: analysis?.codePointCount, units: analysis?.codeUnits, bytes: analysis?.utf8Bytes }) : t('common.enterToConvert')"
      :copy-text="outputs?.output ?? ''"
      :copy-label="t('common.copyResult')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t('common.enterToConvert') }}
        </p>
        <div v-if="outputs" class="qt-result">
          <div class="qt-row qt-row--center qt-row--between qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="qt-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono uni__code">{{ outputs.output || '-' }}</code>
        </div>

        <div v-if="analysis" class="qt-panel uni__panel">
          <h3 class="uni__panel-title">{{ t(U + 'analysis') }}</h3>
          <dl class="qt-grid" style="--qt-grid-min:120px;--qt-grid-gap:8px;margin:0">
            <div class="qt-result uni__stat">
              <dt>{{ t(U + 'codePoints') }}</dt>
              <dd>{{ analysis.codePointCount }}</dd>
            </div>
            <div class="qt-result uni__stat">
              <dt>{{ t(U + 'utf16Units') }}</dt>
              <dd>{{ analysis.codeUnits }}</dd>
            </div>
            <div class="qt-result uni__stat">
              <dt>{{ t(U + 'utf16Bytes') }}</dt>
              <dd>{{ analysis.utf16Bytes }}</dd>
            </div>
            <div class="qt-result uni__stat">
              <dt>{{ t(U + 'utf8Bytes') }}</dt>
              <dd>{{ analysis.utf8Bytes }}</dd>
            </div>
          </dl>

          <div class="qt-field">
            <span class="qt-label">{{ t(U + 'codePoints') }}</span>
            <code class="qt-mono uni__cps-list">{{ codePointsPreview || '-' }}</code>
          </div>

          <div v-if="analysis.rows.length" class="uni__table-wrap">
            <table class="uni__table">
              <thead>
                <tr>
                  <th scope="col">{{ t(U + 'colChar') }}</th>
                  <th scope="col">{{ t(U + 'colCodePoint') }}</th>
                  <th scope="col">{{ t(U + 'colUtf16') }}</th>
                  <th scope="col">{{ t(U + 'colUtf8') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in analysis.rows" :key="i">
                  <td class="uni__cell-char" :title="row.display">{{ row.display }}</td>
                  <td class="uni__cell-cp">{{ row.codePoint }}</td>
                  <td>{{ t(U + 'unitsCount', row.utf16Units) }}</td>
                  <td>{{ t(U + 'bytesCount', row.utf8Bytes) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Direction pill segmented control (solid-accent active). */
.uni__mode-toggle {
  display: inline-flex;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  padding: 3px;
}
.uni__mode-opt {
  padding: 5px 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease;
}
.uni__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.uni__textarea {
  min-height: 120px;
}
/* Output code (font via .qt-mono) — break-anywhere, pre-wrapped. */
.uni__code {
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Analysis panel offset (card via .qt-panel). */
.uni__panel {
  margin-top: 10px;
}
.uni__panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}
/* Stat card internals (card via .qt-result). */
.uni__stat dt {
  font-size: 11.5px;
  color: var(--qt-muted);
  font-weight: 600;
}
.uni__stat dd {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
/* Code-point list (font via .qt-mono) — break-anywhere, pre-wrapped. */
.uni__cps-list {
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
/* Per-character breakdown table (scroll wrapper + sticky head). */
.uni__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  max-height: 320px;
  overflow-y: auto;
}
.uni__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.uni__table thead th {
  position: sticky;
  top: 0;
  background: var(--qt-bg);
  color: var(--qt-muted);
  font-weight: 600;
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--qt-border);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.uni__table tbody td {
  padding: 5px 10px;
  border-bottom: 1px solid var(--qt-border);
  color: var(--qt-text);
}
.uni__table tbody tr:last-child td {
  border-bottom: none;
}
.uni__cell-char {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  white-space: pre;
}
.uni__cell-cp {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-accent);
  font-weight: 600;
}
</style>
