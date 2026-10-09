<script setup lang="ts">
/**
 * EmojiPicker - browse, search, and copy emojis.
 *
 * Features:
 *   - Search input with live filtering (debounced)
 *   - Category chips (9 categories with counts) + "All"
 *   - Skin tone selector (5 tones + default)
 *   - Responsive emoji grid - click to copy
 *   - Copy mode toggle (copy emoji vs shortcode `:shortcode:`)
 *   - Last-copied indicator
 *
 * The emoji dataset is lazy-loaded via a dynamic import (separate Vite chunk).
 *
 * Works in embed mode: receives `input` PostMessages to set query/category/
 * skinTone/copyMode and sends `output` PostMessages with the search results.
 */
import { ref, computed, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import { useEmojiPicker, type CopyMode } from './useEmojiPicker';
import {
  EMOJI_CATEGORIES,
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

const { t } = useI18n();
const U = 'tools.emoji-picker.ui.';

const CAT_KEYS: Record<EmojiCategory, string> = {
  smileys: 'catSmileys',
  people: 'catPeople',
  animals: 'catAnimals',
  food: 'catFood',
  activities: 'catActivities',
  travel: 'catTravel',
  objects: 'catObjects',
  symbols: 'catSymbols',
  flags: 'catFlags',
};
function catLabel(c: EmojiCategory): string {
  return t(U + CAT_KEYS[c]);
}
const TONE_KEYS: Record<string, string> = {
  none: 'toneNone',
  light: 'toneLight',
  'medium-light': 'toneMediumLight',
  medium: 'toneMedium',
  'medium-dark': 'toneMediumDark',
  dark: 'toneDark',
};
function toneLabel(id: string): string {
  const k = TONE_KEYS[id];
  return k ? t(U + k) : id;
}

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
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost"
          :title="t(U + 'resetTitle')"
          @click="onReset"
        >
          {{ t('common.reset') }}
        </button>
      </template>

      <!-- Search bar -->
      <div style="margin-bottom:12px">
        <div class="qt-input-wrap">
          <Search :size="16" style="position:absolute;left:12px;color:var(--qt-muted);pointer-events:none" />
          <input
            type="text"
            class="qt-input"
            style="padding:10px 36px 10px 38px"
            :value="draft"
            :placeholder="t(U + 'searchPlaceholder')"
            @input="onSearch"
            :aria-label="t(U + 'ariaSearch')"
          />
          <Loader2
            v-if="loading"
            :size="16"
            class="qt-spin"
            style="position:absolute;right:12px;color:var(--qt-muted)"
          />
        </div>
      </div>

      <!-- Category chips -->
      <div class="qt-row" style="--qt-row-gap:6px;margin-bottom:12px" v-if="!loading && data">
        <button
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--solid': category === 'all' }"
          @click="onCategoryChip('all')"
        >
          {{ t(U + 'all') }} <span style="font-size:11px;opacity:0.75;font-variant-numeric:tabular-nums">{{ totalCount }}</span>
        </button>
        <button
          v-for="cat in EMOJI_CATEGORIES"
          :key="cat"
          type="button"
          class="qt-chip"
          :class="{ 'qt-chip--solid': category === cat }"
          @click="onCategoryChip(cat)"
        >
          {{ catLabel(cat) }}
          <span style="font-size:11px;opacity:0.75;font-variant-numeric:tabular-nums">{{ categoryCounts[cat] ?? 0 }}</span>
        </button>
      </div>

      <!-- Skin tone + copy mode controls -->
      <div class="qt-row qt-row--center" style="--qt-row-gap:16px" v-if="!loading && data">
        <div class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <span class="qt-label">{{ t(U + 'skinTone') }}</span>
          <div class="qt-row" style="--qt-row-gap:4px;flex-wrap:nowrap">
            <button
              v-for="tone in SKIN_TONES"
              :key="tone.id"
              type="button"
              class="ep__tone"
              :class="{ 'ep__tone--active': skinTone === tone.id }"
              :title="toneLabel(tone.id)"
              :aria-label="toneLabel(tone.id)"
              @click="onSkinTone(tone)"
            >
              {{ tone.swatch }}
            </button>
          </div>
        </div>

        <div class="qt-row qt-row--center" style="--qt-row-gap:8px;flex-wrap:nowrap">
          <span class="qt-label">{{ t(U + 'copyAs') }}</span>
          <div class="qt-row" style="--qt-row-gap:4px;flex-wrap:nowrap">
            <button
              type="button"
              class="ep__mode"
              :class="{ 'ep__mode--active': copyMode === 'emoji' }"
              @click="onCopyMode('emoji')"
            >
              {{ t(U + 'copyEmoji') }}
            </button>
            <button
              type="button"
              class="ep__mode"
              :class="{ 'ep__mode--active': copyMode === 'shortcode' }"
              @click="onCopyMode('shortcode')"
            >
              {{ t(U + 'copyShortcode') }}
            </button>
          </div>
        </div>
      </div>
    </ToolInput>

    <ToolOutput
      :title="query ? t(U + 'titleSearchResults') : (category === 'all' ? t(U + 'titleAll') : catLabel(category as EmojiCategory))"
      :description="t(U + 'descCount', resultCount) + (lastCopied ? t(U + 'descCopied', { v: lastCopied }) : '')"
    >
      <!-- Loading state -->
      <div v-if="loading" class="ep__loading">
        <Loader2 :size="24" class="qt-spin" />
        <span>{{ t(U + 'loading') }}</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="resultCount === 0" class="ep__empty">
        <span>{{ t(U + 'empty', { q: query }) }}</span>
      </div>

      <!-- Emoji grid -->
      <div v-else class="qt-grid" style="--qt-grid-min:40px;--qt-grid-gap:2px;padding:4px">
        <button
          v-for="item in displayResults"
          :key="item.entry.e + item.category"
          type="button"
          class="ep__emoji-btn"
          :title="`${item.entry.n} - :${item.entry.s[0] ?? ''}:`"
          @click="handleCopy(item.entry)"
        >
          <span class="ep__emoji-glyph">{{ item.entry.e }}</span>
        </button>
      </div>

      <!-- Last copied indicator -->
      <div v-if="lastCopied" style="margin-top:10px;font-size:13px;color:var(--qt-muted)">
        {{ t(U + 'copied') }} <code class="qt-kbd">{{ lastCopied }}</code>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Skin-tone swatch — square emoji button with a 2px active ring. */
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

/* Copy-mode chip — rounded-sm toggle chip with solid-accent active. */
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

/* Centered loading / empty states. */
.ep__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 16px;
  color: var(--qt-muted);
  font-size: 14px;
}
.ep__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: var(--qt-muted);
  font-size: 14px;
}

/* Emoji grid button — square cell that scales on hover/press. */
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
</style>
