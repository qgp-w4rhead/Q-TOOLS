<script setup lang="ts">
/**
 * HttpStatusCodes — searchable, filterable HTTP status code reference.
 *
 * A single search box matches against the numeric code, name, and
 * description. Category chips (1xx/2xx/3xx/4xx/5xx) restrict the visible
 * set. Each result row shows the code, name, description, category colour,
 * and an official/unofficial badge. Per-row copy + copy-all.
 *
 * No external dependencies — the database is bundled in
 * `./httpStatusDatabase.ts` (60+ codes spanning IANA-registered and common
 * unofficial vendor codes).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the query
 * (accepts `query`, `search`, or `code`) and the category filter; sends
 * `output` PostMessages with the result list whenever it changes.
 */
import { computed } from 'vue';
import { Search, ShieldCheck, ShieldAlert } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useHttpStatusCodes } from './useHttpStatusCodes';
import type { HttpStatusCategory } from './httpStatusDatabase';

const {
  query,
  category,
  results,
  totalCount,
  categoryCounts,
  categories,
} = useHttpStatusCodes();

const hasQuery = computed(() => query.value.trim().length > 0);

const categoryColors: Record<HttpStatusCategory, string> = {
  '1xx': 'oklch(from var(--qt-accent) 70% 0.12 220)',
  '2xx': 'oklch(from var(--qt-accent) 65% 0.18 145)',
  '3xx': 'oklch(from var(--qt-accent) 70% 0.16 75)',
  '4xx': 'oklch(from var(--qt-accent) 65% 0.20 30)',
  '5xx': 'oklch(from var(--qt-accent) 60% 0.22 350)',
};

const categoryLabels: Record<HttpStatusCategory, string> = {
  '1xx': 'Informational',
  '2xx': 'Success',
  '3xx': 'Redirection',
  '4xx': 'Client Error',
  '5xx': 'Server Error',
};

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
      code: e.code,
      name: e.name,
      description: e.description,
      category: e.category,
      official: e.official,
    })),
    null,
    2,
  );
}
</script>

<template>
  <div class="http">
    <ToolInput
      title="Search"
      description="Search by code (404), name (Not Found), or description. Use the category chips to filter."
    >
      <div class="http__search">
        <Search :size="15" class="http__search-icon" />
        <input
          class="http__input"
          type="text"
          inputmode="numeric"
          placeholder="404, Not Found, rate limit …"
          :value="query"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onQuery"
        />
        <button
          v-if="hasQuery"
          type="button"
          class="http__clear"
          title="Clear"
          @click="clearQuery"
        >
          ×
        </button>
      </div>
      <div class="http__chips">
        <button
          type="button"
          class="http__chip"
          :class="{ 'http__chip--active': category === 'all' }"
          @click="selectCategory('all')"
        >
          All <span class="http__chip-count">{{ totalCount }}</span>
        </button>
        <button
          v-for="c in categories"
          :key="c"
          type="button"
          class="http__chip"
          :class="{ 'http__chip--active': category === c }"
          :style="category === c ? { borderColor: categoryColors[c], color: categoryColors[c] } : {}"
          @click="selectCategory(c)"
        >
          {{ c }}
          <span class="http__chip-count">{{ categoryCounts[c] }}</span>
        </button>
      </div>
    </ToolInput>

    <ToolOutput
      title="Status codes"
      :description="`${results.length} ${results.length === 1 ? 'code' : 'codes'}${hasQuery ? ` matching “${query.trim()}”` : ''}${category !== 'all' ? ` in ${category}` : ''}`"
    >
      <template #actions>
        <CopyButton
          v-if="results.length > 0"
          :text="copyAllJson()"
          label="Copy all"
        />
      </template>

      <p v-if="results.length === 0" class="http__empty">
        No status codes match <code class="http__code">{{ query }}</code>
        <template v-if="category !== 'all'"> in {{ category }}</template>.
      </p>

      <ul v-else class="http__list">
        <li
          v-for="entry in results"
          :key="entry.code"
          class="http__row"
        >
          <span
            class="http__code-badge"
            :style="{
              color: categoryColors[entry.category],
              borderColor: categoryColors[entry.category],
            }"
          >
            {{ entry.code }}
          </span>
          <div class="http__body">
            <div class="http__head">
              <span class="http__name">{{ entry.name }}</span>
              <span
                class="http__cat"
                :style="{ color: categoryColors[entry.category] }"
              >
                {{ categoryLabels[entry.category] }}
              </span>
              <span
                class="http__official"
                :class="entry.official ? 'http__official--on' : 'http__official--off'"
                :title="entry.official ? 'IANA-registered in an active RFC' : 'Unofficial / vendor-specific code'"
              >
                <ShieldCheck v-if="entry.official" :size="11" />
                <ShieldAlert v-else :size="11" />
                {{ entry.official ? 'official' : 'unofficial' }}
              </span>
            </div>
            <p class="http__desc">{{ entry.description }}</p>
          </div>
          <CopyButton
            :text="`${entry.code} ${entry.name}`"
            label=""
            icon-only
          />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.http {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.http__search {
  position: relative;
  display: flex;
  align-items: center;
}
.http__search-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
.http__input {
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
.http__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.http__clear {
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
.http__clear:hover {
  color: var(--qt-text);
  background: var(--qt-surface);
}
.http__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.http__chip {
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
.http__chip:hover {
  border-color: var(--qt-accent);
}
.http__chip--active {
  background: oklch(from var(--qt-accent) 95% c h);
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.http__chip-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-muted);
  font-variant-numeric: tabular-nums;
}
.http__chip--active .http__chip-count {
  color: inherit;
  opacity: 0.7;
}
.http__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.http__code {
  margin: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
}
.http__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.http__row {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  align-items: start;
  gap: 12px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  transition: border-color 0.15s ease;
}
.http__row:hover {
  border-color: var(--qt-accent);
}
.http__code-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  border: 1px solid;
  border-radius: var(--qt-radius-sm);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: oklch(from var(--qt-surface) 95% c h);
}
.http__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.http__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.http__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
}
.http__cat {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.http__official {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--qt-border);
}
.http__official--on {
  color: oklch(from var(--qt-accent) 60% 0.16 145);
  border-color: oklch(from var(--qt-accent) 60% 0.16 145 / 0.4);
}
.http__official--off {
  color: var(--qt-muted);
}
.http__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--qt-muted);
  word-break: break-word;
}
@media (max-width: 720px) {
  .http__row {
    grid-template-columns: 56px 1fr;
    grid-template-areas:
      'code body'
      'copy copy';
    row-gap: 8px;
  }
  .http__code-badge { grid-area: code; }
  .http__body { grid-area: body; }
  .http__row :deep(.copy-btn) { grid-area: copy; justify-self: end; }
}
</style>
