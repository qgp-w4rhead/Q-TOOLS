/**
 * useRegexCheatsheet — composable + pure logic for the Regex cheatsheet tool.
 *
 * Provides a searchable, filterable reference for regular-expression syntax
 * using the bundled `regexCheatsheetDatabase.ts` (no external dependency). A
 * single search box matches against the token, description, example, matches
 * and optional notes; category chips filter between the seven categories.
 *
 * Pure helpers (`searchEntries`, `filterByCategory`, `queryEntries`) have no
 * Vue dependency and can be imported standalone for unit testing or reuse.
 * The `useRegexCheatsheet()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  REGEX_CHEATSHEET_ENTRIES,
  REGEX_CHEATSHEET_CATEGORIES,
  REGEX_CHEATSHEET_COUNTS,
  REGEX_CHEATSHEET_TOTAL,
  type RegexCheatsheetCategory,
  type RegexCheatsheetEntry,
} from './regexCheatsheetDatabase';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A category filter value: either a specific category or "all". */
export type CategoryFilter = RegexCheatsheetCategory | 'all';

/** Result of a search: a ranked list of matching entries. */
export interface SearchResult {
  entry: RegexCheatsheetEntry;
  /** Lower score = better match. Used for stable ranking. */
  score: number;
}

/**
 * Filter the database to a single category. Returns a stable-order array.
 * `category === 'all'` returns the full database.
 */
export function filterByCategory(
  category: CategoryFilter,
): readonly RegexCheatsheetEntry[] {
  if (category === 'all') return REGEX_CHEATSHEET_ENTRIES;
  return REGEX_CHEATSHEET_ENTRIES.filter((e) => e.category === category);
}

/**
 * Search the database by query string. Matches the token (exact, prefix, or
 * substring) and the description/example/matches/notes (substring,
 * case-insensitive).
 *
 * Ranking (lower score = better):
 *  - Exact token match: -1000
 *  - Token prefix match: -500
 *  - Token substring match: position in token
 *  - Description substring match: 1000 + position
 *  - Example substring match: 1500 + position
 *  - Matches substring match: 2000 + position
 *  - Notes substring match: 2500 + position (lowest priority)
 *
 * Caps the result count at `limit` (default 200).
 */
export function searchEntries(
  raw: string,
  limit = 200,
): SearchResult[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const scored: SearchResult[] = [];

  for (const entry of REGEX_CHEATSHEET_ENTRIES) {
    let score: number | null = null;
    const tokenLower = entry.token.toLowerCase();

    // Token matching (highest priority).
    if (tokenLower === q) {
      score = -1000;
    } else if (tokenLower.startsWith(q)) {
      score = -500;
    } else {
      const idx = tokenLower.indexOf(q);
      if (idx >= 0) score = idx;
    }

    // Description matching (mid priority).
    if (score === null) {
      const idx = entry.description.toLowerCase().indexOf(q);
      if (idx >= 0) score = 1000 + idx;
    }

    // Example matching.
    if (score === null) {
      const idx = entry.example.toLowerCase().indexOf(q);
      if (idx >= 0) score = 1500 + idx;
    }

    // Matches sample matching.
    if (score === null) {
      const idx = entry.matches.toLowerCase().indexOf(q);
      if (idx >= 0) score = 2000 + idx;
    }

    // Notes matching (lowest priority).
    if (score === null && entry.notes) {
      const idx = entry.notes.toLowerCase().indexOf(q);
      if (idx >= 0) score = 2500 + idx;
    }

    if (score !== null) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Stable tiebreak: original database order.
    return (
      REGEX_CHEATSHEET_ENTRIES.indexOf(a.entry) -
      REGEX_CHEATSHEET_ENTRIES.indexOf(b.entry)
    );
  });
  return scored.slice(0, limit);
}

/**
 * Top-level query: apply category filter, then search within the filtered
 * set. Returns the final list of entries to display (already ranked when a
 * query is present, otherwise in stable database order).
 */
export function queryEntries(
  category: CategoryFilter,
  raw: string,
): readonly RegexCheatsheetEntry[] {
  const filtered = filterByCategory(category);
  const q = raw.trim();
  if (!q) return filtered;
  const filteredSet = new Set(filtered);
  const hits = searchEntries(raw, Number.MAX_SAFE_INTEGER);
  return hits.filter((h) => filteredSet.has(h.entry)).map((h) => h.entry);
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseRegexCheatsheetReturn {
  query: Ref<string>;
  category: Ref<CategoryFilter>;
  results: ComputedRef<readonly RegexCheatsheetEntry[]>;
  totalCount: number;
  categoryCounts: Readonly<Record<RegexCheatsheetCategory, number>>;
  categories: readonly RegexCheatsheetCategory[];
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useRegexCheatsheet(): UseRegexCheatsheetReturn {
  const query = ref<string>('');
  const category = ref<CategoryFilter>('all');

  const results = computed(() => queryEntries(category.value, query.value));

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
      if (typeof p.search === 'string') query.value = p.search;
      if (typeof p.token === 'string') query.value = p.token;
      if (typeof p.pattern === 'string') query.value = p.pattern;
      if (
        typeof p.category === 'string' &&
        (p.category === 'all' ||
          REGEX_CHEATSHEET_CATEGORIES.includes(
            p.category as RegexCheatsheetCategory,
          ))
      ) {
        category.value = p.category as CategoryFilter;
      }
    },
  });

  watch(
    [results, query, category],
    ([r, q, c]) => {
      if (!isEmbed.value) return;
      const payload: Record<string, unknown> = {
        query: q,
        category: c,
        count: r.length,
        results: r.map((e) => ({
          id: e.id,
          token: e.token,
          description: e.description,
          example: e.example,
          matches: e.matches,
          category: e.category,
          notes: e.notes ?? null,
        })),
      };
      const single = r.length === 1 ? r[0] : undefined;
      if (single) payload.token = single.token;
      sendOutput(payload);
    },
    { deep: false, immediate: false },
  );

  return {
    query,
    category,
    results,
    totalCount: REGEX_CHEATSHEET_TOTAL,
    categoryCounts: REGEX_CHEATSHEET_COUNTS,
    categories: REGEX_CHEATSHEET_CATEGORIES,
    isEmbed,
    embedInput,
  };
}
