/**
 * useGitCheatsheet — composable + pure logic for the Git cheatsheet tool.
 *
 * Provides a searchable, filterable reference for common Git commands using
 * the bundled `gitCheatsheetDatabase.ts` (no external dependency). A single
 * search box matches against the command and the description (and optional
 * notes); category chips filter between the eight categories.
 *
 * Pure helpers (`searchCommands`, `filterByCategory`, `queryCommands`) have
 * no Vue dependency and can be imported standalone for unit testing or reuse.
 * The `useGitCheatsheet()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  GIT_CHEATSHEET_ENTRIES,
  GIT_CHEATSHEET_CATEGORIES,
  GIT_CHEATSHEET_COUNTS,
  GIT_CHEATSHEET_TOTAL,
  type GitCheatsheetCategory,
  type GitCheatsheetEntry,
} from './gitCheatsheetDatabase';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A category filter value: either a specific category or "all". */
export type CategoryFilter = GitCheatsheetCategory | 'all';

/** Result of a search: a ranked list of matching entries. */
export interface SearchResult {
  entry: GitCheatsheetEntry;
  /** Lower score = better match. Used for stable ranking. */
  score: number;
}

/**
 * Filter the database to a single category. Returns a stable-order array.
 * `category === 'all'` returns the full database.
 */
export function filterByCategory(
  category: CategoryFilter,
): readonly GitCheatsheetEntry[] {
  if (category === 'all') return GIT_CHEATSHEET_ENTRIES;
  return GIT_CHEATSHEET_ENTRIES.filter((e) => e.category === category);
}

/**
 * Search the database by query string. Matches the command (exact, prefix, or
 * substring) and the description/notes (substring, case-insensitive).
 *
 * Ranking (lower score = better):
 *  - Exact command match: -1000
 *  - Command prefix match: -500
 *  - Command substring match: position in command
 *  - Description substring match: 1000 + position
 *  - Notes substring match: 2000 + position (lowest priority)
 *
 * Caps the result count at `limit` (default 200).
 */
export function searchCommands(
  raw: string,
  limit = 200,
): SearchResult[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const scored: SearchResult[] = [];

  for (const entry of GIT_CHEATSHEET_ENTRIES) {
    let score: number | null = null;
    const cmdLower = entry.command.toLowerCase();

    // Command matching (highest priority).
    if (cmdLower === q) {
      score = -1000;
    } else if (cmdLower.startsWith(q)) {
      score = -500;
    } else {
      const idx = cmdLower.indexOf(q);
      if (idx >= 0) score = idx;
    }

    // Description matching (mid priority).
    if (score === null) {
      const idx = entry.description.toLowerCase().indexOf(q);
      if (idx >= 0) score = 1000 + idx;
    }

    // Notes matching (lowest priority).
    if (score === null && entry.notes) {
      const idx = entry.notes.toLowerCase().indexOf(q);
      if (idx >= 0) score = 2000 + idx;
    }

    if (score !== null) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Stable tiebreak: original database order (entry id is unique but not
    // numeric; preserve array order by index lookup).
    return (
      GIT_CHEATSHEET_ENTRIES.indexOf(a.entry) -
      GIT_CHEATSHEET_ENTRIES.indexOf(b.entry)
    );
  });
  return scored.slice(0, limit);
}

/**
 * Top-level query: apply category filter, then search within the filtered
 * set. Returns the final list of entries to display (already ranked when a
 * query is present, otherwise in stable database order).
 */
export function queryCommands(
  category: CategoryFilter,
  raw: string,
): readonly GitCheatsheetEntry[] {
  const filtered = filterByCategory(category);
  const q = raw.trim();
  if (!q) return filtered;
  // Preserve search ranking but restrict to the filtered category. Entries
  // are stable object references from GIT_CHEATSHEET_ENTRIES, so Set
  // membership works correctly.
  const filteredSet = new Set(filtered);
  const hits = searchCommands(raw, Number.MAX_SAFE_INTEGER);
  return hits.filter((h) => filteredSet.has(h.entry)).map((h) => h.entry);
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseGitCheatsheetReturn {
  query: Ref<string>;
  category: Ref<CategoryFilter>;
  results: ComputedRef<readonly GitCheatsheetEntry[]>;
  totalCount: number;
  categoryCounts: Readonly<Record<GitCheatsheetCategory, number>>;
  categories: readonly GitCheatsheetCategory[];
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useGitCheatsheet(): UseGitCheatsheetReturn {
  const query = ref<string>('');
  const category = ref<CategoryFilter>('all');

  const results = computed(() => queryCommands(category.value, query.value));

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
      if (typeof p.search === 'string') query.value = p.search;
      if (typeof p.command === 'string') query.value = p.command;
      if (
        typeof p.category === 'string' &&
        (p.category === 'all' ||
          GIT_CHEATSHEET_CATEGORIES.includes(p.category as GitCheatsheetCategory))
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
          command: e.command,
          description: e.description,
          category: e.category,
          notes: e.notes ?? null,
        })),
      };
      // When the query resolves to a single command, surface it at the top
      // level for convenience.
      const single = r.length === 1 ? r[0] : undefined;
      if (single) payload.command = single.command;
      sendOutput(payload);
    },
    { deep: false, immediate: false },
  );

  return {
    query,
    category,
    results,
    totalCount: GIT_CHEATSHEET_TOTAL,
    categoryCounts: GIT_CHEATSHEET_COUNTS,
    categories: GIT_CHEATSHEET_CATEGORIES,
    isEmbed,
    embedInput,
  };
}
