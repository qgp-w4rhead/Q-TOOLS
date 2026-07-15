/**
 * Favorites store — star tools and sync with the backend.
 *
 * Each favorite is keyed by `toolSlug` and carries a `createdAt` +
 * `updatedAt` timestamp (ms epoch). Deletions are recorded as
 * tombstones (`deleted: true`) so an offline unfavorite can be synced
 * to the backend on reconnect.
 *
 * Storage strategy:
 * - Always persisted to LocalStorage (`q-tools-favorites`) so favorites
 *   survive reloads and work offline / when not logged in.
 * - When the auth store reports `isAuthenticated`, `syncWithBackend()`
 *   fetches the remote list, merges by newest `updatedAt` (conflict
 *   resolution), and pushes diffs (POST new favorites, DELETE
 *   tombstoned ones, PATCH label changes).
 *
 * Pure helpers (`mergeFavorites`, `activeFavorites`, etc.) are exported
 * for unit testing without a Pinia instance.
 */
import { defineStore } from 'pinia';
import type { Favorite } from '@q-tools/shared';
import { api, ApiError } from '@/utils/api';

const STORAGE_KEY = 'q-tools-favorites';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface FavoriteEntry {
  toolSlug: string;
  label?: string;
  /** ms epoch — when the favorite was first created locally. */
  createdAt: number;
  /** ms epoch — last modification time (used for merge/conflict). */
  updatedAt: number;
  /** Tombstone flag — when true the favorite was removed locally but
   *  the deletion has not yet been synced to the backend. */
  deleted?: boolean;
}

interface PersistedPayload {
  entries: FavoriteEntry[];
  lastSyncedAt: number | null;
  syncing: boolean;
  syncError: string | null;
}

/* ------------------------------------------------------------------ */
/* Pure helpers (exported for testing)                                 */
/* ------------------------------------------------------------------ */

/** Coerce an arbitrary partial into a well-formed FavoriteEntry. */
export function normalizeEntry(raw: Partial<FavoriteEntry>): FavoriteEntry {
  const now = Date.now();
  const createdAt = typeof raw.createdAt === 'number' && raw.createdAt > 0 ? raw.createdAt : now;
  const updatedAt = typeof raw.updatedAt === 'number' && raw.updatedAt > 0 ? raw.updatedAt : createdAt;
  const entry: FavoriteEntry = {
    toolSlug: String(raw.toolSlug ?? '').trim(),
    createdAt,
    updatedAt,
  };
  if (raw.label !== undefined && raw.label !== null && String(raw.label).length > 0) {
    entry.label = String(raw.label).slice(0, 64);
  }
  if (raw.deleted) {
    entry.deleted = true;
  }
  return entry;
}

/** Convert a backend `Favorite` (ISO createdAt, no updatedAt) to an entry. */
export function remoteToEntry(fav: Favorite): FavoriteEntry {
  const created = Date.parse(fav.createdAt) || Date.now();
  return {
    toolSlug: fav.toolSlug,
    label: fav.label,
    createdAt: created,
    // Backend doesn't expose updatedAt; treat createdAt as the merge ts.
    updatedAt: created,
  };
}

/**
 * Merge two favorite lists by `toolSlug`. For each slug present on
 * either side, the entry with the newer `updatedAt` wins — including
 * tombstones (a newer tombstone removes the favorite; an older
 * tombstone loses to a newer active entry).
 *
 * Returns the full merged list (active + tombstones) so callers can
 * persist tombstones for a later sync.
 */
