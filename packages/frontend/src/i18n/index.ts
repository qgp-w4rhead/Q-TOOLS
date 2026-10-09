/**
 * i18n module - vue-i18n instance + locale loading helpers.
 *
 * - English messages are bundled eagerly (default + fallback locale).
 * - es/fr are lazy-loaded via dynamic import() so each locale ships as its
 *   own Vite chunk (cached by the PWA runtime CacheFirst /assets/ route).
 * - Messages are precompiled by @intlify/unplugin-vue-i18n at build time,
 *   so no runtime compiler is needed (CSP-safe for iframe embeds).
 *
 * `settingsStore.locale` is the single source of truth for the user's
 * persisted locale; main.ts watches it and calls `setActiveLocale`.
 * Embed views may call `setActiveLocale` directly (via `?lang=`) without
 * persisting - embeds must not clobber the user's stored preference.
 */
import type { WritableComputedRef } from 'vue';
import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import enTools from './locales/en-tools.json';
import type { SupportedLocale } from './types';

export type { MessageSchema, SupportedLocale } from './types';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'es', 'fr'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Locales whose messages are already loaded into the i18n instance. */
const loadedLocales = new Set<SupportedLocale>([DEFAULT_LOCALE]);

/** Type guard for arbitrary input (query params, stored values). */
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

// Note: intentionally unparameterized generics. Typing createI18n with a
// strict schema + locale union makes `messages` require every locale key
// upfront, which conflicts with lazy-loading es/fr. `MessageSchema` is still
// exported from ./types for components that want typed keys.
export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  // en.json holds shell UI; en-tools.json holds per-tool internals (ui.*).
  // Deep-merge the `tools` subtree so both coexist.
  messages: {
    en: {
      ...en,
      tools: { ...(en as { tools?: object }).tools, ...enTools.tools },
    },
  },
  // Surface missing/fallback keys during development only.
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV,
});

/**
 * Lazy-load a locale's messages into the i18n instance. No-op for English
 * (bundled) and for locales already loaded.
 */
export async function loadLocaleMessages(
  locale: SupportedLocale,
): Promise<void> {
  if (loadedLocales.has(locale)) return;
  const messages = await import(`./locales/${locale}.json`);
  i18n.global.setLocaleMessage(locale, messages.default);
  // Tool metadata translations live in a companion `<locale>-tools.json`
  // (kept separate so the shell file stays small and the large tools block
  // can be generated/maintained independently). Merged over base messages.
  try {
    const tools = await import(`./locales/${locale}-tools.json`);
    i18n.global.mergeLocaleMessage(locale, tools.default);
  } catch {
    // No tools file for this locale yet - helpers fall back to English.
  }
  loadedLocales.add(locale);
}

/**
 * Activate a locale: loads its messages if needed, switches the global
 * locale, and syncs `<html lang>`. Does NOT persist - persistence is
 * owned by settingsStore.setLocale.
 */
export async function setActiveLocale(
  locale: SupportedLocale,
): Promise<void> {
  await loadLocaleMessages(locale);
  // `locale` is inferred as Ref<'en'> from the initial options; widen it so
  // lazy-loaded locales can be assigned.
  (i18n.global.locale as WritableComputedRef<string>).value = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale);
  }
}
