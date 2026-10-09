/**
 * useWcagReference - composable + pure logic for the WCAG reference tool.
 *
 * Provides a searchable, filterable reference for WCAG 2.2 success criteria
 * using the bundled `wcagDatabase.ts` (no external dependency). A single
 * search box matches against the ref, title, and description; a level
 * filter chips between A/AA/AAA.
 *
 * Pure helpers (`searchCriteria`, `filterByLevel`, `queryCriteria`) have
 * no Vue dependency. The `useWcagReference()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  WCAG_CRITERIA,
  WCAG_PRINCIPLES,
  WCAG_LEVELS,
  WCAG_LEVEL_COUNTS,
  type WcagLevel,
  type WcagCriterion,
} from './wcagDatabase';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export type LevelFilter = WcagLevel | 'all';

export interface SearchResult {
  criterion: WcagCriterion;
  score: number;
}

/** Filter criteria by conformance level. */
export function filterByLevel(level: LevelFilter): readonly WcagCriterion[] {
  if (level === 'all') return WCAG_CRITERIA;
  return WCAG_CRITERIA.filter(c => c.level === level);
}

/** Search criteria by query string. */
export function searchCriteria(raw: string, limit = 100): SearchResult[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const scored: SearchResult[] = [];

  for (const c of WCAG_CRITERIA) {
    let score: number | null = null;

    // Ref matching (exact or prefix)
    if (c.ref === q) {
      score = -1000;
    } else if (c.ref.startsWith(q)) {
      score = -500;
    }

    // Title matching
    const titleLower = c.title.toLowerCase();
    if (titleLower === q) {
      score = score === null ? -300 : Math.min(score, -300);
    } else if (titleLower.startsWith(q)) {
      score = score === null ? -200 : Math.min(score, -200);
    } else {
      const idx = titleLower.indexOf(q);
      if (idx >= 0) {
        score = score === null ? idx : Math.min(score, idx);
      }
    }

    // Description matching (lowest priority)
    if (score === null) {
      const idx = c.description.toLowerCase().indexOf(q);
      if (idx >= 0) score = 1000 + idx;
    }

    if (score !== null) scored.push({ criterion: c, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.criterion.ref.localeCompare(b.criterion.ref);
  });
  return scored.slice(0, limit);
}

/** Top-level query: apply level filter, then search within the filtered set. */
export function queryCriteria(level: LevelFilter, raw: string): readonly WcagCriterion[] {
  const filtered = filterByLevel(level);
  const q = raw.trim();
  if (!q) return filtered;
  const filteredSet = new Set(filtered);
  const hits = searchCriteria(raw, Number.MAX_SAFE_INTEGER);
  return hits.filter(h => filteredSet.has(h.criterion)).map(h => h.criterion);
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseWcagReferenceReturn {
  query: Ref<string>;
  level: Ref<LevelFilter>;
  results: ComputedRef<readonly WcagCriterion[]>;
  totalCount: number;
  levelCounts: Record<WcagLevel, number>;
  levels: readonly WcagLevel[];
  principles: typeof WCAG_PRINCIPLES;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useWcagReference(): UseWcagReferenceReturn {
  const query = ref<string>('');
  const level = ref<LevelFilter>('all');

  const results = computed(() => queryCriteria(level.value, query.value));

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
      if (typeof p.search === 'string') query.value = p.search;
      if (typeof p.ref === 'string') query.value = p.ref;
      if (
        typeof p.level === 'string' &&
        (p.level === 'all' || WCAG_LEVELS.includes(p.level as WcagLevel))
      ) {
        level.value = p.level as LevelFilter;
      }
    },
    output: [results, query, level],
    toOutput: () => ({
      query: query.value,
      level: level.value,
      count: results.value.length,
      results: results.value.map(c => ({
        ref: c.ref,
        title: c.title,
        level: c.level,
        description: c.description,
        url: c.url,
      })),
    }),
  });

  return {
    query,
    level,
    results,
    totalCount: WCAG_CRITERIA.length,
    levelCounts: WCAG_LEVEL_COUNTS,
    levels: WCAG_LEVELS,
    principles: WCAG_PRINCIPLES,
    isEmbed,
    embedInput,
  };
}
