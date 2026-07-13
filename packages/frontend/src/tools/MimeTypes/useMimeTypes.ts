/**
 * useMimeTypes — composable + pure logic for the MIME types lookup tool.
 *
 * Provides bidirectional lookup between file extensions and MIME types using
 * the bundled `mimeDatabase.ts` (no external dependency). A single search
 * box auto-detects whether the query looks like an extension (`.txt`, `txt`)
 * or a MIME type (`text/plain`) and returns the appropriate results.
 *
 * Pure helpers (`normalizeExtension`, `normalizeMimeType`, `lookupByExtension`,
 * `lookupByMimeType`, `searchMimeTypes`, `detectQueryKind`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `useMimeTypes()` composable wraps them in reactive state and wires up the
 * embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  MIME_BY_EXTENSION,
  EXTENSIONS_BY_MIME,
  ENTRY_BY_EXTENSION,
  ENTRY_BY_MIME,
  ALL_MIME_TYPES,
  ALL_EXTENSIONS,
  type MimeEntry,
  type MimeCategory,
} from './mimeDatabase';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** The kind of query the user typed. */
export type QueryKind = 'extension' | 'mime' | 'unknown';

/** Result of looking up a single extension. */
export interface ExtensionLookupResult {
  kind: 'extension';
  query: string;
  extension: string;
  mime: string;
  entry: MimeEntry;
}

/** Result of looking up a single MIME type. */
export interface MimeLookupResult {
  kind: 'mime';
  query: string;
  mime: string;
  extensions: string[];
  entry: MimeEntry;
}

/** A search hit used in the fuzzy results list. */
export interface SearchHit {
  ext: string;
  mime: string;
  name: string;
  category: MimeCategory;
  /** Lower-case string used for scoring (ext + mime + name). */
  haystack: string;
}

/** Union result returned by `searchMimeTypes`. */
export type LookupResult =
  | ExtensionLookupResult
  | MimeLookupResult
  | { kind: 'none'; query: string }
  | { kind: 'search'; query: string; hits: SearchHit[] };

/**
 * Normalise a raw extension query into a canonical lowercase extension without
 * a leading dot. Handles inputs like `.TXT`, `Txt`, `*.js`, `file.json` (takes
 * the last segment after a dot). Returns the empty string for blank input.
 */
export function normalizeExtension(raw: string): string {
  if (!raw) return '';
  let s = raw.trim().toLowerCase();
  // Strip a leading "*." glob prefix.
  if (s.startsWith('*.')) s = s.slice(2);
  // If the input looks like a filename (contains a slash or has multiple dots
  // with a basename), extract the final extension.
  const lastSlash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
  if (lastSlash >= 0) s = s.slice(lastSlash + 1);
  const lastDot = s.lastIndexOf('.');
  if (lastDot >= 0) s = s.slice(lastDot + 1);
  // Strip a leading dot if only one was present (e.g. ".txt").
  if (s.startsWith('.')) s = s.slice(1);
  return s;
}

/**
 * Normalise a raw MIME-type query: trim + lowercase, strip a leading
 * `Content-Type:` header prefix, strip parameters (`; charset=utf-8`).
 */
export function normalizeMimeType(raw: string): string {
  if (!raw) return '';
  let s = raw.trim().toLowerCase();
  // Strip a leading "content-type:" header prefix.
  const colon = s.indexOf(':');
  if (colon >= 0 && s.slice(0, colon).endsWith('content-type')) {
    s = s.slice(colon + 1).trim();
  }
  // Strip parameters after ";".
  const semi = s.indexOf(';');
  if (semi >= 0) s = s.slice(0, semi).trim();
  return s;
}

/**
 * Detect whether a raw query looks like an extension or a MIME type.
 *
 * - Contains a "/" → MIME type.
 * - Starts with "." or is a bare alphanumeric token with no "/" → extension.
 * - Otherwise → unknown (the caller can fall back to a fuzzy search).
 */
export function detectQueryKind(raw: string): QueryKind {
  if (!raw) return 'unknown';
  const s = raw.trim().toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('/')) return 'mime';
  // A leading dot strongly implies an extension.
  if (s.startsWith('.')) return 'extension';
  // A bare token with no slash and no spaces: could be an extension.
  if (!s.includes(' ') && /^[a-z0-9]+$/i.test(s)) return 'extension';
  return 'unknown';
}

/**
 * Look up the primary MIME type for an extension. Returns `null` if the
 * extension is not in the database.
 */
