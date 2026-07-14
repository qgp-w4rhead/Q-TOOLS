<script setup lang="ts">
/**
 * EmojiPicker — browse, search, and copy emojis.
 *
 * Features:
 *   - Search input with live filtering (debounced)
 *   - Category chips (9 categories with counts) + "All"
 *   - Skin tone selector (5 tones + default)
 *   - Responsive emoji grid — click to copy
 *   - Copy mode toggle (copy emoji vs shortcode `:shortcode:`)
 *   - Last-copied indicator
 *
 * The emoji dataset is lazy-loaded via a dynamic import (separate Vite chunk).
 *
 * Works in embed mode: receives `input` PostMessages to set query/category/
 * skinTone/copyMode and sends `output` PostMessages with the search results.
 */
import { ref, computed, onBeforeUnmount } from 'vue';
import { Search, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import { useEmojiPicker, type CopyMode } from './useEmojiPicker';
import {
  EMOJI_CATEGORIES,
  CATEGORY_LABELS,
  SKIN_TONES,
} from './emojiData';
import type { EmojiCategory } from './emojiData';

const {
  query,
  category,
  skinTone,
  copyMode,
  results,
  loading,
  lastCopied,
  data,
  setCategory,
  setSkinTone,
  setCopyMode,
  copyEmoji,
  reset,
} = useEmojiPicker();

// Debounce the search input.
const draft = ref<string>(query.value);
let timer: ReturnType<typeof setTimeout> | null = null;

function onSearch(e: Event): void {
  draft.value = (e.target as HTMLInputElement).value;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    query.value = draft.value;
  }, 150);
}

function onReset(): void {
  if (timer) clearTimeout(timer);
  reset();
  draft.value = '';
}

// Category counts for the chips.
const categoryCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  if (!data.value) return counts;
  for (const cat of data.value) {
    counts[cat.id] = cat.emojis.length;
  }
  return counts;
});

const totalCount = computed(() => {
  if (!data.value) return 0;
  return data.value.reduce((sum, cat) => sum + cat.emojis.length, 0);
});

// Grid display: when no query, show all (or category) entries; when querying,
// show ranked results.
const displayResults = computed(() => results.value);

const resultCount = computed(() => displayResults.value.length);

function handleCopy(entry: typeof results.value[number]['entry']): void {
  void copyEmoji(entry);
}

function onCategoryChip(c: EmojiCategory | 'all'): void {
  setCategory(c);
}

function onSkinTone(tone: typeof SKIN_TONES[number]): void {
  setSkinTone(tone.id);
}

