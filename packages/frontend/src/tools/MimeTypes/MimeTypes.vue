<script setup lang="ts">
/**
 * MimeTypes — bidirectional MIME type ↔ file extension lookup.
 *
 * A single search box auto-detects whether the query is an extension
 * (`.txt`, `txt`, `*.js`) or a MIME type (`text/plain`,
 * `Content-Type: application/json; charset=utf-8`). Exact matches show the
 * canonical MIME type, human-readable name, category badge, and (for MIME
 * queries) the list of associated extensions. Misses fall back to a fuzzy
 * substring search across extensions, MIME types, and names.
 *
 * No external dependencies — the database is bundled in
 * `./mimeDatabase.ts` (~300+ common types).
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the query
 * (accepts `query`, `extension`, or `mime`); sends `output` PostMessages with
 * the lookup result whenever it changes.
 */
import { computed } from 'vue';
import { Search, FileText, Hash, Files } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useMimeTypes } from './useMimeTypes';
import type { MimeCategory } from './mimeDatabase';

const {
  query,
  result,
  totalCount,
  extensionCount,
  mimeCount,
} = useMimeTypes();

const hasQuery = computed(() => query.value.trim().length > 0);

const categoryColors: Record<MimeCategory, string> = {
  text: 'var(--qt-accent)',
  image: 'oklch(from var(--qt-accent) 65% 0.18 145)',
  audio: 'oklch(from var(--qt-accent) 65% 0.20 290)',
  video: 'oklch(from var(--qt-accent) 60% 0.20 320)',
  application: 'oklch(from var(--qt-accent) 70% 0.15 220)',
  font: 'oklch(from var(--qt-accent) 70% 0.18 60)',
  archive: 'oklch(from var(--qt-accent) 60% 0.18 30)',
  document: 'oklch(from var(--qt-accent) 55% 0.20 200)',
  code: 'oklch(from var(--qt-accent) 72% 0.17 85)',
  binary: 'var(--qt-muted)',
};

function onQuery(e: Event): void {
  query.value = (e.target as HTMLInputElement).value;
}
function clearQuery(): void {
  query.value = '';
}
function pickHit(ext: string): void {
  query.value = `.${ext}`;
}
</script>

