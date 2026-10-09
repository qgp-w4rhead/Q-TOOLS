<script setup lang="ts">
/**
 * TextDiff - compare two text blocks and visualise the differences.
 *
 * Uses the lazy-loaded `diff` package (JsDiff) to compute a diff at the
 * chosen granularity (characters, words, lines or sentences). Three output
 * views are supported:
 *   - **Inline** - a single highlighted stream (green additions, red
 *     removals) wrapping each change run in a span.
 *   - **Side-by-side** - two aligned columns with line numbers; adjacent
 *     removed+added runs are paired as "modified" rows.
 *   - **Unified patch** - a monospace unified-diff text block (copyable).
 *
 * Options: ignore case, ignore leading/trailing whitespace on lines.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill either text
 * pane (`left`/`right`, `leftInput`/`rightInput`, `text1`/`text2`, or generic
 * `input`/`value`/`content` → left) and to set granularity / view mode /
 * options, and sends `output` PostMessages whenever the computed diff changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.text-diff.ui.';

const granularityOptions = computed<Array<{
  value: DiffGranularity;
  label: string;
}>>(() => [
  { value: 'lines', label: t(U + 'granLines') },
  { value: 'words', label: t(U + 'granWords') },
  { value: 'chars', label: t(U + 'granChars') },
  { value: 'sentences', label: t(U + 'granSentences') },
]);

const viewModeOptions = computed<Array<{
  value: DiffViewMode;
  label: string;
  icon: typeof List;
}>>(() => [
  { value: 'side-by-side', label: t(U + 'viewSideBySide'), icon: Columns2 },
  { value: 'inline', label: t(U + 'viewInline'), icon: List },
  { value: 'unified', label: t(U + 'viewUnified'), icon: FileDiff },
]);

const summary = computed(() => {
  if (!outputs.value) return '';
  const c = outputs.value.counts;
  const parts: string[] = [];
  if (c.added) parts.push(t(U + 'sumAdded', { n: c.added }));
  if (c.removed) parts.push(t(U + 'sumRemoved', { n: c.removed }));
  if (c.unchanged) parts.push(t(U + 'sumUnchanged', { n: c.unchanged }));
  if (parts.length === 0) return t(U + 'sumIdentical');
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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--ghost"
          type="button"
          :disabled="!hasInput"
          :title="t(U + 'swapTitle')"
          @click="swapInputs"
        >
          <ArrowLeftRight :size="14" />
          <span>{{ t(U + 'swap') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="!hasInput || loading"
          @click="recompute"
        >
          <Loader2 v-if="loading" :size="14" class="qt-spin" />
          <RefreshCw v-else :size="14" />
          <span>{{ t(U + 'compare') }}</span>
        </button>
      </template>

      <div class="qt-row qt-row--center" style="--qt-row-gap:12px">
        <div class="td__seg" role="group" :aria-label="t(U + 'ariaGranularity')">
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
        <div class="td__seg" role="group" :aria-label="t(U + 'ariaViewMode')">
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
        <div class="qt-row" style="--qt-row-gap:8px">
          <button
            type="button"
            class="td__toggle"
            :class="{ 'td__toggle--active': ignoreCase }"
            :aria-pressed="ignoreCase"
            :title="t(U + 'ignoreCaseTitle')"
            @click="ignoreCase = !ignoreCase"
          >
            <component :is="ignoreCase ? CaseUpper : CaseSensitive" :size="13" />
            <span>{{ t(U + 'ignoreCase') }}</span>
          </button>
          <button
            type="button"
            class="td__toggle"
            :class="{ 'td__toggle--active': ignoreWhitespace }"
            :aria-pressed="ignoreWhitespace"
            :title="t(U + 'ignoreWhitespaceTitle')"
            @click="ignoreWhitespace = !ignoreWhitespace"
          >
            <Space :size="13" />
            <span>{{ t(U + 'ignoreWhitespace') }}</span>
          </button>
        </div>
      </div>

      <div class="td__inputs">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'originalText') }}</span>
          <textarea
            class="qt-input qt-input--mono"
            style="padding:10px 12px;min-height:180px"
            :placeholder="t(U + 'originalPlaceholder')"
            :value="leftInput"
            rows="10"
            spellcheck="false"
            autocomplete="off"
            @input="onLeftInput"
          />
        </label>
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'modifiedText') }}</span>
          <textarea
            class="qt-input qt-input--mono"
            style="padding:10px 12px;min-height:180px"
            :placeholder="t(U + 'modifiedPlaceholder')"
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
      <p v-if="!outputs && !loading" class="qt-alert qt-alert--empty">
        {{ t(U + 'descEmpty') }}
      </p>
      <p v-else-if="loading && !outputs" class="qt-alert qt-alert--empty">
        <Loader2 :size="14" class="qt-spin" /> {{ t(U + 'computing') }}
      </p>
      <template v-else-if="outputs">
        <!-- Inline view -->
        <div v-if="viewMode === 'inline'">
          <p v-if="isIdentical" class="qt-alert qt-alert--success">
            <Equal :size="14" /> {{ t(U + 'identical') }}
          </p>
          <div v-else class="td__inline-stream" v-html="outputs.inlineHtml" />
        </div>

        <!-- Side-by-side view -->
        <div v-else-if="viewMode === 'side-by-side'">
          <p v-if="isIdentical" class="qt-alert qt-alert--success">
            <Equal :size="14" /> {{ t(U + 'identical') }}
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
        <div v-else>
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px;margin-bottom:6px;flex-wrap:nowrap">
            <span style="font-size:12.5px;font-weight:600;color:var(--qt-text);flex:1">{{ t(U + 'unifiedDiff') }}</span>
            <CopyButton :text="outputs.unifiedPatch" :label="t(U + 'copyPatch')" />
          </div>
          <pre v-if="outputs.unifiedPatch.trim().length > 0" class="td__unified-code">{{
            outputs.unifiedPatch
          }}</pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'noPatch') }}</p>
        </div>

        <!-- Legend -->
        <div class="qt-row qt-row--center" style="--qt-row-gap:6px;margin-top:8px">
          <span class="qt-badge qt-badge--success">
            <Plus :size="11" /> {{ t(U + 'badgeAdded', { n: outputs.counts.added }) }}
          </span>
          <span class="qt-badge qt-badge--error">
            <Minus :size="11" /> {{ t(U + 'badgeRemoved', { n: outputs.counts.removed }) }}
          </span>
          <span class="qt-badge qt-badge--muted">
            <Equal :size="11" /> {{ t(U + 'badgeUnchanged', { n: outputs.counts.unchanged }) }}
          </span>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Pill segmented control — rounded-999 joined group (vs .qt-seg rounded-sm). */
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

/* Toggle pill — rounded-999 toggle chip with solid-accent active. */
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

/* 2-col input grid — collapses to stacked on narrow. */
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

/* Inline diff stream — mono block + :deep() add/del/keep highlights. */
.td__inline-stream {
  font-family: var(--qt-font-mono);
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

/* Side-by-side diff table — line numbers + added/removed/modified cells. */
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
  font-family: var(--qt-font-mono);
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

/* Unified patch code block — mono scrollable <pre>. */
.td__unified-code {
  font-family: var(--qt-font-mono);
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
</style>
