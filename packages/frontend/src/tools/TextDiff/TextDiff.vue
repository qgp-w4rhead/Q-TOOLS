<script setup lang="ts">
/**
 * TextDiff — compare two text blocks and visualise the differences.
 *
 * Uses the lazy-loaded `diff` package (JsDiff) to compute a diff at the
 * chosen granularity (characters, words, lines or sentences). Three output
 * views are supported:
 *   - **Inline** — a single highlighted stream (green additions, red
 *     removals) wrapping each change run in a span.
 *   - **Side-by-side** — two aligned columns with line numbers; adjacent
 *     removed+added runs are paired as "modified" rows.
 *   - **Unified patch** — a monospace unified-diff text block (copyable).
 *
 * Options: ignore case, ignore leading/trailing whitespace on lines.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill either text
 * pane (`left`/`right`, `leftInput`/`rightInput`, `text1`/`text2`, or generic
 * `input`/`value`/`content` → left) and to set granularity / view mode /
 * options, and sends `output` PostMessages whenever the computed diff changes.
 */
import { computed } from 'vue';
import {
  ArrowLeftRight,
  RefreshCw,
  Columns2,
  List,
  FileDiff,
  Loader2,
  Plus,
  Minus,
  Equal,
  CaseSensitive,
  CaseUpper,
  Space,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useTextDiff,
  type DiffGranularity,
  type DiffViewMode,
} from './useTextDiff';

const {
  leftInput,
  rightInput,
  granularity,
  viewMode,
  ignoreCase,
  ignoreWhitespace,
  outputs,
  loading,
  recompute,
  setGranularity,
  setViewMode,
  swapInputs,
} = useTextDiff();

const granularityOptions: Array<{
  value: DiffGranularity;
  label: string;
}> = [
  { value: 'lines', label: 'Lines' },
  { value: 'words', label: 'Words' },
  { value: 'chars', label: 'Chars' },
  { value: 'sentences', label: 'Sentences' },
];

const viewModeOptions: Array<{
  value: DiffViewMode;
  label: string;
  icon: typeof List;
}> = [
  { value: 'side-by-side', label: 'Side-by-side', icon: Columns2 },
  { value: 'inline', label: 'Inline', icon: List },
  { value: 'unified', label: 'Unified', icon: FileDiff },
];

const summary = computed(() => {
  if (!outputs.value) return '';
  const c = outputs.value.counts;
  const parts: string[] = [];
  if (c.added) parts.push(`${c.added} added`);
  if (c.removed) parts.push(`${c.removed} removed`);
  if (c.unchanged) parts.push(`${c.unchanged} unchanged`);
  if (parts.length === 0) return 'Inputs are identical.';
  return parts.join(' · ');
});

const isIdentical = computed(
  () =>
    !!outputs.value &&
    outputs.value.counts.added === 0 &&
    outputs.value.counts.removed === 0,
);

const hasInput = computed(
  () => leftInput.value.trim().length > 0 || rightInput.value.trim().length > 0,
);

