<script setup lang="ts">
/**
 * GitCheatsheet — searchable, categorized Git command reference.
 *
 * A single search box matches against the command and description (and
 * optional notes). Category chips (setup / branching / committing / merging
 * / rebasing / stashing / remote / config) restrict the visible set. Each
 * result row shows the command, description, optional notes, and a per-row
 * copy button. A copy-all button exports the visible set as JSON.
 *
 * No external dependencies — the database is bundled in
 * `./gitCheatsheetDatabase.ts`.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the query
 * (accepts `query`, `search`, or `command`) and the category filter; sends
 * `output` PostMessages with the result list whenever it changes.
 */
import { computed } from 'vue';
import { Search } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useGitCheatsheet } from './useGitCheatsheet';
import {
  GIT_CHEATSHEET_CATEGORY_LABELS,
  type GitCheatsheetCategory,
} from './gitCheatsheetDatabase';

const {
  query,
  category,
  results,
  totalCount,
  categoryCounts,
  categories,
} = useGitCheatsheet();

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
      command: e.command,
      description: e.description,
      category: e.category,
      notes: e.notes ?? null,
    })),
    null,
    2,
  );
}
</script>

<template>
  <div class="git">
    <ToolInput
      title="Search"
      description="Search by command (git rebase), description, or notes. Use the category chips to filter."
    >
      <div class="git__search">
        <Search :size="15" class="git__search-icon" />
        <input
          class="git__input"
          type="text"
          placeholder="git rebase, stash, merge …"
          :value="query"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onQuery"
        />
        <button
          v-if="hasQuery"
          type="button"
          class="git__clear"
          title="Clear"
          @click="clearQuery"
        >
          ×
        </button>
      </div>
      <div class="git__chips">
        <button
          type="button"
          class="git__chip"
          :class="{ 'git__chip--active': category === 'all' }"
          @click="selectCategory('all')"
        >
          All <span class="git__chip-count">{{ totalCount }}</span>
        </button>
        <button
          v-for="c in categories"
          :key="c"
          type="button"
          class="git__chip"
          :class="{ 'git__chip--active': category === c }"
          @click="selectCategory(c)"
        >
          {{ GIT_CHEATSHEET_CATEGORY_LABELS[c] }}
          <span class="git__chip-count">{{ categoryCounts[c] }}</span>
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      title="Commands"
      :description="`${results.length} ${results.length === 1 ? 'command' : 'commands'}${hasQuery ? ` matching “${query.trim()}”` : ''}${category !== 'all' ? ` in ${GIT_CHEATSHEET_CATEGORY_LABELS[category as GitCheatsheetCategory]}` : ''}`"
    >
      <template #actions>
        <CopyButton
          v-if="results.length > 0"
          :text="copyAllJson()"
          label="Copy all"
        />
      </template>

      <p v-if="results.length === 0" class="git__empty">
        No commands match <code class="git__code">{{ query }}</code>
        <template v-if="category !== 'all'"> in {{ GIT_CHEATSHEET_CATEGORY_LABELS[category as GitCheatsheetCategory] }}</template>.
      </p>

      <ul v-else class="git__list">
        <li
          v-for="entry in results"
          :key="entry.id"
          class="git__row"
        >
          <div class="git__body">
            <div class="git__head">
              <code class="git__cmd">{{ entry.command }}</code>
              <span class="git__cat">{{ GIT_CHEATSHEET_CATEGORY_LABELS[entry.category] }}</span>
            </div>
            <p class="git__desc">{{ entry.description }}</p>
            <p v-if="entry.notes" class="git__notes">{{ entry.notes }}</p>
          </div>
          <CopyButton
            :text="entry.command"
            label=""
            icon-only
          />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.git {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.git__search {
  position: relative;
  display: flex;
  align-items: center;
}
.git__search-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
.git__input {
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
.git__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.git__clear {
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
.git__clear:hover {
  color: var(--qt-text);
  background: var(--qt-surface);
}
.git__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.git__chip {
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
.git__chip:hover {
  border-color: var(--qt-accent);
}
.git__chip--active {
  background: oklch(from var(--qt-accent) 95% c h);
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.git__chip-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.git__chip--active .git__chip-count {
  color: inherit;
  opacity: 0.7;
}
.git__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.git__code {
  margin: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
}
.git__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.git__row {
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
.git__row:hover {
  border-color: var(--qt-accent);
}
.git__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.git__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.git__cmd {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--qt-text);
  background: oklch(from var(--qt-surface) 95% c h);
  padding: 2px 8px;
  border-radius: var(--qt-radius-sm);
  word-break: break-all;
}
.git__cat {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.git__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--qt-text);
  word-break: break-word;
}
.git__notes {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--qt-muted);
  word-break: break-word;
}
@media (max-width: 720px) {
  .git__row {
    grid-template-columns: 1fr;
    grid-template-areas:
      'body'
      'copy';
    row-gap: 8px;
  }
  .git__body { grid-area: body; }
  .git__row :deep(.copy-btn) { grid-area: copy; justify-self: end; }
}
</style>
