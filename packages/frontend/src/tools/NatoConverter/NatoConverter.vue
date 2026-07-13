<script setup lang="ts">
/**
 * NatoConverter — spell text using the NATO phonetic alphabet.
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

/** Display label for a row's character — show newlines/whitespace visibly. */
function charLabel(ch: string): string {
  if (ch === '\n') return '↵';
  if (ch === ' ') return '·';
  if (ch === '\t') return '→';
  return ch;
}
</script>

<template>
  <div class="nato">
    <ToolInput
      title="Text"
      description="Enter text to spell using the NATO phonetic alphabet. Conversion is live."
    >
      <template #actions>
        <button
          class="nato__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Spell</span>
        </button>
      </template>

      <textarea
        class="nato__textarea"
        placeholder="Type or paste text here…"
        :value="input"
        spellcheck="false"
        autocomplete="off"
        rows="5"
        @input="onTextInput"
      />

      <p class="nato__stats">
        <span>{{ inputStats.chars }} chars</span>
        <span>{{ inputStats.words }} words</span>
        <span>{{ inputStats.lines }} lines</span>
        <span>{{ mappedCount }} mapped</span>
      </p>
    </ToolInput>

    <ToolOutput
      title="NATO phonetic alphabet"
      :description="output ? 'Each letter spelt out using the NATO phonetic alphabet.' : 'Enter text above to spell it out.'"
    >
      <template v-if="output" #actions>
        <CopyButton :text="output" label="Copy result" />
      </template>
      <p v-if="!output" class="nato__empty">
        Enter text above to see the NATO phonetic spelling.
      </p>
      <pre v-else class="nato__output">{{ output }}</pre>
    </ToolOutput>

    <ToolOutput
      v-if="rows.length > 0"
      title="Per-character breakdown"
      :description="`Mapped ${mappedCount} of ${rows.length} characters.`"
    >
      <div class="nato__table" role="table">
        <div class="nato__row nato__row--head" role="row">
          <span class="nato__cell nato__cell--char" role="columnheader">Char</span>
          <span class="nato__cell nato__cell--word" role="columnheader">NATO word</span>
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
            <span v-else class="nato__muted">—</span>
          </span>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.nato {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.nato__textarea {
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
  min-height: 100px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.nato__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.nato__stats {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
}
.nato__btn {
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
.nato__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.nato__btn:active:not(:disabled) {
  transform: translateY(0);
}
.nato__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nato__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.nato__output {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--qt-text);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  min-height: 60px;
}
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
