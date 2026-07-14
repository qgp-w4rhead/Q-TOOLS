/**
 * useEmojiPicker — composable + pure logic for the Emoji picker tool.
 *
 * Provides:
 *   - `applySkinTone(emoji, tone)` — insert a Fitzpatrick modifier after the
 *     first code point of a single-codepoint people emoji.
 *   - `normalizeQuery(s)` — lowercased, trimmed, ASCII-folded search string.
 *   - `searchEmojis(data, query, category, limit)` — ranked search across
 *     name + shortcodes + keywords (exact / prefix / substring scoring).
 *   - `flattenCategory(data, category)` — all entries for a category.
 *   - `useEmojiPicker()` composable — reactive state (query, category,
 *     skinTone, results, loading, lastCopied) + dynamic import of the emoji
 *     dataset + embed PostMessage integration.
 *
 * No external dependencies. The emoji dataset is lazy-loaded via a dynamic
 * import so Vite emits it as a separate chunk.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import { copyToClipboard } from '@/utils/clipboard';
import type { EmbedInputPayload } from '@q-tools/shared';
import type {
  EmojiCategory,
  EmojiCategoryData,
  EmojiEntry,
  SkinTone,
} from './emojiData';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type CopyMode = 'emoji' | 'shortcode';

export interface SearchResult {
  entry: EmojiEntry;
  category: EmojiCategory;
  score: number;
}

export interface UseEmojiPickerReturn {
  query: Ref<string>;
  category: Ref<EmojiCategory | 'all'>;
  skinTone: Ref<SkinTone['id']>;
  copyMode: Ref<CopyMode>;
  results: Ref<SearchResult[]>;
  loading: Ref<boolean>;
  lastCopied: Ref<string | null>;
  data: Ref<readonly EmojiCategoryData[] | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setCategory: (c: EmojiCategory | 'all') => void;
  setSkinTone: (t: SkinTone['id']) => void;
  setCopyMode: (m: CopyMode) => void;
  copyEmoji: (entry: EmojiEntry) => Promise<string>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Apply a skin-tone modifier to an emoji. The Fitzpatrick modifier
 * (U+1F3FB–U+1F3FF) is inserted immediately after the first code point.
 * This works for single-codepoint people emojis (e.g. 👋 → 👋🏻).
 *
 * Multi-codepoint emoji sequences (e.g. ZWJ sequences with joins) are returned
 * unchanged — only simple single-glyph people emojis support tone modifiers.
 *
 * When `tone` is `'none'` or the modifier is empty, the emoji is returned as-is.
 */
export function applySkinTone(emoji: string, modifier: string): string {
  if (!modifier) return emoji;
  // Use Array.from to split by code points (not UTF-16 code units), so
  // supplementary-plane emoji (U+1F300+) are treated as a single unit.
  const codePoints = Array.from(emoji);
  if (codePoints.length < 1) return emoji;
  // Only apply to single-codepoint emoji (simple people glyphs).
  // Multi-codepoint sequences (ZWJ joins, keycaps, flags) are left alone.
  if (codePoints.length !== 1) return emoji;
  return codePoints[0]! + modifier;
}

/**
 * Normalise a search query: trim, lowercase, and fold common non-ASCII
 * characters to their ASCII equivalents (diacritics → base letters).
 * Returns an empty string for whitespace-only or empty input.
 */
export function normalizeQuery(s: string): string {
  if (!s) return '';
  // NFD decomposition separates base letters from combining marks, then we
  // strip the marks. This folds é → e, ñ → n, etc.
  const folded = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return folded.trim().toLowerCase();
}

/**
 * Compute a search score for an emoji entry against a normalised query.
 * Higher is better. Returns 0 when there is no match.
 *
 * Scoring tiers (in descending priority):
 *   - Exact name match: 1000
 *   - Exact shortcode match: 900
 *   - Exact keyword match: 800
 *   - Name starts with query: 500 + (len bonus)
 *   - Shortcode starts with query: 450
 *   - Keyword starts with query: 400
 *   - Name contains query: 200
 *   - Shortcode contains query: 150
 *   - Keyword contains query: 100
 */
function scoreEntry(entry: EmojiEntry, q: string): number {
  if (!q) return 0;
  const name = entry.n;
  // Shortcodes are already lowercase.
  const shortcodes = entry.s;
  const keywords = entry.k ?? [];

  // Exact matches.
  if (name === q) return 1000;
  for (const sc of shortcodes) {
    if (sc === q) return 900;
  }
  for (const kw of keywords) {
    if (kw === q) return 800;
  }

  // Prefix matches.
  if (name.startsWith(q)) return 500 + Math.max(0, 50 - q.length);
  for (const sc of shortcodes) {
    if (sc.startsWith(q)) return 450;
  }
  for (const kw of keywords) {
    if (kw.startsWith(q)) return 400;
  }

  // Substring matches.
  if (name.includes(q)) return 200;
  for (const sc of shortcodes) {
    if (sc.includes(q)) return 150;
  }
  for (const kw of keywords) {
    if (kw.includes(q)) return 100;
  }

  return 0;
}

/**
 * Search the emoji dataset for entries matching `query`. When `category` is
 * not `'all'`, results are restricted to that category. Results are sorted by
 * descending score and limited to `limit` entries (default 200).
 *
 * When `query` is empty and `category` is `'all'`, all entries from all
 * categories are returned (in category order, un-scored). When `query` is
 * empty and a specific category is selected, all entries from that category
 * are returned.
 */