function onCopyMode(m: CopyMode): void {
  setCopyMode(m);
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <div class="ep">
    <ToolInput
      title="Emoji picker"
      description="Search and copy emojis. Click any emoji to copy it to your clipboard."
    >
      <template #actions>
        <button
          type="button"
          class="ep__btn ep__btn--ghost"
          title="Reset"
          @click="onReset"
        >
          Reset
        </button>
      </template>

      <!-- Search bar -->
      <div class="ep__search-row">
        <div class="ep__search-wrap">
          <Search :size="16" class="ep__search-icon" />
          <input
            type="text"
            class="ep__search"
            :value="draft"
            placeholder="Search emojis by name, shortcode, or keyword…"
            @input="onSearch"
            aria-label="Search emojis"
          />
          <Loader2
            v-if="loading"
            :size="16"
            class="ep__spinner"
          />
        </div>
      </div>

      <!-- Category chips -->
      <div class="ep__chips" v-if="!loading && data">
        <button
          type="button"
          class="ep__chip"
          :class="{ 'ep__chip--active': category === 'all' }"
          @click="onCategoryChip('all')"
        >
          All <span class="ep__chip-count">{{ totalCount }}</span>
        </button>
        <button
          v-for="cat in EMOJI_CATEGORIES"
          :key="cat"
          type="button"
          class="ep__chip"
          :class="{ 'ep__chip--active': category === cat }"
          @click="onCategoryChip(cat)"
        >
          {{ CATEGORY_LABELS[cat] }}
          <span class="ep__chip-count">{{ categoryCounts[cat] ?? 0 }}</span>
        </button>
      </div>

      <!-- Skin tone + copy mode controls -->
      <div class="ep__controls" v-if="!loading && data">
        <div class="ep__control-group">
          <span class="ep__control-label">Skin tone</span>
          <div class="ep__tones">
            <button
              v-for="tone in SKIN_TONES"
              :key="tone.id"
              type="button"
              class="ep__tone"
              :class="{ 'ep__tone--active': skinTone === tone.id }"
              :title="tone.label"
              :aria-label="tone.label"
              @click="onSkinTone(tone)"
            >
              {{ tone.swatch }}
            </button>
          </div>
        </div>

        <div class="ep__control-group">
          <span class="ep__control-label">Copy as</span>
          <div class="ep__modes">
            <button
              type="button"
              class="ep__mode"
              :class="{ 'ep__mode--active': copyMode === 'emoji' }"
              @click="onCopyMode('emoji')"
            >
              Emoji
            </button>
            <button
              type="button"
              class="ep__mode"
              :class="{ 'ep__mode--active': copyMode === 'shortcode' }"
              @click="onCopyMode('shortcode')"
            >
              :shortcode:
            </button>
          </div>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="query ? 'Search results' : (category === 'all' ? 'All emojis' : CATEGORY_LABELS[category as EmojiCategory])"
      :description="`${resultCount} emojis${lastCopied ? ' · copied: ' + lastCopied : ''}`"
    >
      <!-- Loading state -->
      <div v-if="loading" class="ep__loading">
        <Loader2 :size="24" class="ep__spinner--lg" />
        <span>Loading emoji dataset…</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="resultCount === 0" class="ep__empty">
        <span>No emojis found for "{{ query }}".</span>
      </div>

      <!-- Emoji grid -->
      <div v-else class="ep__grid">
        <button
          v-for="item in displayResults"
          :key="item.entry.e + item.category"
          type="button"
          class="ep__emoji-btn"
          :title="`${item.entry.n} — :${item.entry.s[0] ?? ''}:`"
          @click="handleCopy(item.entry)"
        >
          <span class="ep__emoji-glyph">{{ item.entry.e }}</span>
        </button>
      </div>

      <!-- Last copied indicator -->
      <div v-if="lastCopied" class="ep__copied">
        Copied: <code class="ep__copied-code">{{ lastCopied }}</code>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
.ep {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}

/* Search bar */
.ep__search-row {
  margin-bottom: 12px;
}
.ep__search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.ep__search-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
.ep__search {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 36px 10px 38px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.ep__search:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ep__spinner {
  position: absolute;
  right: 12px;
  color: var(--qt-muted);
  animation: ep-spin 1s linear infinite;
}
@keyframes ep-spin {
  to { transform: rotate(360deg); }
}

/* Category chips */
.ep__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.ep__chip {
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
  padding: 5px 12px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.ep__chip:hover {
  border-color: var(--qt-accent-soft);
  color: var(--qt-text);
}
.ep__chip--active {
  background: var(--qt-accent);
  border-color: var(--qt-accent);
  color: var(--qt-accent-contrast, #fff);
}
.ep__chip-count {
  font-size: 11px;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

/* Controls (skin tone + copy mode) */
.ep__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}
.ep__control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ep__control-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.ep__tones {
  display: flex;
  gap: 4px;
}
.ep__tone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-size: 18px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    transform 0.1s ease;
  line-height: 1;
}
.ep__tone:hover {
  border-color: var(--qt-accent-soft);
}
.ep__tone--active {
  border-color: var(--qt-accent);
  border-width: 2px;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.ep__modes {
  display: flex;
  gap: 4px;
}
.ep__mode {
  display: inline-flex;
  align-items: center;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.ep__mode:hover {
  border-color: var(--qt-accent-soft);
  color: var(--qt-text);
}
.ep__mode--active {
  background: var(--qt-accent);
  border-color: var(--qt-accent);
  color: var(--qt-accent-contrast, #fff);
}

/* Buttons */
.ep__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--qt-radius-sm);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
}
.ep__btn--ghost {
  background: transparent;
  border: 1px solid var(--qt-border);
  color: var(--qt-muted);
}
.ep__btn--ghost:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent);
}
.ep__btn--ghost:active {
  transform: translateY(1px);
}

/* Loading + empty states */
.ep__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 16px;
  color: var(--qt-muted);
  font-size: 14px;
}
.ep__spinner--lg {
  animation: ep-spin 1s linear infinite;
}
.ep__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: var(--qt-muted);
  font-size: 14px;
}

/* Emoji grid */
.ep__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 2px;
  padding: 4px;
}
.ep__emoji-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--qt-radius-sm);
  cursor: pointer;
  transition:
    background 0.1s ease,
    border-color 0.1s ease,
    transform 0.1s ease;
  padding: 0;
  line-height: 1;
}
.ep__emoji-btn:hover {
  background: var(--qt-bg);
  border-color: var(--qt-border);
  transform: scale(1.1);
}
.ep__emoji-btn:active {
  transform: scale(0.95);
}
.ep__emoji-glyph {
  font-size: 22px;
  line-height: 1;
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}

/* Last copied indicator */
.ep__copied {
  margin-top: 10px;
  font-size: 13px;
  color: var(--qt-muted);
}
.ep__copied-code {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 2px 6px;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
}
</style>