<template>
  <div class="mime">
    <ToolInput
      title="Search"
      description="Type a file extension (.txt, js) or a MIME type (text/plain). Fuzzy search falls back across the whole database."
    >
      <div class="mime__search">
        <Search :size="15" class="mime__search-icon" />
        <input
          class="mime__input"
          type="text"
          placeholder=".txt, json, application/pdf, image/png …"
          :value="query"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onQuery"
        />
        <button
          v-if="hasQuery"
          type="button"
          class="mime__clear"
          title="Clear"
          @click="clearQuery"
        >
          ×
        </button>
      </div>
      <div class="mime__stats">
        <span><Hash :size="11" /> {{ extensionCount }} extensions</span>
        <span><FileText :size="11" /> {{ mimeCount }} MIME types</span>
        <span><Files :size="11" /> {{ totalCount }} entries</span>
      </div>
    </ToolInput>

    <ToolOutput
      title="Result"
      :description="hasQuery ? 'Lookup result for your query.' : 'Type an extension or MIME type above to look it up.'"
    >
      <template v-if="!hasQuery">
        <p class="mime__empty">
          Type an extension or MIME type above to look it up.
        </p>
        <div class="mime__examples">
          <span class="mime__examples-label">Try:</span>
          <button
            v-for="ex in ['.json', 'application/pdf', 'image/png', '.ts', 'text/markdown']"
            :key="ex"
            type="button"
            class="mime__example-chip"
            @click="query = ex"
          >
            {{ ex }}
          </button>
        </div>
      </template>

      <template v-else-if="result.kind === 'extension'">
        <div class="mime__exact">
          <div class="mime__exact-head">
            <span class="mime__ext-badge">.{{ result.extension }}</span>
            <span
              class="mime__cat-badge"
              :style="{ color: categoryColors[result.entry.category], borderColor: categoryColors[result.entry.category] }"
            >
              {{ result.entry.category }}
            </span>
          </div>
          <div class="mime__exact-name">{{ result.entry.name }}</div>
          <div class="mime__exact-row">
            <span class="mime__exact-label">MIME type</span>
            <code class="mime__code mime__code--accent">{{ result.mime }}</code>
            <CopyButton :text="result.mime" label="Copy" icon-only />
          </div>
        </div>
      </template>

      <template v-else-if="result.kind === 'mime'">
        <div class="mime__exact">
          <div class="mime__exact-head">
            <span
              class="mime__cat-badge"
              :style="{ color: categoryColors[result.entry.category], borderColor: categoryColors[result.entry.category] }"
            >
              {{ result.entry.category }}
            </span>
          </div>
          <div class="mime__exact-name">{{ result.entry.name }}</div>
          <div class="mime__exact-row">
            <span class="mime__exact-label">MIME type</span>
            <code class="mime__code mime__code--accent">{{ result.mime }}</code>
            <CopyButton :text="result.mime" label="Copy" icon-only />
          </div>
          <div class="mime__ext-list">
            <span class="mime__exact-label">Extensions</span>
            <div class="mime__ext-chips">
              <span
                v-for="ext in result.extensions"
                :key="ext"
                class="mime__ext-chip"
              >
                .{{ ext }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="result.kind === 'search'">
        <p class="mime__search-hint">
          No exact match — showing {{ result.hits.length }} fuzzy
          {{ result.hits.length === 1 ? 'hit' : 'hits' }} for
          <code class="mime__code">{{ result.query }}</code>.
        </p>
        <ul class="mime__hit-list">
          <li
            v-for="hit in result.hits"
            :key="hit.ext + '|' + hit.mime"
            class="mime__hit"
            @click="pickHit(hit.ext)"
          >
            <span class="mime__hit-ext">.{{ hit.ext }}</span>
            <code class="mime__hit-mime">{{ hit.mime }}</code>
            <span class="mime__hit-name">{{ hit.name }}</span>
            <span
              class="mime__hit-cat"
              :style="{ color: categoryColors[hit.category] }"
            >
              {{ hit.category }}
            </span>
            <CopyButton :text="hit.mime" label="" icon-only />
          </li>
        </ul>
      </template>

      <template v-else>
        <p class="mime__empty">
          No match for <code class="mime__code">{{ result.query }}</code>.
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.mime {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.mime__search {
  position: relative;
  display: flex;
  align-items: center;
}
.mime__search-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
.mime__input {
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
.mime__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.mime__clear {
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
.mime__clear:hover {
  color: var(--qt-text);
  background: var(--qt-surface);
}
.mime__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--qt-muted);
}
.mime__stats span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.mime__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.mime__examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.mime__examples-label {
  font-size: 12px;
  color: var(--qt-muted);
}
.mime__example-chip {
  padding: 4px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  color: var(--qt-text);
  font-size: 12.5px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.mime__example-chip:hover {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.mime__exact {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mime__exact-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.mime__ext-badge {
  display: inline-block;
  padding: 4px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
}
.mime__cat-badge {
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.mime__exact-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
}
.mime__exact-row {
  display: grid;
  grid-template-columns: 92px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.mime__exact-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
}
.mime__code {
  margin: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
  min-width: 0;
}
.mime__code--accent {
  font-weight: 600;
  color: var(--qt-accent);
}
.mime__ext-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
.mime__ext-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mime__ext-chip {
  padding: 3px 8px;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
}
.mime__search-hint {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--qt-muted);
}
.mime__hit-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mime__hit {
  display: grid;
  grid-template-columns: 70px 1fr auto auto auto;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.mime__hit:hover {
  border-color: var(--qt-accent);
}
.mime__hit-ext {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--qt-text);
}
.mime__hit-mime {
  margin: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-accent);
  word-break: break-all;
  min-width: 0;
}
.mime__hit-name {
  font-size: 12px;
  color: var(--qt-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mime__hit-cat {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
@media (max-width: 720px) {
  .mime__hit {
    grid-template-columns: 60px 1fr auto;
    grid-template-areas:
      'ext mime copy'
      'name name cat';
    row-gap: 4px;
  }
  .mime__hit-ext { grid-area: ext; }
  .mime__hit-mime { grid-area: mime; }
  .mime__hit-name { grid-area: name; }
  .mime__hit-cat { grid-area: cat; justify-self: end; }
  .mime__hit :deep(.copy-btn) { grid-area: copy; }
}
</style>
