<script setup lang="ts">
/**
 * JsonDiff — compare two JSON documents and show a path-based visual diff.
 *
 * Uses a hand-rolled recursive walker (no external dependency) that produces
 * a flat list of `DiffEntry` records tagged added / removed / changed /
 * unchanged. Supports an inline (single list) or side-by-side (two
 * pretty-printed panes + diff list) view, and a toggle to show or hide
 * unchanged entries.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill either JSON
 * pane (`left`/`right` or `leftInput`/`rightInput`), and sends `output`
 * PostMessages whenever the computed diff changes.
 */
import { computed } from 'vue';
import {
  AlertCircle,
  RefreshCw,
  ArrowLeftRight,
  Columns2,
  List,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Pencil,
  Equal,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useJsonDiff,
  formatDiffValue,
  type DiffViewMode,
  type DiffType,
  type DiffEntry,
} from './useJsonDiff';

const {
  leftInput,
  rightInput,
  viewMode,
  showUnchanged,
  outputs,
  error,
  recompute,
  setViewMode,
  toggleShowUnchanged,
  swapInputs,
} = useJsonDiff();

const viewModeOptions: Array<{ value: DiffViewMode; label: string; icon: typeof List }> = [
  { value: 'inline', label: 'Inline', icon: List },
  { value: 'side-by-side', label: 'Side-by-side', icon: Columns2 },
];

const typeMeta: Record<DiffType, { label: string; icon: typeof Plus; cls: string }> = {
  added: { label: 'Added', icon: Plus, cls: 'jd__type--added' },
  removed: { label: 'Removed', icon: Minus, cls: 'jd__type--removed' },
  changed: { label: 'Changed', icon: Pencil, cls: 'jd__type--changed' },
  unchanged: { label: 'Unchanged', icon: Equal, cls: 'jd__type--unchanged' },
};

const visibleEntries = computed<DiffEntry[]>(() => {
  if (!outputs.value) return [];
  if (showUnchanged.value) return outputs.value.entries;
  return outputs.value.entries.filter((e) => e.type !== 'unchanged');
});

const summary = computed(() => {
  if (!outputs.value) return '';
  const c = outputs.value.counts;
  const parts: string[] = [];
  if (c.added) parts.push(`${c.added} added`);
  if (c.removed) parts.push(`${c.removed} removed`);
  if (c.changed) parts.push(`${c.changed} changed`);
  if (c.unchanged) parts.push(`${c.unchanged} unchanged`);
  if (parts.length === 0) return 'Documents are identical.';
  return parts.join(' · ');
});

const isIdentical = computed(
  () => !!outputs.value && outputs.value.counts.added === 0 && outputs.value.counts.removed === 0 && outputs.value.counts.changed === 0,
);

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  if (e.line != null && e.column != null) {
    return `${e.side === 'left' ? 'Left' : 'Right'} · Line ${e.line}, column ${e.column}`;
  }
  if (e.line != null) return `${e.side === 'left' ? 'Left' : 'Right'} · Line ${e.line}`;
  return e.side === 'left' ? 'Left' : 'Right';
});

function onLeftInput(e: Event): void {
  leftInput.value = (e.target as HTMLTextAreaElement).value;
}
function onRightInput(e: Event): void {
  rightInput.value = (e.target as HTMLTextAreaElement).value;
}

function entryCopyText(e: DiffEntry): string {
  const parts: string[] = [e.path, e.type];
  if (e.type === 'added') parts.push(formatDiffValue(e.newValue));
  else if (e.type === 'removed') parts.push(formatDiffValue(e.oldValue));
  else if (e.type === 'changed') {
    parts.push(`${formatDiffValue(e.oldValue)} → ${formatDiffValue(e.newValue)}`);
  } else {
    parts.push(formatDiffValue(e.newValue));
  }
  return parts.join('\n');
}
</script>

