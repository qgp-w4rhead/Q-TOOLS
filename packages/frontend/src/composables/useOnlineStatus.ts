/**
 * useOnlineStatus — singleton composable tracking the browser's connectivity.
 *
 * Reactive `isOnline` mirrors `navigator.onLine` and updates on the window
 * `online` / `offline` events. `wasOffline` records whether the session has
 * ever dropped offline (useful for surfacing a "reconnected" toast). The
 * listeners are registered once (module-scoped) and shared across every
 * component that calls `useOnlineStatus()`.
 *
 * Pure helpers (`computeIsOnline`, `shouldShowOfflineBanner`) are exported
 * separately so they can be unit-tested without a DOM.
 */

import { ref, readonly } from 'vue';

// ---- Types ----

export interface OnlineStatusState {
  isOnline: boolean;
  wasOffline: boolean;
}

// ---- Pure helpers (exported for unit testing) ----

/**
 * Compute the initial online status from a (possibly absent) `navigator`.
 * Returns `true` when `navigator.onLine` is unavailable — browsers without
 * the API are assumed to be online to avoid false offline banners.
 */
export function computeIsOnline(nav: { onLine?: boolean } | undefined): boolean {
  if (!nav || typeof nav.onLine !== 'boolean') return true;
  return nav.onLine;
}

/**
 * Decide whether the offline banner should be shown given the current state
 * and whether the user has dismissed it for the current offline episode.
 *
 * The banner shows when offline AND not dismissed. It auto-hides on
 * reconnect (the OfflineBanner component resets `dismissed` when `isOnline`
 * flips back to true).
 */
export function shouldShowOfflineBanner(
  isOnline: boolean,
  dismissed: boolean,
): boolean {
  return !isOnline && !dismissed;
}

// ---- Singleton reactive state (module-scoped) ----

const isOnlineRef = ref<boolean>(computeIsOnline(navigator));
const wasOfflineRef = ref<boolean>(false);
let listenersBound = false;

function handleOnline(): void {
  isOnlineRef.value = true;
}

function handleOffline(): void {
  isOnlineRef.value = false;
  wasOfflineRef.value = true;
}

/**
 * Bind the window `online` / `offline` listeners exactly once. Safe to call
 * from multiple components — subsequent calls are no-ops.
 */
export function bindOnlineListeners(win: Window & typeof globalThis = window): void {
  if (listenersBound) return;
  win.addEventListener('online', handleOnline);
  win.addEventListener('offline', handleOffline);
  listenersBound = true;
}

/**
 * Unbind listeners + reset state (used by tests).
 */
export function resetOnlineStatus(): void {
  if (listenersBound && typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  }
  listenersBound = false;
  isOnlineRef.value = computeIsOnline(navigator);
  wasOfflineRef.value = false;
}

// Bind on module load (browser only).
if (typeof window !== 'undefined') {
  bindOnlineListeners();
}

// ---- Composable ----

/**
 * Reactive online-status singleton. Returns readonly refs so callers cannot
 * mutate the shared state directly.
 */
export function useOnlineStatus() {
  return {
    isOnline: readonly(isOnlineRef),
    wasOffline: readonly(wasOfflineRef),
  };
}
