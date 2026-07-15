/**
 * useToolSearch — global tool search composable.
 *
 * Provides ranked search across all registered tools (name, description,
 * keywords, category label), recent-search persistence in LocalStorage,
 * curated suggestions for the empty state, and keyboard-shortcut handling
 * (`/` or `Ctrl+K` to focus, `Esc` to close).
 *
 * Pure helpers (`tokenizeQuery`, `rankedSearch`, recent-search storage) are
 * exported separately so they can be unit-tested without a Vue runtime.
 */
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from 'vue';
import {
  TOOLS,
  CATEGORIES,
  getCategoryById,
  type ToolMetadata,
} from '@/data/tools';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** Where a query term matched a tool (used for highlight + match-reason label). */
export type MatchField = 'name' | 'description' | 'keywords' | 'category';

/** A single ranked search result. */
export interface SearchResult {
  tool: ToolMetadata;
  /** Aggregate score across all query terms (higher = better). */
  score: number;
  /** Fields that matched at least one term. */
  matchedFields: MatchField[];
  /** Human-readable category label (cached for display). */
  categoryLabel: string;
}

/** Storage record for recent searches. */
export interface RecentSearchEntry {
  query: string;
  /** Unix ms timestamp of last use. */
  timestamp: number;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const RECENT_STORAGE_KEY = 'q-tools-recent-searches';
/** Maximum number of recent searches kept in LocalStorage. */
export const RECENT_MAX = 8;

/**
 * Curated list of popular tool slugs shown as suggestions in the empty state.
 * Ordered by perceived general usefulness.
 */
const SUGGESTED_SLUGS: readonly string[] = [
  'uuid-generator',
  'hash-text',
  'base64-string',
  'json-prettify-and-format',
  'qr-code-generator',
  'color-converter',
  'jwt-parser',
  'regex-tester',
];

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Split a raw query into normalised search terms.
 *
 * Terms are lowercased, trimmed, deduped (first-seen order), and empty
 * strings are dropped. Whitespace is the only delimiter — quoted phrases are
 * not specially handled because tool names/keywords are short.
 */
export function tokenizeQuery(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of query.split(/\s+/)) {
    const term = raw.trim().toLowerCase();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    out.push(term);
  }
  return out;
}

/** Case-insensitive containment check. */
function contains(haystack: string, needle: string): boolean {
  return haystack.length > 0 && needle.length > 0 && haystack.includes(needle);
}

/**
 * Score a single term against a tool's searchable text.
 *
 * Scoring weights (higher = better match):
 *   - name exact match:      100
 *   - name prefix match:      60
 *   - name substring match:   30
 *   - keyword exact match:    50
 *   - keyword prefix match:   25
 *   - keyword substring:      12
 *   - description substring:  10
 *   - category label match:    8
 *   - category id match:       6
 *
 * A term can match multiple fields; the highest single-field score wins per
 * term, and the field is recorded in `matchedFields`.
 */
function scoreTerm(
  term: string,
  tool: ToolMetadata,
  categoryLabel: string,
): { score: number; field: MatchField | null } {
  const name = tool.name.toLowerCase();
  const description = tool.description.toLowerCase();
  const category = tool.category.toLowerCase();
  const catLabel = categoryLabel.toLowerCase();

  let best = 0;
  let bestField: MatchField | null = null;

  if (name === term) {
    return { score: 100, field: 'name' };
  }
  if (name.startsWith(term)) {
    best = 60;
    bestField = 'name';
  } else if (contains(name, term)) {
    best = 30;
    bestField = 'name';
  }

  for (const kw of tool.keywords) {
    const k = kw.toLowerCase();
    if (k === term) {
      if (50 > best) {
        best = 50;
        bestField = 'keywords';
      }
      break;
    }
    if (k.startsWith(term)) {
      if (25 > best) {
        best = 25;
        bestField = 'keywords';
      }
    } else if (contains(k, term)) {
      if (12 > best) {
        best = 12;
        bestField = 'keywords';
      }
    }
  }

  if (contains(description, term)) {
    if (10 > best) {
      best = 10;
      bestField = 'description';
    }
  }

  if (contains(catLabel, term)) {
    if (8 > best) {
      best = 8;
      bestField = 'category';
    }
  }
  if (contains(category, term)) {
    if (6 > best) {
      best = 6;
      bestField = 'category';
    }
  }

  return { score: best, field: bestField };
}

