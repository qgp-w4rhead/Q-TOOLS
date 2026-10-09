/**
 * useCollationComparator - composable + pure logic for Intl.Collator comparison.
 *
 * Compare string sort order across locales with different sensitivity
 * and usage options.
 *
 * No external dependencies - uses Intl.Collator.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Sensitivity = 'base' | 'accent' | 'case' | 'variant';
export type CollatorUsage = 'sort' | 'search';

export interface CollationResult {
  locale: string;
  sorted: string[];
  comparisons: { a: string; b: string; result: number; label: string }[];
}

export interface UseCollationComparatorReturn {
  input: Ref<string>;
  locale: Ref<string>;
  sensitivity: Ref<Sensitivity>;
  usage: Ref<CollatorUsage>;
  ignorePunctuation: Ref<boolean>;
  numeric: Ref<boolean>;
  caseFirst: Ref<boolean>;
  result: Ref<CollationResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

export const COMMON_LOCALES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh', 'ko',
  'ar', 'he', 'hi', 'tr', 'nl', 'pl', 'cs', 'sv', 'da', 'fi',
];

/** Create an Intl.Collator with the given options. */
export function createCollator(
  locale: string,
  sensitivity: Sensitivity,
  usage: CollatorUsage,
  ignorePunctuation: boolean,
  numeric: boolean,
  caseFirst: boolean,
): Intl.Collator | null {
  try {
    return new Intl.Collator(locale, {
      sensitivity,
      usage,
      ignorePunctuation,
      numeric,
      caseFirst: caseFirst ? 'upper' : 'false',
    });
  } catch {
    return null;
  }
}

/** Sort an array of strings using a collator. */
export function sortWithCollator(
  items: string[],
  collator: Intl.Collator,
): string[] {
  return [...items].sort((a, b) => collator.compare(a, b));
}

/** Compare two strings and return a label. */
export function compareStrings(
  a: string,
  b: string,
  collator: Intl.Collator,
): { result: number; label: string } {
  const result = collator.compare(a, b);
  let label: string;
  if (result < 0) label = `${a} < ${b}`;
  else if (result > 0) label = `${a} > ${b}`;
  else label = `${a} = ${b}`;
  return { result, label };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useCollationComparator(): UseCollationComparatorReturn {
  const input = ref<string>('apple\nApple\näpple\nbanana\nBanana\ncherry\ncafé\ncafe');
  const locale = ref<string>('en');
  const sensitivity = ref<Sensitivity>('variant');
  const usage = ref<CollatorUsage>('sort');
  const ignorePunctuation = ref<boolean>(false);
  const numeric = ref<boolean>(false);
  const caseFirst = ref<boolean>(false);
  const result = ref<CollationResult | null>(null);

  function recompute(): void {
    const items = input.value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');

    const collator = createCollator(
      locale.value,
      sensitivity.value,
      usage.value,
      ignorePunctuation.value,
      numeric.value,
      caseFirst.value,
    );

    if (!collator) {
      result.value = null;
      return;
    }

    const sorted = sortWithCollator(items, collator);

    const comparisons: { a: string; b: string; result: number; label: string }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i] ?? '';
      const b = sorted[i + 1] ?? '';
      const { result: cmp, label } = compareStrings(a, b, collator);
      comparisons.push({ a, b, result: cmp, label });
    }

    result.value = { locale: locale.value, sorted, comparisons };
  }

  function reset(): void {
    input.value = 'apple\nApple\näpple\nbanana\nBanana\ncherry\ncafé\ncafe';
    locale.value = 'en';
    sensitivity.value = 'variant';
    usage.value = 'sort';
    ignorePunctuation.value = false;
    numeric.value = false;
    caseFirst.value = false;
    recompute();
  }

  watch([input, locale, sensitivity, usage, ignorePunctuation, numeric, caseFirst], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.locale === 'string') locale.value = p.locale;
      if (typeof p.sensitivity === 'string') sensitivity.value = p.sensitivity as Sensitivity;
      if (typeof p.usage === 'string') usage.value = p.usage as CollatorUsage;
      if (typeof p.ignorePunctuation === 'boolean') ignorePunctuation.value = p.ignorePunctuation;
      if (typeof p.numeric === 'boolean') numeric.value = p.numeric;
      if (typeof p.caseFirst === 'boolean') caseFirst.value = p.caseFirst;
    },
    output: result,
    toOutput: () => ({ ...(result.value ?? {}) }),
  });

  return {
    input,
    locale,
    sensitivity,
    usage,
    ignorePunctuation,
    numeric,
    caseFirst,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