export function mergeFavorites(
  local: FavoriteEntry[],
  remote: FavoriteEntry[],
): FavoriteEntry[] {
  const map = new Map<string, FavoriteEntry>();
  for (const entry of local) {
    if (!entry.toolSlug) continue;
    map.set(entry.toolSlug, entry);
  }
  for (const entry of remote) {
    if (!entry.toolSlug) continue;
    const existing = map.get(entry.toolSlug);
    if (!existing) {
      map.set(entry.toolSlug, entry);
      continue;
    }
    // Newest updatedAt wins. Ties prefer the active (non-deleted) entry
    // so a re-favorite at the same instant isn't masked by a tombstone.
    const existingTs = existing.updatedAt;
    const remoteTs = entry.updatedAt;
    if (remoteTs > existingTs) {
      map.set(entry.toolSlug, entry);
    } else if (remoteTs === existingTs) {
      if (!entry.deleted) {
        map.set(entry.toolSlug, entry);
      } else if (!existing.deleted) {
        // keep existing (active)
      } else {
        map.set(entry.toolSlug, entry);
      }
    }
    // else existing wins (no change).
  }
  return Array.from(map.values());
}

/** Filter out tombstones — the active favorites list. */
export function activeFavorites(entries: FavoriteEntry[]): FavoriteEntry[] {
  return entries.filter((e) => !e.deleted);
}

/** Serialize entries for LocalStorage (sync flags are not persisted). */
export function serializeEntries(entries: FavoriteEntry[], lastSyncedAt: number | null): string {
  const payload = { entries, lastSyncedAt };
  return JSON.stringify(payload);
}