/**
 * Ranked search across the tool registry.
 *
 * Returns results sorted by descending score; ties break on declaration
 * order (stable). Tools with a zero score (no term matched) are excluded.
 * An empty query returns every tool (score 0, no matched fields) so callers
 * can use the same code path for "show all" and "filter".
 */
export function rankedSearch(
  query: string,
  tools: readonly ToolMetadata[] = TOOLS,
): SearchResult[] {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) {
    return tools.map((tool) => ({
      tool,
      score: 0,
      matchedFields: [],
      categoryLabel: getCategoryById(tool.category)?.label ?? tool.category,
    }));
  }

  const results: SearchResult[] = [];
  for (const tool of tools) {
    const categoryLabel = getCategoryById(tool.category)?.label ?? tool.category;
    let total = 0;
    const fields = new Set<MatchField>();
    for (const term of terms) {
      const { score, field } = scoreTerm(term, tool, categoryLabel);
      total += score;
      if (field) fields.add(field);
    }
    if (total > 0) {
      results.push({
        tool,
        score: total,
        matchedFields: [...fields],
        categoryLabel,
      });
    }
  }
  // Stable sort by descending score (preserve declaration order for ties).
  results.sort((a, b) => b.score - a.score);
  return results;
}

/* -------------------------------------------------------------------------- */
/* Recent-search storage (LocalStorage)                                        */
/* -------------------------------------------------------------------------- */

/** Safe LocalStorage read with JSON parse + shape validation. */
export function loadRecentSearches(): RecentSearchEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecentSearchEntry[] = [];
    for (const entry of parsed) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof entry.query === 'string' &&
        typeof entry.timestamp === 'number'
      ) {
        out.push({ query: entry.query, timestamp: entry.timestamp });
      }
    }
    return out.slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Persist the recent-search list (best-effort, swallows quota errors). */
function persistRecent(entries: RecentSearchEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries.slice(0, RECENT_MAX)));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/**
 * Add (or bump) a query in the recent-search list.
 *
 * The query is trimmed; empty/whitespace-only queries are ignored. Existing
 * entries with the same case-insensitive query are moved to the front and
 * their timestamp is updated. The list is capped at `RECENT_MAX`.
 */
export function saveRecentSearch(query: string): RecentSearchEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return loadRecentSearches();
  const now = Date.now();
  const lower = trimmed.toLowerCase();
  const existing = loadRecentSearches().filter(
    (e) => e.query.toLowerCase() !== lower,
  );
  const next = [{ query: trimmed, timestamp: now }, ...existing].slice(0, RECENT_MAX);
  persistRecent(next);
  return next;
}

/** Remove a single recent entry by exact query string. */
export function removeRecentSearch(query: string): RecentSearchEntry[] {
  const lower = query.toLowerCase();
  const next = loadRecentSearches().filter((e) => e.query.toLowerCase() !== lower);
  persistRecent(next);
  return next;
}

/** Clear the entire recent-search list. */
export function clearRecentSearches(): RecentSearchEntry[] {
  persistRecent([]);
  return [];
}

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Curated suggestion results for the empty state.
 *
 * Resolves `SUGGESTED_SLUGS` against the registry; unknown slugs are skipped
 * so the list stays valid even if a tool is renamed.
 */
