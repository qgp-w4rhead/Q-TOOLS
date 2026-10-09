<script setup lang="ts">
/**
 * JsonDiff - compare two JSON documents and show a path-based visual diff.
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
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.json-diff.ui.';

const viewModeOptions: Array<{ value: DiffViewMode; labelKey: string; icon: typeof List }> = [
  { value: 'inline', labelKey: 'viewInline', icon: List },
  { value: 'side-by-side', labelKey: 'viewSideBySide', icon: Columns2 },
];

const typeMeta: Record<DiffType, { labelKey: string; icon: typeof Plus; cls: string }> = {
  added: { labelKey: 'typeAdded', icon: Plus, cls: 'jd__type--added' },
  removed: { labelKey: 'typeRemoved', icon: Minus, cls: 'jd__type--removed' },
  changed: { labelKey: 'typeChanged', icon: Pencil, cls: 'jd__type--changed' },
  unchanged: { labelKey: 'typeUnchanged', icon: Equal, cls: 'jd__type--unchanged' },
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
  if (c.added) parts.push(t(U + 'countAdded', c.added));
  if (c.removed) parts.push(t(U + 'countRemoved', c.removed));
  if (c.changed) parts.push(t(U + 'countChanged', c.changed));
  if (c.unchanged) parts.push(t(U + 'countUnchanged', c.unchanged));
  if (parts.length === 0) return t(U + 'identicalSummary');
  return parts.join(' · ');
});

const isIdentical = computed(
  () => !!outputs.value && outputs.value.counts.added === 0 && outputs.value.counts.removed === 0 && outputs.value.counts.changed === 0,
);

const errorLocation = computed(() => {
  if (!error.value) return '';
  const e = error.value;
  const side = e.side === 'left' ? t(U + 'sideLeft') : t(U + 'sideRight');
  if (e.line != null && e.column != null) {
    return t(U + 'errSideLineCol', { side, line: e.line, col: e.column });
  }
  if (e.line != null) return t(U + 'errSideLine', { side, line: e.line });
  return side;
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
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :disabled="leftInput.trim().length === 0 && rightInput.trim().length === 0"
          :title="t(U + 'swapTitle')"
          @click="swapInputs"
        >
          <ArrowLeftRight :size="14" />
          <span>{{ t('common.swap') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="leftInput.trim().length === 0 && rightInput.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t(U + 'compare') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:12px">
        <div class="qt-seg" role="group" :aria-label="t(U + 'viewMode')">
          <button
            v-for="o in viewModeOptions"
            :key="o.value"
            type="button"
            class="qt-seg__btn"
            :class="{ 'qt-seg__btn--active': viewMode === o.value }"
            :aria-pressed="viewMode === o.value"
            @click="setViewMode(o.value)"
          >
            <component :is="o.icon" :size="13" />
            <span>{{ t(U + o.labelKey) }}</span>
          </button>
        </div>
        <button
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--solid': showUnchanged }"
          :aria-pressed="showUnchanged"
          :title="t(U + 'showUnchangedTitle')"
          @click="toggleShowUnchanged"
        >
          <component :is="showUnchanged ? Eye : EyeOff" :size="13" />
          <span>{{ showUnchanged ? t(U + 'hideUnchanged') : t(U + 'showUnchanged') }}</span>
        </button>
      </div>

      <div class="qt-grid" style="--qt-grid-min:280px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'leftJson') }}</span>
          <textarea
            class="qt-input qt-input--mono jd__textarea"
            placeholder='{"name":"alice","age":30}'
            :value="leftInput"
            rows="10"
            spellcheck="false"
            autocomplete="off"
            @input="onLeftInput"
          />
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'rightJson') }}</span>
          <textarea
            class="qt-input qt-input--mono jd__textarea"
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
      :title="t(U + 'outputTitle')"
      :description="outputs ? summary : t(U + 'descEmpty')"
    >
      <p v-if="error" class="qt-alert qt-alert--error jd__error">
        <AlertCircle :size="14" />
        <span>
          <strong v-if="errorLocation">{{ errorLocation }}:</strong>
          {{ error.message }}
        </span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">{{ t(U + 'empty') }}</p>
        <template v-else>
          <!-- Side-by-side: pretty-printed panes -->
          <div v-if="viewMode === 'side-by-side'" class="qt-grid" style="--qt-grid-min:280px;--qt-grid-gap:12px;margin-bottom:12px">
            <div class="qt-result jd__sbs-pane">
              <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
                <span class="qt-label" style="flex:1;color:var(--qt-text)">{{ t(U + 'sideLeft') }}</span>
                <CopyButton :text="outputs.leftPretty" icon-only />
              </div>
              <pre v-if="outputs.leftPretty" class="qt-mono jd__code">{{ outputs.leftPretty }}</pre>
              <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyDoc') }}</p>
            </div>
            <div class="qt-result jd__sbs-pane">
              <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
                <span class="qt-label" style="flex:1;color:var(--qt-text)">{{ t(U + 'sideRight') }}</span>
                <CopyButton :text="outputs.rightPretty" icon-only />
              </div>
              <pre v-if="outputs.rightPretty" class="qt-mono jd__code">{{ outputs.rightPretty }}</pre>
              <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyDoc') }}</p>
            </div>
          </div>

          <!-- Diff list -->
          <div class="qt-result jd__list">
            <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:12px">
              <span class="qt-label" style="color:var(--qt-text)">{{ t(U + 'pathDiff') }}</span>
              <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
                <span v-for="dt in (['added','removed','changed','unchanged'] as DiffType[])" :key="dt" class="jd__chip" :class="typeMeta[dt].cls">
                  <component :is="typeMeta[dt].icon" :size="11" />
                  {{ t(U + typeMeta[dt].labelKey) }} · {{ outputs.counts[dt] }}
                </span>
              </div>
            </div>

            <p v-if="isIdentical" class="qt-alert qt-alert--empty jd__identical">
              <Equal :size="14" /> {{ t(U + 'identical') }}
            </p>
            <p v-else-if="visibleEntries.length === 0" class="qt-alert qt-alert--empty">
              {{ t(U + 'noDifferences') }}
            </p>
            <ul v-else class="qt-list qt-stack" style="--qt-stack-gap:6px">
              <li v-for="(e, i) in visibleEntries" :key="i" class="jd__row" :class="typeMeta[e.type].cls">
                <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
                  <span class="jd__badge" :class="typeMeta[e.type].cls">
                    <component :is="typeMeta[e.type].icon" :size="11" />
                    {{ t(U + typeMeta[e.type].labelKey) }}
                  </span>
                  <code class="qt-mono jd__path">{{ e.path }}</code>
                  <CopyButton :text="entryCopyText(e)" icon-only />
                </div>
                <div class="qt-stack" style="--qt-stack-gap:4px">
                  <template v-if="e.type === 'added'">
                    <pre class="jd__val jd__val--new">{{ formatDiffValue(e.newValue) }}</pre>
                  </template>
                  <template v-else-if="e.type === 'removed'">
                    <pre class="jd__val jd__val--old">{{ formatDiffValue(e.oldValue) }}</pre>
                  </template>
                  <template v-else-if="e.type === 'changed'">
                    <div class="jd__changed">
                      <div class="qt-stack jd__changed-side" style="--qt-stack-gap:4px">
                        <span class="qt-stat-head">{{ t(U + 'old') }}</span>
                        <pre class="jd__val jd__val--old">{{ formatDiffValue(e.oldValue) }}</pre>
                      </div>
                      <span class="jd__arrow">→</span>
                      <div class="qt-stack jd__changed-side" style="--qt-stack-gap:4px">
                        <span class="qt-stat-head">{{ t(U + 'new') }}</span>
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
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Input textarea floor (control + mono via .qt-input--mono). */
.jd__textarea {
  min-height: 180px;
}
/* Error location prefix (alert via .qt-alert--error). */
.jd__error strong {
  margin-right: 4px;
}
/* Identical-documents note (alert via .qt-alert--empty) — success tint. */
.jd__identical {
  color: var(--qt-success, var(--qt-accent));
  font-weight: 600;
}

