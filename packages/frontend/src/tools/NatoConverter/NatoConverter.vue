<script setup lang="ts">
/**
 * NatoConverter - spell text using the NATO phonetic alphabet.
 *
 * A textarea input is converted live (debounced) into:
 *   - a flat string of space-joined NATO words (with punctuation preserved)
 *   - a per-character table showing each input char and its NATO word
 *
 * Letters A-Z map to NATO words (Alpha … Zulu); digits 0-9 map to ITU
 * spellings (Zero … Niner); other characters are preserved verbatim.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the text;
 * sends `output` PostMessages whenever the converted text changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useNatoConverter } from './useNato';

const {
  input,
  output,
  rows,
  recompute,
} = useNatoConverter();

const { t } = useI18n();
const U = 'tools.text-to-nato.ui.';

/** Character + word + line counts for the input. */
const inputStats = computed(() => {
  const text = input.value;
  const chars = text.length;
  const lines = text.length === 0 ? 0 : text.split('\n').length;
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  return { chars, lines, words };
});

/** Number of characters that have a NATO/ITU word. */
const mappedCount = computed(() => rows.value.filter((r) => r.word !== null).length);

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

/** Display label for a row's character - show newlines/whitespace visibly. */
function charLabel(ch: string): string {
  if (ch === '\n') return '↵';
  if (ch === ' ') return '·';
  if (ch === '\t') return '→';
  return ch;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.text')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t(U + 'spell') }}</span>
        </button>
      </template>

      <textarea
        class="qt-input qt-input--mono nato__textarea"
        :placeholder="t('common.typeOrPaste')"
        :value="input"
        spellcheck="false"
        autocomplete="off"
        rows="5"
        @input="onTextInput"
      />

      <p class="qt-row qt-row--center qt-hint" style="--qt-row-gap:14px">
        <span>{{ t('common.chars', { n: inputStats.chars }) }}</span>
        <span>{{ t('common.words', inputStats.words) }}</span>
        <span>{{ t('common.lines', inputStats.lines) }}</span>
        <span>{{ t('common.mapped', { n: mappedCount }) }}</span>
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="output ? t(U + 'outputDesc') : t(U + 'outputDescEmpty')"
    >
      <template v-if="output" #actions>
        <CopyButton :text="output" :label="t('common.copyResult')" />
      </template>
      <p v-if="!output" class="qt-alert qt-alert--empty">
        {{ t(U + 'empty') }}
      </p>
      <pre v-else class="qt-result qt-mono nato__output">{{ output }}</pre>
    </ToolOutput>

    <ToolOutput
      v-if="rows.length > 0"
      :title="t(U + 'breakdownTitle')"
      :description="t(U + 'breakdownDesc', { mapped: mappedCount, total: rows.length })"
    >
      <div class="nato__table" role="table">
        <div class="nato__row nato__row--head" role="row">
          <span class="nato__cell nato__cell--char" role="columnheader">{{ t(U + 'colChar') }}</span>
          <span class="nato__cell nato__cell--word" role="columnheader">{{ t(U + 'colWord') }}</span>
        </div>
        <div
          v-for="(row, i) in rows"
          :key="i"
          class="nato__row"
          :class="{ 'nato__row--unmapped': row.word === null }"
          role="row"
        >
          <span class="nato__cell nato__cell--char" role="cell">{{ charLabel(row.char) }}</span>
          <span class="nato__cell nato__cell--word" role="cell">
            <template v-if="row.word">{{ row.word }}</template>
            <span v-else class="nato__muted">-</span>
          </span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.nato__textarea {
  min-height: 100px;
}
/* Output block (card via .qt-result, font via .qt-mono) — pre-wrapped. */
.nato__output {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 60px;
}
/* Per-character breakdown — div-based table with sticky head + scroll. */
.nato__table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
  max-height: 360px;
  overflow-y: auto;
}
.nato__row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--qt-border);
}
.nato__row:last-child {
  border-bottom: none;
}
.nato__row--head {
  position: sticky;
  top: 0;
  background: var(--qt-surface);
  font-weight: 600;
  font-size: 12px;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.nato__row--unmapped {
  background: oklch(from var(--qt-surface) 95% c h);
}
.nato__cell {
  padding: 6px 10px;
  font-size: 13.5px;
}
.nato__cell--char {
  flex: 0 0 64px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-text);
  text-align: center;
}
.nato__cell--word {
  flex: 1 1 auto;
  color: var(--qt-text);
}
.nato__muted {
  color: var(--qt-muted);
}
</style>