export function searchEmojis(
  data: readonly EmojiCategoryData[],
  query: string,
  category: EmojiCategory | 'all' = 'all',
  limit = 200,
): SearchResult[] {
  const q = normalizeQuery(query);

  // No query: return all entries (optionally filtered by category).
  if (!q) {
    const out: SearchResult[] = [];
    for (const cat of data) {
      if (category !== 'all' && cat.id !== category) continue;
      for (const entry of cat.emojis) {
        out.push({ entry, category: cat.id, score: 0 });
      }
    }
    return limit > 0 && out.length > limit ? out.slice(0, limit) : out;
  }

  // Query mode: score and rank.
  const out: SearchResult[] = [];
  for (const cat of data) {
    if (category !== 'all' && cat.id !== category) continue;
    for (const entry of cat.emojis) {
      const score = scoreEntry(entry, q);
      if (score > 0) out.push({ entry, category: cat.id, score });
    }
  }
  // Sort by descending score; ties broken by original order (stable sort).
  out.sort((a, b) => b.score - a.score);
  return limit > 0 && out.length > limit ? out.slice(0, limit) : out;
}

/**
 * Return all emoji entries for a given category (in dataset order).
 */
export function flattenCategory(
  data: readonly EmojiCategoryData[],
  category: EmojiCategory,
): EmojiEntry[] {
  for (const cat of data) {
    if (cat.id === category) return cat.emojis;
  }
  return [];
}

/**
 * Count the total number of emojis in a category.
 */
export function categoryCount(
  data: readonly EmojiCategoryData[],
  category: EmojiCategory,
): number {
  return flattenCategory(data, category).length;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useEmojiPicker(): UseEmojiPickerReturn {
  const query = ref<string>('');
  const category = ref<EmojiCategory | 'all'>('all');
  const skinTone = ref<SkinTone['id']>('none');
  const copyMode = ref<CopyMode>('emoji');
  const results = ref<SearchResult[]>([]);
  const loading = ref<boolean>(true);
  const lastCopied = ref<string | null>(null);
  const data = ref<readonly EmojiCategoryData[] | null>(null);

  // Lazy-load the emoji dataset via dynamic import (separate Vite chunk).
  let loaded = false;
  async function loadData(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
      const mod = await import('./emojiData');
      data.value = mod.EMOJI_DATA;
      loading.value = false;
      recompute();
    } catch (err) {
      console.error('Failed to load emoji dataset:', err);
      loading.value = false;
    }
  }

  function recompute(): void {
    if (!data.value) {
      results.value = [];
      return;
    }
    results.value = searchEmojis(
      data.value,
      query.value,
      category.value,
      300,
    );
  }

  function setCategory(c: EmojiCategory | 'all'): void {
    category.value = c;
  }

  function setSkinTone(t: SkinTone['id']): void {
    skinTone.value = t;
  }

  function setCopyMode(m: CopyMode): void {
    copyMode.value = m;
  }

  /**
   * Copy an emoji (or its shortcode) to the clipboard. Returns the text that
   * was copied. Updates `lastCopied`.
   */
  async function copyEmoji(entry: EmojiEntry): Promise<string> {
    let text: string;
    if (copyMode.value === 'shortcode') {
      // Use the first shortcode, wrapped in colons.
      const sc = entry.s[0] ?? entry.n.replace(/\s+/g, '_');
      text = `:${sc}:`;
    } else {
      // Apply skin tone if the emoji supports it and a tone is selected.
      if (entry.t && skinTone.value !== 'none') {
        const mod = getSkinToneModifier(skinTone.value);
        text = applySkinTone(entry.e, mod);
      } else {
        text = entry.e;
      }
    }
    lastCopied.value = text;
    await copyToClipboard(text);
    return text;
  }

  function reset(): void {
    query.value = '';
    category.value = 'all';
    skinTone.value = 'none';
    copyMode.value = 'emoji';
    lastCopied.value = null;
    recompute();
  }

  // Recompute results when query or category changes.
  watch([query, category], recompute);

  // Kick off the lazy load.
  void loadData();

  // Embed integration.
  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
      else if (typeof p.search === 'string') query.value = p.search;
      if (typeof p.category === 'string') {
        category.value = p.category as EmojiCategory | 'all';
      }
      if (typeof p.skinTone === 'string') {
        skinTone.value = p.skinTone as SkinTone['id'];
      }
      if (typeof p.copyMode === 'string') {
        copyMode.value = p.copyMode as CopyMode;
      }
      const action = typeof p.action === 'string' ? p.action : null;
      if (action === 'reset' || action === 'clear') reset();
    },
  });

  // Send output when results or last-copied change.
  watch([results, lastCopied], () => {
    if (!isEmbed.value) return;
    sendOutput({
      count: results.value.length,
      query: query.value,
      category: category.value,
      lastCopied: lastCopied.value,
      results: results.value.slice(0, 50).map((r) => ({
        emoji: r.entry.e,
        name: r.entry.n,
        shortcode: r.entry.s[0] ?? null,
        category: r.category,
      })),
    });
  });

  return {
    query,
    category,
    skinTone,
    copyMode,
    results,
    loading,
    lastCopied,
    data,
    isEmbed,
    embedInput,
    setCategory,
    setSkinTone,
    setCopyMode,
    copyEmoji,
    reset,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a skin-tone id to its modifier code point string.
 * Returns empty string for `'none'` or unknown ids.
 */
function getSkinToneModifier(id: SkinTone['id']): string {
  switch (id) {
    case 'light': return '\u{1F3FB}';
    case 'medium-light': return '\u{1F3FC}';
    case 'medium': return '\u{1F3FD}';
    case 'medium-dark': return '\u{1F3FE}';
    case 'dark': return '\u{1F3FF}';
    default: return '';
  }
}