function onLeftInput(e: Event): void {
  leftInput.value = (e.target as HTMLTextAreaElement).value;
}
function onRightInput(e: Event): void {
  rightInput.value = (e.target as HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="td">
    <ToolInput
      title="Text inputs"
      description="Paste two text blocks to compare them."
    >
      <template #actions>
        <button
          class="td__btn td__btn--ghost"
          type="button"
          :disabled="!hasInput"
          title="Swap left and right inputs"
          @click="swapInputs"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="td__btn"
          type="button"
          :disabled="!hasInput || loading"
          @click="recompute"
        >
          <Loader2 v-if="loading" :size="14" class="td__spin" />
          <RefreshCw v-else :size="14" />
          <span>Compare</span>
        </button>
      </template>

      <div class="td__opts">
        <div class="td__seg" role="group" aria-label="Granularity">
          <button
            v-for="o in granularityOptions"
            :key="o.value"
            type="button"
            class="td__seg-btn"
            :class="{ 'td__seg-btn--active': granularity === o.value }"
            :aria-pressed="granularity === o.value"
            @click="setGranularity(o.value)"
          >
            <span>{{ o.label }}</span>
          </button>
        </div>
        <div class="td__seg" role="group" aria-label="View mode">
          <button
            v-for="o in viewModeOptions"
            :key="o.value"
            type="button"
            class="td__seg-btn"
            :class="{ 'td__seg-btn--active': viewMode === o.value }"
            :aria-pressed="viewMode === o.value"
            @click="setViewMode(o.value)"
          >
            <component :is="o.icon" :size="13" />
            <span>{{ o.label }}</span>
          </button>
        </div>
        <div class="td__toggles">
          <button
            type="button"
            class="td__toggle"
            :class="{ 'td__toggle--active': ignoreCase }"
            :aria-pressed="ignoreCase"
            title="Ignore character case when comparing"
            @click="ignoreCase = !ignoreCase"
          >
            <component :is="ignoreCase ? CaseUpper : CaseSensitive" :size="13" />
            <span>Ignore case</span>
          </button>
          <button
            type="button"
            class="td__toggle"
            :class="{ 'td__toggle--active': ignoreWhitespace }"
            :aria-pressed="ignoreWhitespace"
            title="Ignore leading/trailing whitespace on lines"
            @click="ignoreWhitespace = !ignoreWhitespace"
          >
            <Space :size="13" />
            <span>Ignore whitespace</span>
          </button>
        </div>
      </div>

      <div class="td__inputs">
        <label class="td__field">
          <span class="td__label">Original text</span>
          <textarea
            class="td__textarea td__textarea--mono"
            placeholder="Paste the original text here…"
            :value="leftInput"
            rows="10"
            spellcheck="false"
            autocomplete="off"
            @input="onLeftInput"
          />
        </label>
        <label class="td__field">
          <span class="td__label">Modified text</span>
          <textarea
            class="td__textarea td__textarea--mono"
            placeholder="Paste the modified text here…"
            :value="rightInput"
            rows="10"
            spellcheck="false"
            autocomplete="off"
            @input="onRightInput"
          />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      title="Diff output"
      :description="outputs ? summary : 'Paste two text blocks above to compare.'"
    >
      <p v-if="!outputs && !loading" class="td__empty">
        Paste two text blocks above to compare.
      </p>
      <p v-else-if="loading && !outputs" class="td__empty">
        <Loader2 :size="14" class="td__spin" /> Computing diff…
      </p>
      <template v-else-if="outputs">
        <!-- Inline view -->
        <div v-if="viewMode === 'inline'" class="td__inline">
          <p v-if="isIdentical" class="td__empty td__identical">
            <Equal :size="14" /> The two texts are identical.
          </p>
          <div v-else class="td__inline-stream" v-html="outputs.inlineHtml" />
        </div>

        <!-- Side-by-side view -->
        <div v-else-if="viewMode === 'side-by-side'" class="td__sbs">
          <p v-if="isIdentical" class="td__empty td__identical">
            <Equal :size="14" /> The two texts are identical.
          </p>
          <div v-else class="td__sbs-scroll">
            <table class="td__sbs-table">
              <tbody>
                <tr
                  v-for="(row, i) in outputs.rows"
                  :key="i"
                  class="td__sbs-row"
                  :class="`td__sbs-row--${row.type}`"
                >
                  <td class="td__sbs-ln">{{ row.leftNumber > 0 ? row.leftNumber : '' }}</td>
                  <td class="td__sbs-cell td__sbs-cell--left">
                    <span v-if="row.left !== null">{{ row.left }}</span>
                    <span v-else class="td__sbs-blank" aria-hidden="true">·</span>
                  </td>
                  <td class="td__sbs-ln">{{ row.rightNumber > 0 ? row.rightNumber : '' }}</td>
                  <td class="td__sbs-cell td__sbs-cell--right">
                    <span v-if="row.right !== null">{{ row.right }}</span>
                    <span v-else class="td__sbs-blank" aria-hidden="true">·</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Unified patch view -->
        <div v-else class="td__unified">
          <div class="td__unified-head">
            <span class="td__unified-label">Unified diff</span>
            <CopyButton :text="outputs.unifiedPatch" label="Copy patch" />
          </div>
          <pre v-if="outputs.unifiedPatch.trim().length > 0" class="td__unified-code">{{
            outputs.unifiedPatch
          }}</pre>
          <p v-else class="td__empty">No patch — inputs are identical or empty.</p>
        </div>

        <!-- Legend -->
        <div class="td__legend">
          <span class="td__chip td__chip--added">
            <Plus :size="11" /> {{ outputs.counts.added }} added
          </span>
          <span class="td__chip td__chip--removed">
            <Minus :size="11" /> {{ outputs.counts.removed }} removed
          </span>
          <span class="td__chip td__chip--unchanged">
            <Equal :size="11" /> {{ outputs.counts.unchanged }} unchanged
          </span>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.td {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}

/* Options bar */
.td__opts {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.td__seg {
  display: inline-flex;
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  overflow: hidden;
  background: var(--qt-bg);
}
.td__seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 12px;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
  will-change: color, background;
}
.td__seg-btn--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.td__toggles {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}
.td__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 6px 11px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  will-change: color, border-color;
}
.td__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}

