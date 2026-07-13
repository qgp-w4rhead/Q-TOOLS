/**
 * useHttpStatusCodes — composable + pure logic for the HTTP status codes tool.
 *
 * Provides a searchable, filterable reference for all HTTP status codes
 * (1xx-5xx) using the bundled `httpStatusDatabase.ts` (no external
 * dependency). A single search box matches against the code, name, and
 * description; a category filter chips between 1xx/2xx/3xx/4xx/5xx.
 *
 * Pure helpers (`getStatusByCode`, `filterByCategory`, `searchStatusCodes`)
 * have no Vue dependency and can be imported standalone for unit testing or
 * reuse. The `useHttpStatusCodes()` composable wraps them in reactive state
 * and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  HTTP_STATUS_ENTRIES,
  HTTP_STATUS_BY_CODE,
  HTTP_STATUS_CATEGORIES,
  HTTP_STATUS_COUNTS,
  type HttpStatusCategory,
  type HttpStatusEntry,
} from './httpStatusDatabase';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A category filter value: either a specific category or "all". */
export type CategoryFilter = HttpStatusCategory | 'all';

/** Result of a search: a ranked list of matching entries. */
export interface SearchResult {
  entry: HttpStatusEntry;
  /** Lower score = better match. Used for stable ranking. */
  score: number;
}

/**
 * Look up a single entry by numeric code. Returns `null` if the code is not
 * in the database.
 */
export function getStatusByCode(code: number): HttpStatusEntry | null {
  return HTTP_STATUS_BY_CODE.get(code) ?? null;
}

/**
 * Filter the database to a single category. Returns a stable-order array.
 * `category === 'all'` returns the full database.
 */
export function filterByCategory(
  category: CategoryFilter,
): readonly HttpStatusEntry[] {
  if (category === 'all') return HTTP_STATUS_ENTRIES;
  return HTTP_STATUS_ENTRIES.filter((e) => e.category === category);
}

/**
 * Search the database by query string. Matches the numeric code (exact or
 * prefix), the name, and the description (substring, case-insensitive).
 *
 * Ranking (lower score = better):
 *  - Exact code match: -1000
 *  - Code prefix match: -500
 *  - Name prefix match: -200
 *  - Name substring match: position in name
 *  - Description substring match: 1000 + position (lowest priority)
 *
 * Caps the result count at `limit` (default 100).
 */
export function searchStatusCodes(
  raw: string,
  limit = 100,
): SearchResult[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const qNum = Number.parseInt(q, 10);
  const isNumericQuery = /^\d+$/.test(q);
  const scored: SearchResult[] = [];

  for (const entry of HTTP_STATUS_ENTRIES) {
    let score: number | null = null;

    // Numeric code matching.
    if (isNumericQuery) {
      if (entry.code === qNum) {
        score = -1000;
      } else if (String(entry.code).startsWith(q)) {
        score = -500;
      }
    }

    // Name matching (case-insensitive).
    const nameLower = entry.name.toLowerCase();
    if (nameLower === q) {
      score = score === null ? -300 : Math.min(score, -300);
    } else if (nameLower.startsWith(q)) {
      score = score === null ? -200 : Math.min(score, -200);
    } else {
      const idx = nameLower.indexOf(q);
      if (idx >= 0) {
        score = score === null ? idx : Math.min(score, idx);
      }
    }

    // Description matching (lowest priority).
    if (score === null) {
      const idx = entry.description.toLowerCase().indexOf(q);
      if (idx >= 0) score = 1000 + idx;
    }

    if (score !== null) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.entry.code - b.entry.code;
  });
  return scored.slice(0, limit);
}

/**
 * Top-level query: apply category filter, then search within the filtered
 * set. Returns the final list of entries to display (already ranked when a
 * query is present, otherwise in stable database order).
 */
export function queryStatusCodes(
  category: CategoryFilter,
  raw: string,
): readonly HttpStatusEntry[] {
  const filtered = filterByCategory(category);
  const q = raw.trim();
  if (!q) return filtered;
  // Preserve search ranking but restrict to the filtered category. Entries
  // are stable object references from HTTP_STATUS_ENTRIES, so Set membership
  // works correctly.
  const filteredSet = new Set(filtered);
  const hits = searchStatusCodes(raw, Number.MAX_SAFE_INTEGER);
  return hits.filter((h) => filteredSet.has(h.entry)).map((h) => h.entry);
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseHttpStatusCodesReturn {
  query: Ref<string>;
  category: Ref<CategoryFilter>;
  results: ComputedRef<readonly HttpStatusEntry[]>;
  totalCount: ComputedRef<number>;
  categoryCounts: Readonly<Record<HttpStatusCategory, number>>;
  categories: readonly HttpStatusCategory[];
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useHttpStatusCodes(): UseHttpStatusCodesReturn {
  const query = ref<string>('');
  const category = ref<CategoryFilter>('all');

  const results = computed(() =>
    queryStatusCodes(category.value, query.value),
  );

  const totalCount = computed(() => HTTP_STATUS_ENTRIES.length);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
      if (typeof p.search === 'string') query.value = p.search;
      if (typeof p.code === 'number') query.value = String(p.code);
      else if (typeof p.code === 'string') query.value = p.code;
      if (
        typeof p.category === 'string' &&
        (p.category === 'all' ||
          HTTP_STATUS_CATEGORIES.includes(p.category as HttpStatusCategory))
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
          code: e.code,
          name: e.name,
          description: e.description,
          category: e.category,
          official: e.official,
        })),
      };
      // When the query resolves to a single exact code match, also surface
      // it as a top-level `code` field for convenience.
      const single = r.length === 1 ? r[0] : undefined;
      if (single) payload.code = single.code;
      sendOutput(payload);
    },
    { deep: false, immediate: false },
  );

  return {
    query,
    category,
    results,
    totalCount,
    categoryCounts: HTTP_STATUS_COUNTS,
    categories: HTTP_STATUS_CATEGORIES,
    isEmbed,
    embedInput,
  };
}
