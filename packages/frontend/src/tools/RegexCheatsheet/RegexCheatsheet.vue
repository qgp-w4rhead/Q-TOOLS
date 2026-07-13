<script setup lang="ts">
/**
 * RegexCheatsheet — searchable, categorized regex syntax reference.
 *
 * A single search box matches against the token, description, example,
 * matches sample, and optional notes. Category chips (characters /
 * quantifiers / groups / lookaround / anchors / escapes / flags) restrict the
 * visible set. Each result row shows the token, description, example, sample
 * matches, optional notes, and a per-row copy button (copies the raw token).
 * A copy-all button exports the visible set as JSON.
 *
 * No external dependencies — the database is bundled in
 * `./regexCheatsheetDatabase.ts`.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the query
 * (accepts `query`, `search`, `token`, or `pattern`) and the category filter;
 * sends `output` PostMessages with the result list whenever it changes.
 */
import { computed } from 'vue';
import { Search } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useRegexCheatsheet } from './useRegexCheatsheet';
import {
  REGEX_CHEATSHEET_CATEGORY_LABELS,
  type RegexCheatsheetCategory,
} from './regexCheatsheetDatabase';

const {
  query,
  category,
  results,
  totalCount,
  categoryCounts,
  categories,
} = useRegexCheatsheet();

const hasQuery = computed(() => query.value.trim().length > 0);

function onQuery(e: Event): void {
  query.value = (e.target as HTMLInputElement).value;
}
function clearQuery(): void {
  query.value = '';
}
function selectCategory(c: typeof category.value): void {
  category.value = c;
}

function copyAllJson(): string {
  return JSON.stringify(
    results.value.map((e) => ({
      token: e.token,
      description: e.description,
      example: e.example,
      matches: e.matches,
      category: e.category,
      notes: e.notes ?? null,
    })),
    null,
    2,
  );
}
</script>

<template>
  <div class="rxc">
    <ToolInput
      title="Search"
      description="Search by token (\\d, (?=...)), description, example, or notes. Use the category chips to filter."
    >
      <div class="rxc__search">
        <Search :size="15" class="rxc__search-icon" />
        <input
          class="rxc__input"
          type="text"
          placeholder="\\d, (?&lt;=…), quantifier, lookahead …"
          :value="query"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onQuery"
        />
        <button
          v-if="hasQuery"
          type="button"
          class="rxc__clear"
          title="Clear"
          @click="clearQuery"
        >
          ×
        </button>
      </div>
      <div class="rxc__chips">
        <button
          type="button"
          class="rxc__chip"
          :class="{ 'rxc__chip--active': category === 'all' }"
          @click="selectCategory('all')"
        >
          All <span class="rxc__chip-count">{{ totalCount }}</span>
        </button>
        <button
          v-for="c in categories"
          :key="c"
          type="button"
          class="rxc__chip"
          :class="{ 'rxc__chip--active': category === c }"
          @click="selectCategory(c)"
        >
          {{ REGEX_CHEATSHEET_CATEGORY_LABELS[c] }}
          <span class="rxc__chip-count">{{ categoryCounts[c] }}</span>
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      title="Reference"
      :description="`${results.length} ${results.length === 1 ? 'entry' : 'entries'}${hasQuery ? ` matching “${query.trim()}”` : ''}${category !== 'all' ? ` in ${REGEX_CHEATSHEET_CATEGORY_LABELS[category as RegexCheatsheetCategory]}` : ''}`"
    >
      <template #actions>
        <CopyButton
          v-if="results.length > 0"
          :text="copyAllJson()"
          label="Copy all"
        />
      </template>

      <p v-if="results.length === 0" class="rxc__empty">
        No entries match <code class="rxc__code">{{ query }}</code>
        <template v-if="category !== 'all'"> in {{ REGEX_CHEATSHEET_CATEGORY_LABELS[category as RegexCheatsheetCategory] }}</template>.
      </p>

      <ul v-else class="rxc__list">
        <li
          v-for="entry in results"
          :key="entry.id"
          class="rxc__row"
        >
          <div class="rxc__body">
            <div class="rxc__head">
              <code class="rxc__token">{{ entry.token }}</code>
              <span class="rxc__cat">{{ REGEX_CHEATSHEET_CATEGORY_LABELS[entry.category] }}</span>
            </div>
            <p class="rxc__desc">{{ entry.description }}</p>
            <div class="rxc__meta">
              <span class="rxc__meta-label">Example</span>
              <code class="rxc__meta-value">{{ entry.example }}</code>
            </div>
            <div class="rxc__meta">
              <span class="rxc__meta-label">Matches</span>
              <code class="rxc__meta-value">{{ entry.matches }}</code>
            </div>
            <p v-if="entry.notes" class="rxc__notes">{{ entry.notes }}</p>
          </div>
          <CopyButton
            :text="entry.token"
            label=""
            icon-only
          />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.rxc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.rxc__search {
  position: relative;
  display: flex;
  align-items: center;
}
.rxc__search-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
.rxc__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 36px 10px 36px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.rxc__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.rxc__clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--qt-muted);
  font-size: 18px;
  line-height: 1;
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.rxc__clear:hover {
  color: var(--qt-text);
  background: var(--qt-surface);
}
.rxc__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.rxc__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-text);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.rxc__chip:hover {
  border-color: var(--qt-accent);
}
.rxc__chip--active {
  background: oklch(from var(--qt-accent) 95% c h);
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.rxc__chip-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.rxc__chip--active .rxc__chip-count {
  color: inherit;
  opacity: 0.7;
}
.rxc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.rxc__code {
  margin: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
}
.rxc__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rxc__row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 12px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  transition: border-color 0.15s ease;
}
.rxc__row:hover {
  border-color: var(--qt-accent);
}
.rxc__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.rxc__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rxc__token {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--qt-text);
  background: oklch(from var(--qt-surface) 95% c h);
  padding: 2px 8px;
  border-radius: var(--qt-radius-sm);
  word-break: break-all;
}
.rxc__cat {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.rxc__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--qt-text);
  word-break: break-word;
}
.rxc__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.rxc__meta-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
  min-width: 64px;
}
.rxc__meta-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  background: oklch(from var(--qt-surface) 92% c h);
  padding: 1px 6px;
  border-radius: var(--qt-radius-sm);
  word-break: break-all;
}
.rxc__notes {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--qt-muted);
  word-break: break-word;
}
@media (max-width: 720px) {
  .rxc__row {
    grid-template-columns: 1fr;
    grid-template-areas:
      'body'
      'copy';
    row-gap: 8px;
  }
  .rxc__body { grid-area: body; }
  .rxc__row :deep(.copy-btn) { grid-area: copy; justify-self: end; }
}
</style>