/* Side-by-side pane (base via .qt-result) — tighter padding + gap. */
.jd__sbs-pane {
  gap: 6px;
  padding: 8px 10px;
}
/* Pretty-printed pane code (font via .qt-mono) — capped, scrollable. */
.jd__code {
  font-size: 13px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 50vh;
  overflow: auto;
}

/* Diff list card (base via .qt-result) — roomier padding + gap. */
.jd__list {
  gap: 10px;
  padding: 10px 12px;
}
/* Legend chip — count pill, colour-coded by diff type below. */
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
/* Diff entry row — left border colour-coded by type below. */
.jd__row {
  border-left: 3px solid var(--qt-border);
  padding: 6px 8px 8px 10px;
  background: oklch(from var(--qt-surface) 98% c h);
  border-radius: 0 var(--qt-radius-sm) var(--qt-radius-sm) 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* Type badge — solid pill, colour-coded by diff type below. */
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
/* Entry path (font via .qt-mono) — grows to fill the row. */
.jd__path {
  font-size: 12.5px;
  color: var(--qt-text);
  flex: 1;
  word-break: break-all;
}
/* Value block (font via .qt-mono) — bordered, capped, scrollable. */
.jd__val {
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
/* Changed entries — old → new 3-col grid. */
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
  min-width: 0;
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
