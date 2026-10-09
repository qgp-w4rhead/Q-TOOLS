/**
 * i18n type definitions.
 *
 * `MessageSchema` is derived from the English locale file, which is the
 * source of truth for message keys. Passing it to `createI18n` gives
 * type-checked `t()` keys across the app.
 */
import type en from './locales/en.json';

export type MessageSchema = typeof en;

export type SupportedLocale = 'en' | 'es' | 'fr';