export function lookupByExtension(
  raw: string,
): ExtensionLookupResult | null {
  const ext = normalizeExtension(raw);
  if (!ext) return null;
  const mime = MIME_BY_EXTENSION.get(ext);
  const entry = ENTRY_BY_EXTENSION.get(ext);
  if (!mime || !entry) return null;
  return { kind: 'extension', query: raw, extension: ext, mime, entry };
}

/**
 * Look up the extensions for a MIME type. Returns `null` if the MIME type is
 * not in the database.
 */
export function lookupByMimeType(raw: string): MimeLookupResult | null {
  const mime = normalizeMimeType(raw);
  if (!mime) return null;
  const extensions = EXTENSIONS_BY_MIME.get(mime);
  const entry = ENTRY_BY_MIME.get(mime);
  if (!extensions || !entry) return null;
  return { kind: 'mime', query: raw, mime, extensions, entry };
}

/** Build the searchable hit list once (module-level cache). */
const SEARCH_HITS: readonly SearchHit[] = (() => {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const entry of ENTRY_BY_EXTENSION.values()) {
    const key = entry.ext + '|' + entry.mime;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ext: entry.ext,
      mime: entry.mime,
      name: entry.name,
      category: entry.category,
      haystack: `${entry.ext} ${entry.mime} ${entry.name.toLowerCase()}`,
    });
  }
  return out;
})();

/**
 * Fuzzy substring search across extensions, MIME types, and names. Returns
 * hits sorted by relevance (earliest match position, then alphabetical).
 * Caps the result count at `limit` (default 50).
 */
export function searchMimeTypes(
  raw: string,
  limit = 50,
): SearchHit[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const scored: { hit: SearchHit; score: number }[] = [];
  for (const hit of SEARCH_HITS) {
    const idx = hit.haystack.indexOf(q);
    if (idx < 0) continue;
    // Lower score = better (earlier match). Prefix matches on the extension
    // are ranked highest.
    let score = idx;
    if (hit.ext.startsWith(q)) score = -1000;
    else if (hit.mime.startsWith(q)) score = -500;
    scored.push({ hit, score });
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.hit.ext.localeCompare(b.hit.ext);
  });
  return scored.slice(0, limit).map((s) => s.hit);
}

/**
 * Top-level lookup: auto-detect the query kind and dispatch to the right
 * helper. Falls back to a fuzzy search when the exact lookup misses.
 */
export function searchMimeTypesFull(raw: string): LookupResult {
  if (!raw.trim()) return { kind: 'none', query: raw };
  const kind = detectQueryKind(raw);
  if (kind === 'extension') {
    const exact = lookupByExtension(raw);
    if (exact) return exact;
  } else if (kind === 'mime') {
    const exact = lookupByMimeType(raw);
    if (exact) return exact;
  }
  // Fuzzy fallback for both unknown queries and missed exact lookups.
  const hits = searchMimeTypes(raw);
  if (hits.length === 0) return { kind: 'none', query: raw };
  return { kind: 'search', query: raw, hits };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseMimeTypesReturn {
  query: Ref<string>;
  result: ComputedRef<LookupResult>;
  totalCount: ComputedRef<number>;
  extensionCount: ComputedRef<number>;
  mimeCount: ComputedRef<number>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useMimeTypes(): UseMimeTypesReturn {
  const query = ref<string>('');

  const result = computed(() => searchMimeTypesFull(query.value));

  const totalCount = computed(() => SEARCH_HITS.length);
  const extensionCount = computed(() => ALL_EXTENSIONS.length);
  const mimeCount = computed(() => ALL_MIME_TYPES.length);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
      if (typeof p.extension === 'string') {
        query.value = p.extension.startsWith('.')
          ? p.extension
          : `.${p.extension}`;
      }
      if (typeof p.mime === 'string') query.value = p.mime;
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      const payload: Record<string, unknown> = { query: query.value };
      if (r.kind === 'extension') {
        payload.mime = r.mime;
        payload.extension = r.extension;
        payload.name = r.entry.name;
        payload.category = r.entry.category;
      } else if (r.kind === 'mime') {
        payload.mime = r.mime;
        payload.extensions = r.extensions;
        payload.name = r.entry.name;
        payload.category = r.entry.category;
      } else if (r.kind === 'search') {
        payload.hits = r.hits;
      }
      sendOutput(payload);
    }
  });

  return {
    query,
    result,
    totalCount,
    extensionCount,
    mimeCount,
    isEmbed,
    embedInput,
  };
}
