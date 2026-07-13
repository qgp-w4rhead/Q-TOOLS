<script setup lang="ts">
/**
 * TextToUnicode — convert text to Unicode escape sequences and back.
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

const placeholder = computed(() =>
  mode.value === 'encode'
    ? 'Enter text to convert to \\uXXXX escapes…'
    : 'Enter \\uXXXX escape sequences to decode…',
);

const inputLabel = computed(() => (mode.value === 'encode' ? 'Text' : 'Unicode escapes'));
const outputLabel = computed(() => (mode.value === 'encode' ? 'Unicode escapes' : 'Text'));

const description = computed(() =>
  mode.value === 'encode'
    ? 'Encode text to \\uXXXX Unicode escape sequences (one escape per UTF-16 code unit).'
    : 'Decode \\uXXXX / \\UXXXX escape sequences back to text. Unrecognized characters are preserved.',
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
  <div class="uni">
    <ToolInput title="Input" :description="description">
      <template #actions>
        <button
          class="uni__btn uni__btn--ghost"
          type="button"
          title="Swap direction and feed the result back as input"
          @click="swap"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="uni__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <div class="uni__mode-row">
        <span class="uni__label">Direction</span>
        <div class="uni__mode-toggle">
          <button
            type="button"
            class="uni__mode-opt"
            :class="{ 'uni__mode-opt--active': mode === 'encode' }"
            :aria-pressed="mode === 'encode'"
            @click="onModeChange('encode')"
          >
            Encode
          </button>
          <button
            type="button"
            class="uni__mode-opt"
            :class="{ 'uni__mode-opt--active': mode === 'decode' }"
            :aria-pressed="mode === 'decode'"
            @click="onModeChange('decode')"
          >
            Decode
          </button>
        </div>
      </div>

      <div v-if="mode === 'encode'" class="uni__prefix-row">
        <label class="uni__label" for="uni-prefix">Escape prefix</label>
        <select
          id="uni-prefix"
          class="uni__select"
          :value="prefix"
          @change="onPrefixChange"
        >
          <option value="\u">\uXXXX (lowercase)</option>
          <option value="\U">\UXXXX (uppercase)</option>
        </select>
      </div>

      <label class="uni__field">
        <span class="uni__label">{{ inputLabel }}</span>
        <textarea
          class="uni__textarea uni__textarea--mono"
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
      :description="outputs ? `${analysis?.codePointCount} code points · ${analysis?.codeUnits} UTF-16 units · ${analysis?.utf8Bytes} UTF-8 bytes` : 'Enter a value above to convert.'"
      :copy-text="outputs?.output ?? ''"
      copy-label="Copy result"
    >
      <p v-if="error" class="uni__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="uni__empty">
          Enter a value above to convert.
        </p>
        <div v-if="outputs" class="uni__result">
          <div class="uni__result-head">
            <span class="uni__result-label">{{ outputLabel }}</span>
            <CopyButton :text="outputs.output" label="Copy" icon-only />
          </div>
          <code class="uni__code">{{ outputs.output || '—' }}</code>
        </div>

        <div v-if="analysis" class="uni__panel">
          <h3 class="uni__panel-title">Analysis</h3>
          <dl class="uni__stats">
            <div class="uni__stat">
              <dt>Code points</dt>
              <dd>{{ analysis.codePointCount }}</dd>
            </div>
            <div class="uni__stat">
              <dt>UTF-16 units</dt>
              <dd>{{ analysis.codeUnits }}</dd>
            </div>
            <div class="uni__stat">
              <dt>UTF-16 bytes</dt>
              <dd>{{ analysis.utf16Bytes }}</dd>
            </div>
            <div class="uni__stat">
              <dt>UTF-8 bytes</dt>
              <dd>{{ analysis.utf8Bytes }}</dd>
            </div>
          </dl>

          <div class="uni__cps">
            <span class="uni__cps-label">Code points</span>
            <code class="uni__cps-list">{{ codePointsPreview || '—' }}</code>
          </div>

          <div v-if="analysis.rows.length" class="uni__table-wrap">
            <table class="uni__table">
              <thead>
                <tr>
                  <th scope="col">Char</th>
                  <th scope="col">Code point</th>
                  <th scope="col">UTF-16</th>
                  <th scope="col">UTF-8</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in analysis.rows" :key="i">
                  <td class="uni__cell-char" :title="row.display">{{ row.display }}</td>
                  <td class="uni__cell-cp">{{ row.codePoint }}</td>
                  <td>{{ row.utf16Units }} unit<span v-if="row.utf16Units > 1">s</span></td>
                  <td>{{ row.utf8Bytes }} byte<span v-if="row.utf8Bytes > 1">s</span></td>
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
.uni {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.uni__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.uni__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.uni__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.uni__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.uni__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.uni__mode-row,
.uni__prefix-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
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
  will-change: color, background;
}
.uni__mode-opt--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.uni__select {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 13px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  padding: 5px 9px;
  cursor: pointer;
  transition: border-color 0.15s ease;
  will-change: border-color;
}
.uni__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.uni__btn {
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
.uni__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.uni__btn:active:not(:disabled) {
  transform: translateY(0);
}
.uni__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.uni__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.uni__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.uni__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.uni__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.uni__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.uni__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.uni__result-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.uni__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.uni__panel {
  margin-top: 10px;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.uni__panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--qt-text);
}
.uni__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin: 0;
}
.uni__stat {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
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
.uni__cps {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.uni__cps-label {
  font-size: 11.5px;
  color: var(--qt-muted);
  font-weight: 600;
}
.uni__cps-list {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
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