/** Deserialize entries from LocalStorage. Tolerant of legacy shapes. */
export function deserializeEntries(raw: string | null): PersistedPayload {
  const base: PersistedPayload = { entries: [], lastSyncedAt: null, syncing: false, syncError: null };
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<{ entries: FavoriteEntry[]; lastSyncedAt: number | null }> | FavoriteEntry[];
    // Legacy shape: bare array of entries.
    if (Array.isArray(parsed)) {
      return { ...base, entries: parsed.map(normalizeEntry) };
    }
    const entries = Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry) : [];
    const lastSyncedAt =
      typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null;
    return { ...base, entries, lastSyncedAt };
  } catch {
    return base;
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useFavoritesStore = defineStore('favorites', {
  state: (): PersistedPayload => {
    if (typeof localStorage === 'undefined') {
      return { entries: [], lastSyncedAt: null, syncing: false, syncError: null };
    }
    return deserializeEntries(localStorage.getItem(STORAGE_KEY));
  },
  getters: {
    /** Active (non-tombstoned) favorites, newest first. */
    favorites: (state): FavoriteEntry[] =>
      activeFavorites(state.entries).sort((a, b) => b.updatedAt - a.updatedAt),

    count(): number {
      return this.favorites.length;
    },
  },
  actions: {
    /** Persist current state to LocalStorage. */
    _persist() {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          serializeEntries(this.entries, this.lastSyncedAt),
        );
      } catch {
        /* ignore quota / privacy mode errors */
      }
    },

    /** Whether a tool slug is currently favourited. */
    isFavorite(slug: string): boolean {
      return this.entries.some((e) => e.toolSlug === slug && !e.deleted);
    },

    /** Find an entry (active or tombstone) by slug. */
    _find(slug: string): FavoriteEntry | undefined {
      return this.entries.find((e) => e.toolSlug === slug);
    },

    /** Add a favorite (no-op if already active). */
    add(slug: string, label?: string) {
      const trimmed = slug.trim();
      if (!trimmed) return;
      const existing = this._find(trimmed);
      const now = Date.now();
      if (existing) {
        if (!existing.deleted && existing.label === label) return;
        existing.deleted = false;
        existing.label = label;
        existing.updatedAt = now;
      } else {
        this.entries.push(
          normalizeEntry({
            toolSlug: trimmed,
            label,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
      this._persist();
    },

    /** Remove (tombstone) a favorite. */
    remove(slug: string) {
      const trimmed = slug.trim();
      const existing = this._find(trimmed);
      if (!existing) return;
      if (existing.deleted) return;
      existing.deleted = true;
      existing.updatedAt = Date.now();
      this._persist();
    },

    /** Toggle a favorite on/off. Returns the new state. */
    toggle(slug: string, label?: string): boolean {
      if (this.isFavorite(slug)) {
        this.remove(slug);
        return false;
      }
      this.add(slug, label);
      return true;
    },

    /** Clear all favorites (used for debugging / reset). */
    clearAll() {
      this.entries = [];
      this.lastSyncedAt = null;
      this.syncing = false;
      this.syncError = null;
      this._persist();
    },

    /**
     * Sync with the backend. Requires an authenticated session. Steps:
     *  1. Fetch remote favorites (GET /api/users/favorites).
     *  2. Merge remote into local by newest updatedAt.
     *  3. Push diffs:
     *     - active + not in remote        → POST (create on backend)
     *     - tombstone + in remote         → DELETE (remove on backend)
     *     - active + in remote + label    → DELETE + POST (re-create with
     *       changed                        new label; backend has no PATCH)
     *  4. Persist merged local state + lastSyncedAt.
     */
    async syncWithBackend(): Promise<void> {
      // Lazy import to avoid a hard dependency cycle / Pinia boot order.
      const { useAuthStore } = await import('@/stores/authStore');
      const auth = useAuthStore();
      if (!auth.isAuthenticated) return;

      this.syncing = true;
      this.syncError = null;
      try {
        const { data: remote } = await api.get<Favorite[]>('/api/users/favorites');
        const remoteEntries = remote.map(remoteToEntry);
        const merged = mergeFavorites(this.entries, remoteEntries);

        // Index remote by slug for diff lookups.
        const remoteBySlug = new Map<string, Favorite>();
        for (const r of remote) remoteBySlug.set(r.toolSlug, r);

        for (const entry of merged) {
          const inRemote = remoteBySlug.has(entry.toolSlug);
          if (entry.deleted) {
            if (inRemote) {
              const remoteFav = remoteBySlug.get(entry.toolSlug)!;
              try {
                await api.delete(`/api/users/favorites/${remoteFav.id}`);
              } catch (err) {
                if (!(err instanceof ApiError && err.status === 404)) throw err;
              }
            }
            continue;
          }
          // entry is active
          if (!inRemote) {
            // Create on backend. Ignore 409 (already exists).
            try {
              await api.post<Favorite>('/api/users/favorites', {
                toolSlug: entry.toolSlug,
                label: entry.label,
              });
            } catch (err) {
              if (!(err instanceof ApiError && err.status === 409)) throw err;
            }
          } else {
            // Exists on both sides — check for label change.
            // The backend has no PATCH endpoint, so we DELETE + POST
            // to update the label. Only do this when the local entry
            // won the merge (newer updatedAt), indicating a local edit.
            const remoteFav = remoteBySlug.get(entry.toolSlug)!;
            const localWon = entry.updatedAt > remoteToEntry(remoteFav).updatedAt;
            const labelChanged =
              (entry.label ?? undefined) !== (remoteFav.label ?? undefined);
            if (localWon && labelChanged) {
              try {
                await api.delete(`/api/users/favorites/${remoteFav.id}`);
              } catch (err) {
                if (!(err instanceof ApiError && err.status === 404)) throw err;
              }
              try {
                await api.post<Favorite>('/api/users/favorites', {
                  toolSlug: entry.toolSlug,
                  label: entry.label,
                });
              } catch (err) {
                if (!(err instanceof ApiError && err.status === 409)) throw err;
              }
            }
          }
        }

        // Drop tombstones that are no longer in remote (fully synced).
        this.entries = merged.filter(
          (e) => !(e.deleted && !remoteBySlug.has(e.toolSlug)),
        );
        this.lastSyncedAt = Date.now();
        this._persist();
      } catch (err) {
        this.syncError = err instanceof Error ? err.message : String(err);
        // Still persist any local-only changes; sync will retry next time.
        this._persist();
      } finally {
        this.syncing = false;
      }
    },

    /** Reload from LocalStorage (used after external changes). */
    loadFromStorage() {
      if (typeof localStorage === 'undefined') return;
      const payload = deserializeEntries(localStorage.getItem(STORAGE_KEY));
      this.entries = payload.entries;
      this.lastSyncedAt = payload.lastSyncedAt;
    },
  },
});
