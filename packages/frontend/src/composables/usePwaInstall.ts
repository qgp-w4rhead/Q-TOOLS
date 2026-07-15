/**
 * usePwaInstall — singleton composable capturing the `beforeinstallprompt`
 * event so the app can surface an "Install Q-Tools" affordance on demand.
 *
 * Browsers fire `beforeinstallprompt` when the PWA is installable but have
 * not yet been installed. The event must be prevented (so the browser
 * doesn't show its own mini-infobar) and stashed; we later call
 * `prompt()` on it when the user clicks our install button.
 *
 * `dismissed` is persisted to LocalStorage so a user who dismisses the
 * prompt isn't nagged again in the same session window. The flag clears
 * automatically if the app is installed (`appinstalled` event) or if the
 * deferred prompt becomes available again.
 *
 * Pure helpers (`isInstallPromptEvent`, `loadDismissed`, `saveDismissed`,
 * `clearDismissed`) are exported for unit testing.
 */

import { ref, readonly, computed } from 'vue';

// ---- Types ----

/**
 * Minimal shape of the `BeforeInstallPromptEvent` we rely on. The real type
 * is not in the default TS DOM lib, so we declare the subset we use.
 */
export interface BeforeInstallPromptEventLike extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

const DISMISSED_KEY = 'q-tools-install-dismissed';

// ---- Pure helpers (exported for unit testing) ----

/**
 * Type guard for the subset of BeforeInstallPromptEvent we use.
 */
export function isInstallPromptEvent(
  e: unknown,
): e is BeforeInstallPromptEventLike {
  if (typeof e !== 'object' || e === null) return false;
  const ev = e as Partial<BeforeInstallPromptEventLike>;
  return (
    typeof ev.preventDefault === 'function' &&
    typeof ev.prompt === 'function' &&
    ev.userChoice instanceof Promise
  );
}

/**
 * Read the persisted dismissed flag from a storage-like object. Returns
 * `false` when storage is unavailable or the value is absent/invalid.
 */
export function loadDismissed(storage: Storage | undefined | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Persist the dismissed flag. No-ops when storage is unavailable.
 */
export function saveDismissed(storage: Storage | undefined | null, value: boolean): void {
  if (!storage) return;
  try {
    if (value) storage.setItem(DISMISSED_KEY, '1');
    else storage.removeItem(DISMISSED_KEY);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/**
 * Clear the dismissed flag (used after install or when re-prompting).
 */
export function clearDismissed(storage: Storage | undefined | null): void {
  saveDismissed(storage, false);
}

// ---- Singleton reactive state (module-scoped) ----

const deferredPromptRef = ref<BeforeInstallPromptEventLike | null>(null);
const dismissedRef = ref<boolean>(
  typeof localStorage !== 'undefined' ? loadDismissed(localStorage) : false,
);
const installedRef = ref<boolean>(false);
let listenersBound = false;

function handleBeforeInstallPrompt(e: Event): void {
  // Prevent the browser's mini-infobar; we show our own affordance.
  e.preventDefault();
  if (isInstallPromptEvent(e)) {
    deferredPromptRef.value = e;
    // A new prompt availability clears any prior dismissal.
    dismissedRef.value = false;
    saveDismissed(localStorage, false);
  }
}

function handleAppInstalled(): void {
  installedRef.value = true;
  deferredPromptRef.value = null;
  dismissedRef.value = false;
  clearDismissed(localStorage);
}

/**
 * Bind the `beforeinstallprompt` + `appinstalled` listeners exactly once.
 */
export function bindPwaInstallListeners(
  win: Window & typeof globalThis = window,
): void {
  if (listenersBound) return;
  win.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  win.addEventListener('appinstalled', handleAppInstalled);
  listenersBound = true;
}

/**
 * Unbind + reset (used by tests).
 */
export function resetPwaInstall(): void {
  if (listenersBound && typeof window !== 'undefined') {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  }
  listenersBound = false;
  deferredPromptRef.value = null;
  dismissedRef.value = loadDismissed(localStorage);
  installedRef.value = false;
}

// Bind on module load (browser only).
if (typeof window !== 'undefined') {
  bindPwaInstallListeners();
}

// ---- Composable ----

export function usePwaInstall() {
  const canInstall = computed(
    () => deferredPromptRef.value !== null && !installedRef.value,
  );

  const shouldShowPrompt = computed(
    () => canInstall.value && !dismissedRef.value,
  );

  /**
   * Trigger the native install prompt. Resolves to the user's choice
   * (`accepted` | `dismissed`). No-ops (returns `null`) when no deferred
   * prompt is available.
   */
  async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
    const deferred = deferredPromptRef.value;
    if (!deferred) return null;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    // The deferred prompt can only be used once.
    deferredPromptRef.value = null;
    if (choice.outcome === 'dismissed') {
      dismissedRef.value = true;
      saveDismissed(localStorage, true);
    }
    return choice.outcome;
  }

  /**
   * Dismiss the install affordance without showing the native prompt.
   * Persisted so the user isn't nagged again this session.
   */
  function dismiss(): void {
    dismissedRef.value = true;
    saveDismissed(localStorage, true);
  }

  return {
    canInstall: readonly(canInstall),
    shouldShowPrompt: readonly(shouldShowPrompt),
    installed: readonly(installedRef),
    dismissed: readonly(dismissedRef),
    promptInstall,
    dismiss,
  };
}