/* Inputs */
.td__inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 720px) {
  .td__inputs {
    grid-template-columns: 1fr;
  }
}
.td__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.td__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.td__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 180px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  will-change: border-color;
}
.td__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.td__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}

/* Buttons */
.td__btn {
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
  transition: transform 0.1s ease, opacity 0.15s ease;
  will-change: transform;
}
.td__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.td__btn:active:not(:disabled) {
  transform: translateY(0);
}
.td__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.td__btn--ghost {
  background: var(--qt-bg);
  color: var(--qt-muted);
  border-color: var(--qt-border);
}
.td__btn--ghost:hover:not(:disabled) {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.td__spin {
  animation: td-spin 0.8s linear infinite;
}
@keyframes td-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Empty / identical states */
.td__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.td__identical {
  color: var(--qt-success, var(--qt-accent));
  font-weight: 600;
}

/* Inline view */
.td__inline-stream {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  max-height: 60vh;
  overflow: auto;
  color: var(--qt-text);
}
:deep(.td-add) {
  background: oklch(from var(--qt-success, var(--qt-accent)) 90% c h / 0.25);
  color: oklch(from var(--qt-success, var(--qt-accent)) 35% c h);
  text-decoration: none;
  border-radius: 2px;
}
:deep(.td-del) {
  background: oklch(from var(--qt-danger) 90% c h / 0.25);
  color: oklch(from var(--qt-danger) 40% c h);
  text-decoration: line-through;
  border-radius: 2px;
}
:deep(.td-keep) {
  color: var(--qt-text);
}

/* Side-by-side view */
.td__sbs-scroll {
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: auto;
  max-height: 60vh;
  background: var(--qt-bg);
}
.td__sbs-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  table-layout: fixed;
}
.td__sbs-row {
  border-bottom: 1px solid oklch(from var(--qt-border) 95% c h / 0.5);
}
.td__sbs-row:last-child {
  border-bottom: none;
}
.td__sbs-ln {
  width: 42px;
  min-width: 42px;
  padding: 2px 8px;
  text-align: right;
  color: var(--qt-muted);
  user-select: none;
  font-size: 11px;
  background: oklch(from var(--qt-surface) 97% c h / 0.5);
  vertical-align: top;
  white-space: nowrap;
}
.td__sbs-cell {
  padding: 2px 8px;
  white-space: pre-wrap;
  word-break: break-word;
  vertical-align: top;
  width: calc(50% - 42px);
}
.td__sbs-blank {
  color: var(--qt-muted);
  opacity: 0.4;
}
.td__sbs-row--added .td__sbs-cell--right {
  background: oklch(from var(--qt-success, var(--qt-accent)) 92% c h / 0.35);
}
.td__sbs-row--removed .td__sbs-cell--left {
  background: oklch(from var(--qt-danger) 92% c h / 0.35);
}
.td__sbs-row--modified .td__sbs-cell--left {
  background: oklch(from var(--qt-danger) 92% c h / 0.25);
}
.td__sbs-row--modified .td__sbs-cell--right {
  background: oklch(from var(--qt-success, var(--qt-accent)) 92% c h / 0.25);
}

/* Unified patch view */
.td__unified-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.td__unified-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.td__unified-code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  max-height: 60vh;
  overflow: auto;
}

/* Legend */
.td__legend {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.td__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.td__chip--added {
  border-color: transparent;
  background: oklch(from var(--qt-success, var(--qt-accent)) 60% c h);
  color: var(--qt-bg);
}
.td__chip--removed {
  border-color: transparent;
  background: var(--qt-danger);
  color: var(--qt-bg);
}
.td__chip--unchanged {
  background: var(--qt-muted);
  border-color: transparent;
  color: var(--qt-bg);
}
</style>