<template>
  <div class="jd">
    <ToolInput title="JSON inputs" description="Paste two JSON documents to compare them.">
      <template #actions>
        <button
          class="jd__btn jd__btn--ghost"
          type="button"
          :disabled="leftInput.trim().length === 0 && rightInput.trim().length === 0"
          title="Swap left and right inputs"
          @click="swapInputs"
        >
          <ArrowLeftRight :size="14" />
          <span>Swap</span>
        </button>
        <button
          class="jd__btn"
          type="button"
          :disabled="leftInput.trim().length === 0 && rightInput.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Compare</span>
        </button>
      </template>

      <div class="jd__opts">
        <div class="jd__seg" role="group" aria-label="View mode">
          <button
            v-for="o in viewModeOptions"
            :key="o.value"
            type="button"
            class="jd__seg-btn"
            :class="{ 'jd__seg-btn--active': viewMode === o.value }"
            :aria-pressed="viewMode === o.value"
            @click="setViewMode(o.value)"
          >
            <component :is="o.icon" :size="13" />
            <span>{{ o.label }}</span>
          </button>
        </div>
        <button
          type="button"
          class="jd__toggle"
          :class="{ 'jd__toggle--active': showUnchanged }"
          :aria-pressed="showUnchanged"
          title="Show or hide unchanged entries"
          @click="toggleShowUnchanged"
        >
          <component :is="showUnchanged ? Eye : EyeOff" :size="13" />
          <span>{{ showUnchanged ? 'Hide unchanged' : 'Show unchanged' }}</span>
        </button>
      </div>

      <div class="jd__inputs" :class="{ 'jd__inputs--stack': viewMode === 'inline' }">
        <label class="jd__field">
          <span class="jd__label">Left JSON</span>
          <textarea
            class="jd__textarea jd__textarea--mono"
            placeholder='{"name":"alice","age":30}'
            :value="leftInput"
            rows="10"
            spellcheck="false"
            autocomplete="off"
            @input="onLeftInput"
          />
        </label>
        <label class="jd__field">
          <span class="jd__label">Right JSON</span>
          <textarea
            class="jd__textarea jd__textarea--mono"
            placeholder='{"name":"alice","age":31}'
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
      :description="outputs ? summary : 'Paste two JSON documents above to compare.'"
    >
      <p v-if="error" class="jd__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="jd__empty">Paste two JSON documents above to compare.</p>
        <template v-else>
          <!-- Side-by-side: pretty-printed panes -->
          <div v-if="viewMode === 'side-by-side'" class="jd__sbs">
            <div class="jd__sbs-pane">
              <div class="jd__sbs-head">
                <span class="jd__sbs-label">Left</span>
                <CopyButton :text="outputs.leftPretty" label="Copy" icon-only />
              </div>
              <pre v-if="outputs.leftPretty" class="jd__code">{{ outputs.leftPretty }}</pre>
              <p v-else class="jd__empty">Empty document.</p>
            </div>
            <div class="jd__sbs-pane">
              <div class="jd__sbs-head">
                <span class="jd__sbs-label">Right</span>
                <CopyButton :text="outputs.rightPretty" label="Copy" icon-only />
              </div>
              <pre v-if="outputs.rightPretty" class="jd__code">{{ outputs.rightPretty }}</pre>
              <p v-else class="jd__empty">Empty document.</p>
            </div>
          </div>

          <!-- Diff list -->
          <div class="jd__list">
            <div class="jd__list-head">
              <span class="jd__list-title">Path-based diff</span>
              <div class="jd__legend">
                <span v-for="t in (['added','removed','changed','unchanged'] as DiffType[])" :key="t" class="jd__chip" :class="typeMeta[t].cls">
                  <component :is="typeMeta[t].icon" :size="11" />
                  {{ typeMeta[t].label }} · {{ outputs.counts[t] }}
                </span>
              </div>
            </div>

            <p v-if="isIdentical" class="jd__empty jd__identical">
              <Equal :size="14" /> The two documents are identical.
            </p>
            <p v-else-if="visibleEntries.length === 0" class="jd__empty">
              No differences. Toggle "Show unchanged" to see all entries.
            </p>
            <ul v-else class="jd__rows">
              <li v-for="(e, i) in visibleEntries" :key="i" class="jd__row" :class="typeMeta[e.type].cls">
                <div class="jd__row-head">
                  <span class="jd__badge" :class="typeMeta[e.type].cls">
                    <component :is="typeMeta[e.type].icon" :size="11" />
                    {{ typeMeta[e.type].label }}
                  </span>
                  <code class="jd__path">{{ e.path }}</code>
                  <CopyButton :text="entryCopyText(e)" label="Copy" icon-only />
                </div>
                <div class="jd__row-body">
                  <template v-if="e.type === 'added'">
                    <pre class="jd__val jd__val--new">{{ formatDiffValue(e.newValue) }}</pre>
                  </template>
                  <template v-else-if="e.type === 'removed'">
                    <pre class="jd__val jd__val--old">{{ formatDiffValue(e.oldValue) }}</pre>
                  </template>
                  <template v-else-if="e.type === 'changed'">
                    <div class="jd__changed">
                      <div class="jd__changed-side">
                        <span class="jd__changed-tag">old</span>
                        <pre class="jd__val jd__val--old">{{ formatDiffValue(e.oldValue) }}</pre>
                      </div>
                      <span class="jd__arrow">→</span>
                      <div class="jd__changed-side">
                        <span class="jd__changed-tag">new</span>
                        <pre class="jd__val jd__val--new">{{ formatDiffValue(e.newValue) }}</pre>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <pre class="jd__val jd__val--same">{{ formatDiffValue(e.newValue) }}</pre>
                  </template>
                </div>
              </li>
            </ul>
          </div>
        </template>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.jd {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.jd__opts {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.jd__seg {
  display: inline-flex;
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  overflow: hidden;
  background: var(--qt-bg);
}
.jd__seg-btn {
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
.jd__seg-btn--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
}
.jd__toggle {
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
.jd__toggle--active {
  color: var(--qt-bg);
  background: var(--qt-accent);
  border-color: var(--qt-accent);
}
.jd__inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.jd__inputs--stack {
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 720px) {
  .jd__inputs {
    grid-template-columns: 1fr;
  }
}
.jd__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jd__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.jd__textarea {
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
.jd__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.jd__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.jd__btn {
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
.jd__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.jd__btn:active:not(:disabled) {
  transform: translateY(0);
}
.jd__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.jd__btn--ghost {
  background: var(--qt-bg);
  color: var(--qt-muted);
  border-color: var(--qt-border);
}
.jd__btn--ghost:hover:not(:disabled) {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.jd__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.jd__error strong {
  margin-right: 4px;
}
.jd__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.jd__identical {
  color: var(--qt-success, var(--qt-accent));
  font-weight: 600;
}

/* Side-by-side panes */
.jd__sbs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
@media (max-width: 720px) {
  .jd__sbs {
    grid-template-columns: 1fr;
  }
}
.jd__sbs-pane {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jd__sbs-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.jd__sbs-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.jd__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 50vh;
  overflow: auto;
}

/* Diff list */
.jd__list {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.jd__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.jd__list-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
.jd__legend {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.jd__chip {
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
.jd__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jd__row {
  border-left: 3px solid var(--qt-border);
  padding: 6px 8px 8px 10px;
  background: oklch(from var(--qt-surface) 98% c h);
  border-radius: 0 var(--qt-radius-sm) var(--qt-radius-sm) 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jd__row-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.jd__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--qt-bg);
  background: var(--qt-muted);
}
.jd__path {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  flex: 1;
  word-break: break-all;
}
.jd__row-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.jd__val {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  padding: 6px 8px;
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  max-height: 40vh;
  overflow: auto;
}
.jd__changed {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: stretch;
}
@media (max-width: 720px) {
  .jd__changed {
    grid-template-columns: 1fr;
  }
  .jd__arrow {
    display: none;
  }
}
.jd__changed-side {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.jd__changed-tag {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.jd__arrow {
  align-self: center;
  color: var(--qt-muted);
  font-size: 16px;
}

/* Type colour-coding (badges + row borders + value tints) */
.jd__type--added,
.jd__row.jd__type--added {
  border-left-color: oklch(from var(--qt-success, var(--qt-accent)) 60% c h);
}
.jd__type--added .jd__badge,
.jd__badge.jd__type--added,
.jd__chip.jd__type--added {
  background: oklch(from var(--qt-success, var(--qt-accent)) 60% c h);
  border-color: transparent;
}
.jd__val--new {
  border-color: oklch(from var(--qt-success, var(--qt-accent)) 60% c h / 0.4);
  background: oklch(from var(--qt-success, var(--qt-accent)) 95% c h / 0.15);
}

.jd__type--removed,
.jd__row.jd__type--removed {
  border-left-color: var(--qt-danger);
}
.jd__type--removed .jd__badge,
.jd__badge.jd__type--removed,
.jd__chip.jd__type--removed {
  background: var(--qt-danger);
  border-color: transparent;
}
.jd__val--old {
  border-color: oklch(from var(--qt-danger) 60% c h / 0.4);
  background: oklch(from var(--qt-danger) 95% c h / 0.15);
}

.jd__type--changed,
.jd__row.jd__type--changed {
  border-left-color: oklch(from var(--qt-warning, var(--qt-accent)) 70% c h);
}
.jd__type--changed .jd__badge,
.jd__badge.jd__type--changed,
.jd__chip.jd__type--changed {
  background: oklch(from var(--qt-warning, var(--qt-accent)) 70% c h);
  border-color: transparent;
}

.jd__type--unchanged,
.jd__row.jd__type--unchanged {
  border-left-color: var(--qt-border);
}
.jd__type--unchanged .jd__badge,
.jd__badge.jd__type--unchanged,
.jd__chip.jd__type--unchanged {
  background: var(--qt-muted);
  border-color: transparent;
}
.jd__val--same {
  opacity: 0.7;
}
</style>
