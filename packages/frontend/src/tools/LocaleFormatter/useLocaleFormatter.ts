/**
 * useLocaleFormatter - composable + pure logic for locale formatting preview.
 *
 * Uses Intl.NumberFormat, Intl.DateTimeFormat, Intl.ListFormat, and
 * Intl.RelativeTimeFormat to preview formatting across locales.
 *
 * No external dependencies - uses only built-in Intl APIs.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type FormatType = 'number' | 'currency' | 'date' | 'time' | 'list' | 'relative';

export interface LocaleFormatResult {
  type: FormatType;
  locale: string;
  output: string;
}

export interface UseLocaleFormatterReturn {
  input: Ref<string>;
  locale: Ref<string>;
  formatType: Ref<FormatType>;
  currencyCode: Ref<string>;
  results: Ref<LocaleFormatResult[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

export const FORMAT_TYPES: { value: FormatType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'list', label: 'List' },
  { value: 'relative', label: 'Relative time' },
];

export const COMMON_LOCALES = [
  'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ru-RU',
  'ja-JP', 'zh-CN', 'ko-KR', 'ar-SA', 'he-IL', 'hi-IN', 'tr-TR', 'nl-NL',
  'pl-PL', 'sv-SE', 'da-DK', 'fi-FI', 'nb-NO', 'cs-CZ', 'th-TH', 'vi-VN',
];

export const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW', 'INR', 'RUB', 'BRL', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY', 'AED', 'ZAR',
];

/** Format a number in the given locale. */
export function formatNumber(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

/** Format a number as currency in the given locale. */
export function formatCurrency(value: number, locale: string, currency: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** Format a date in the given locale. */
export function formatDate(value: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(value);
  } catch {
    return value.toDateString();
  }
}

/** Format a time in the given locale. */
export function formatTime(value: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(value);
  } catch {
    return value.toTimeString();
  }
}

/** Format a list of items in the given locale. */
export function formatList(items: string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

/** Format a relative time value in the given locale. */
export function formatRelative(value: number, locale: string, unit: string): string {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit as Intl.RelativeTimeFormatUnit);
  } catch {
    return `${value} ${unit}`;
  }
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useLocaleFormatter(): UseLocaleFormatterReturn {
  const input = ref<string>('1234567.89');
  const locale = ref<string>('en-US');
  const formatType = ref<FormatType>('number');
  const currencyCode = ref<string>('USD');
  const results = ref<LocaleFormatResult[]>([]);

  function recompute(): void {
    const out: LocaleFormatResult[] = [];

    if (formatType.value === 'number') {
      const num = Number(input.value);
      for (const loc of COMMON_LOCALES) {
        out.push({ type: 'number', locale: loc, output: formatNumber(num, loc) });
      }
    } else if (formatType.value === 'currency') {
      const num = Number(input.value);
      for (const loc of COMMON_LOCALES) {
        out.push({
          type: 'currency',
          locale: loc,
          output: formatCurrency(num, loc, currencyCode.value),
        });
      }
    } else if (formatType.value === 'date') {
      const date = new Date(input.value || Date.now());
      for (const loc of COMMON_LOCALES) {
        out.push({ type: 'date', locale: loc, output: formatDate(date, loc) });
      }
    } else if (formatType.value === 'time') {
      const date = new Date(input.value || Date.now());
      for (const loc of COMMON_LOCALES) {
        out.push({ type: 'time', locale: loc, output: formatTime(date, loc) });
      }
    } else if (formatType.value === 'list') {
      const items = input.value.split(',').map((s) => s.trim()).filter(Boolean);
      for (const loc of COMMON_LOCALES) {
        out.push({ type: 'list', locale: loc, output: formatList(items, loc) });
      }
    } else if (formatType.value === 'relative') {
      const num = Number(input.value);
      for (const loc of COMMON_LOCALES) {
        out.push({ type: 'relative', locale: loc, output: formatRelative(num, loc, 'day') });
      }
    }

    results.value = out;
  }

  function reset(): void {
    input.value = '1234567.89';
    locale.value = 'en-US';
    formatType.value = 'number';
    currencyCode.value = 'USD';
    recompute();
  }

  watch([input, formatType, currencyCode], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.locale === 'string') locale.value = p.locale;
      if (typeof p.formatType === 'string') formatType.value = p.formatType as FormatType;
      if (typeof p.currency === 'string') currencyCode.value = p.currency;
    },
    output: results,
    toOutput: () => ({ results: results.value }),
  });

  return {
    input,
    locale,
    formatType,
    currencyCode,
    results,
    isEmbed,
    embedInput,
    reset,
  };
}
