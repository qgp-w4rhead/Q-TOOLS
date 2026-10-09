/**
 * usePluralRulesExplorer - composable + pure logic for Intl.PluralRules.
 *
 * Shows pluralization categories for a given locale and set of numbers.
 *
 * No external dependencies - uses Intl.PluralRules.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type PluralType = 'cardinal' | 'ordinal';

export interface PluralCategoryResult {
  number: number;
  category: string;
}

export interface LocalePluralInfo {
  locale: string;
  categories: string[];
  results: PluralCategoryResult[];
}

export interface UsePluralRulesExplorerReturn {
  locale: Ref<string>;
  pluralType: Ref<PluralType>;
  numbers: Ref<string>;
  allLocales: Ref<string[]>;
  currentInfo: Ref<LocalePluralInfo | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

export const COMMON_LOCALES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko',
  'ar', 'he', 'hi', 'tr', 'nl', 'pl', 'cs', 'uk', 'th', 'vi',
  'id', 'ms', 'fa', 'fi', 'sv', 'da', 'nb', 'nn', 'hu', 'el',
];

/** Get the available plural categories for a locale. */
export function getPluralCategories(locale: string, type: PluralType): string[] {
  try {
    const pr = new Intl.PluralRules(locale, { type });
    const categories = new Set<string>();
    for (let i = 0; i <= 200; i++) {
      categories.add(pr.select(i));
    }
    return Array.from(categories);
  } catch {
    return ['one', 'other'];
  }
}

/** Select the plural category for a number in a locale. */
export function selectPlural(n: number, locale: string, type: PluralType): string {
  try {
    const pr = new Intl.PluralRules(locale, { type });
    return pr.select(n);
  } catch {
    return n === 1 ? 'one' : 'other';
  }
}

/** Get supported locales via Intl.PluralRules. */
export function getSupportedLocales(): string[] {
  try {
    const supported = Intl.PluralRules.supportedLocalesOf(COMMON_LOCALES);
    return supported.length > 0 ? supported : COMMON_LOCALES;
  } catch {
    return COMMON_LOCALES;
  }
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function usePluralRulesExplorer(): UsePluralRulesExplorerReturn {
  const locale = ref<string>('en');
  const pluralType = ref<PluralType>('cardinal');
  const numbers = ref<string>('0, 1, 2, 3, 5, 11, 21, 100');
  const allLocales = ref<string[]>(getSupportedLocales());
  const currentInfo = ref<LocalePluralInfo | null>(null);

  function recompute(): void {
    const numList = numbers.value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .map(Number)
      .filter((n) => Number.isFinite(n));

    const categories = getPluralCategories(locale.value, pluralType.value);
    const results: PluralCategoryResult[] = numList.map((n) => ({
      number: n,
      category: selectPlural(n, locale.value, pluralType.value),
    }));

    currentInfo.value = { locale: locale.value, categories, results };
  }

  function reset(): void {
    locale.value = 'en';
    pluralType.value = 'cardinal';
    numbers.value = '0, 1, 2, 3, 5, 11, 21, 100';
    recompute();
  }

  watch([locale, pluralType, numbers], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.locale === 'string') locale.value = p.locale;
      if (typeof p.pluralType === 'string') pluralType.value = p.pluralType as PluralType;
      if (typeof p.numbers === 'string') numbers.value = p.numbers;
    },
    output: currentInfo,
    toOutput: () => ({ ...(currentInfo.value ?? {}) }),
  });

  return {
    locale,
    pluralType,
    numbers,
    allLocales,
    currentInfo,
    isEmbed,
    embedInput,
    reset,
  };
}