export function getSuggestedTools(): SearchResult[] {
  return SUGGESTED_SLUGS.flatMap((slug) => {
    const tool = TOOLS.find((t) => t.slug === slug);
    if (!tool) return [];
    return [
      {
        tool,
        score: 0,
        matchedFields: [],
        categoryLabel: getCategoryById(tool.category)?.label ?? tool.category,
      },
    ];
  });
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseToolSearchOptions {
  /** Maximum number of results to expose (default 10). */
  maxResults?: number;
  /** Whether to register the global `/` and Ctrl+K shortcut (default true). */
  registerShortcut?: boolean;
}

export interface UseToolSearchReturn {
  /** Current query string (two-way bindable). */
  query: Ref<string>;
  /** Ranked search results (capped at `maxResults`). */
  results: ComputedRef<SearchResult[]>;
  /** Total number of matches (before capping) — for "N tools matched" UI. */
  totalMatches: ComputedRef<number>;
  /** Recent searches loaded from LocalStorage. */
  recent: Ref<RecentSearchEntry[]>;
  /** Curated suggestion results for the empty state. */
  suggestions: ShallowRef<SearchResult[]>;
  /** Whether the dropdown panel is open. */
  isOpen: Ref<boolean>;
  /** Index of the keyboard-highlighted result (-1 = none). */
  activeIndex: Ref<number>;
  /** The underlying input element ref (set by the component via `inputEl`). */
  inputEl: Ref<HTMLInputElement | null>;
  /** Focus the search input and open the dropdown. */
  focus: () => void;
  /** Blur the input and close the dropdown. */
  close: () => void;
  /** Clear the query (does not blur). */
  clear: () => void;
  /** Move the keyboard highlight up (wraps to bottom). */
  moveUp: () => void;
  /** Move the keyboard highlight down (wraps to top). */
  moveDown: () => void;
  /** Select the currently highlighted result (or no-op if none). */
  selectActive: () => SearchResult | null;
  /** Record the current query in recent searches. */
  addRecent: () => void;
  /** Remove a recent entry and refresh the list. */
  removeRecent: (query: string) => void;
  /** Clear all recent searches. */
  clearRecent: () => void;
}

/**
 * Global tool search composable.
 *
 * Usage:
 *   const search = useToolSearch();
 *   // bind `search.query` to an <input>, render `search.results`, etc.
 */
export function useToolSearch(options: UseToolSearchOptions = {}): UseToolSearchReturn {
  const { maxResults = 10, registerShortcut = true } = options;

  const query = ref('');
  const recent = ref<RecentSearchEntry[]>(loadRecentSearches());
  const suggestions = shallowRef<SearchResult[]>(getSuggestedTools());
  const isOpen = ref(false);
  const activeIndex = ref(-1);
  const inputEl = ref<HTMLInputElement | null>(null);

  const allResults = computed<SearchResult[]>(() => rankedSearch(query.value));
  const totalMatches = computed<number>(() => allResults.value.length);
  const results = computed<SearchResult[]>(() => allResults.value.slice(0, maxResults));

  function focus(): void {
    isOpen.value = true;
    // Defer focus to the next microtask so the input is mounted/visible.
    queueMicrotask(() => {
      inputEl.value?.focus();
      inputEl.value?.select();
    });
  }

  function close(): void {
    isOpen.value = false;
    activeIndex.value = -1;
    inputEl.value?.blur();
  }

  function clear(): void {
    query.value = '';
    activeIndex.value = -1;
  }

  function moveUp(): void {
    const len = results.value.length;
    if (len === 0) return;
    activeIndex.value = activeIndex.value <= 0 ? len - 1 : activeIndex.value - 1;
  }

  function moveDown(): void {
    const len = results.value.length;
    if (len === 0) return;
    activeIndex.value = activeIndex.value >= len - 1 ? 0 : activeIndex.value + 1;
  }

  function selectActive(): SearchResult | null {
    if (activeIndex.value < 0 || activeIndex.value >= results.value.length) return null;
    return results.value[activeIndex.value] ?? null;
  }

  function addRecent(): void {
    const trimmed = query.value.trim();
    if (!trimmed) return;
    recent.value = saveRecentSearch(trimmed);
  }

  function removeRecent(q: string): void {
    recent.value = removeRecentSearch(q);
  }

  function clearRecent(): void {
    recent.value = clearRecentSearches();
  }

  /* ---- Global keyboard shortcut (`/` or Ctrl/Cmd+K) ---- */
  function onKeydown(e: KeyboardEvent): void {
    // Ctrl+K / Cmd+K → focus search from anywhere.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      focus();
      return;
    }
    // `/` → focus search, but only when not already typing in an input.
    if (e.key === '/' && !isTypingTarget(e.target)) {
      e.preventDefault();
      focus();
    }
  }

  function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      target.isContentEditable
    );
  }

  onMounted(() => {
    if (registerShortcut && typeof document !== 'undefined') {
      document.addEventListener('keydown', onKeydown);
    }
  });

  onBeforeUnmount(() => {
    if (registerShortcut && typeof document !== 'undefined') {
      document.removeEventListener('keydown', onKeydown);
    }
  });

  return {
    query,
    results,
    totalMatches,
    recent,
    suggestions,
    isOpen,
    activeIndex,
    inputEl,
    focus,
    close,
    clear,
    moveUp,
    moveDown,
    selectActive,
    addRecent,
    removeRecent,
    clearRecent,
  };
}

/* Re-exported for callers that need the raw category list. */
export { CATEGORIES };
