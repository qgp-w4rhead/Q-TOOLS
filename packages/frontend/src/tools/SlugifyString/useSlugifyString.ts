/**
 * useSlugifyString - composable + pure logic for the Slugify string tool.
 *
 * Converts arbitrary text into a URL-safe slug.
 *
 * Algorithm (per line):
 *   1. Optional lowercase.
 *   2. Optional transliteration of common Latin/diacritic characters to their
 *      ASCII base (`é` → `e`, `ñ` → `n`, `ß` → `ss`, …). In `strict` mode this
 *      step is skipped and every non-ASCII character is dropped instead.
 *   3. Split the line into words on runs of non-alphanumeric characters
 *      (`[^A-Za-z0-9]+`). Empty tokens are discarded.
 *   4. Join the words with the chosen separator (`-` or `_`).
 *   5. Optional trim of leading/trailing separators (already guaranteed by the
 *      split/join, but the option is honoured explicitly for clarity and for
 *      custom-separator extensions).
 *
 * Multi-line input is processed line-by-line so each line becomes its own
 * slug, joined back with `\n`. Empty lines produce empty slugs.
 *
 * Pure helpers (`slugify`, `slugifyLine`, `transliterate`, `SlugifyOptions`)
 * have no Vue dependency and can be imported standalone for unit testing or
 * reuse. The `useSlugifyString()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Separator inserted between words. */
export type SlugSeparator = '-' | '_';

/** Configuration for the slugify transform. */
export interface SlugifyOptions {
  /** Separator inserted between words. Defaults to `-`. */
  separator: SlugSeparator;
  /** Lowercase the result. Defaults to `true`. */
  lowercase: boolean;
  /** Trim leading/trailing separators from each line's slug. Defaults to `true`. */
  trim: boolean;
  /**
   * Strict ASCII mode. When `true`, every character outside `[A-Za-z0-9]` is
   * dropped (no transliteration). When `false`, common Latin/diacritic
   * characters are transliterated to their ASCII base before splitting.
   * Defaults to `false`.
   */
  strict: boolean;
}

/** Default options applied when the composable is initialised. */
export const DEFAULT_SLUGIFY_OPTIONS: SlugifyOptions = {
  separator: '-',
  lowercase: true,
  trim: true,
  strict: false,
};

/**
 * Hand-curated transliteration table for the most common Latin-1 supplement
 * and Latin Extended-A characters. Covers diacritics used in Western European
 * languages, plus a few ligatures and the German `ß`.
 *
 * Characters not present in this map fall through to the non-alphanumeric
 * splitter and become word boundaries (or are dropped in strict mode).
 */
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  // Latin-1 supplement letters
  'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'AE',
  'Ç': 'C',
  'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
  'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
  'Ð': 'D', 'Ñ': 'N',
  'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O',
  'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
  'Ý': 'Y', 'Þ': 'TH',
  'ß': 'ss',
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
  'ç': 'c',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ð': 'd', 'ñ': 'n',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'þ': 'th', 'ÿ': 'y',
  // Latin Extended-A
  'Ā': 'A', 'ā': 'a', 'Ă': 'A', 'ă': 'a', 'Ą': 'A', 'ą': 'a',
  'Ć': 'C', 'ć': 'c', 'Ĉ': 'C', 'ĉ': 'c', 'Ċ': 'C', 'ċ': 'c', 'Č': 'C', 'č': 'c',
  'Ď': 'D', 'ď': 'd', 'Đ': 'D', 'đ': 'd',
  'Ē': 'E', 'ē': 'e', 'Ĕ': 'E', 'ĕ': 'e', 'Ė': 'E', 'ė': 'e', 'Ę': 'E', 'ę': 'e',
  'Ě': 'E', 'ě': 'e',
  'Ĝ': 'G', 'ĝ': 'g', 'Ğ': 'G', 'ğ': 'g', 'Ġ': 'G', 'ġ': 'g', 'Ģ': 'G', 'ģ': 'g',
  'Ĥ': 'H', 'ĥ': 'h', 'Ħ': 'H', 'ħ': 'h',
  'Ĩ': 'I', 'ĩ': 'i', 'Ī': 'I', 'ī': 'i', 'Ĭ': 'I', 'ĭ': 'i', 'Į': 'I', 'į': 'i',
  'İ': 'I', 'ı': 'i',
  'Ĳ': 'IJ', 'ĳ': 'ij',
  'Ĵ': 'J', 'ĵ': 'j',
  'Ķ': 'K', 'ķ': 'k', 'ĸ': 'k',
  'Ĺ': 'L', 'ĺ': 'l', 'Ļ': 'L', 'ļ': 'l', 'Ľ': 'L', 'ľ': 'l', 'Ŀ': 'L', 'ŀ': 'l',
  'Ł': 'L', 'ł': 'l',
  'Ń': 'N', 'ń': 'n', 'Ņ': 'N', 'ņ': 'n', 'Ň': 'N', 'ň': 'n', 'ŉ': 'n',
  'Ō': 'O', 'ō': 'o', 'Ŏ': 'O', 'ŏ': 'o', 'Ő': 'O', 'ő': 'o',
  'Œ': 'OE', 'œ': 'oe',
  'Ŕ': 'R', 'ŕ': 'r', 'Ŗ': 'R', 'ŗ': 'r', 'Ř': 'R', 'ř': 'r',
  'Ś': 'S', 'ś': 's', 'Ŝ': 'S', 'ŝ': 's', 'Ş': 'S', 'ş': 's', 'Š': 'S', 'š': 's',
  'Ţ': 'T', 'ţ': 't', 'Ť': 'T', 'ť': 't', 'Ŧ': 'T', 'ŧ': 't',
  'Ũ': 'U', 'ũ': 'u', 'Ū': 'U', 'ū': 'u', 'Ŭ': 'U', 'ŭ': 'u', 'Ů': 'U', 'ů': 'u',
  'Ű': 'U', 'ű': 'u', 'Ų': 'U', 'ų': 'u',
  'Ŵ': 'W', 'ŵ': 'w',
  'Ŷ': 'Y', 'ŷ': 'y', 'Ÿ': 'Y',
  'Ź': 'Z', 'ź': 'z', 'Ż': 'Z', 'ż': 'z', 'Ž': 'Z', 'ž': 'z',
};

/**
 * Transliterate common Latin/diacritic characters to their ASCII base.
 * Unknown characters are returned unchanged (the splitter handles them).
 */
export function transliterate(input: string): string {
  if (!input) return input;
  let out = '';
  for (const ch of input) {
    const mapped = TRANSLITERATIONS[ch];
    out += mapped !== undefined ? mapped : ch;
  }
  return out;
}

/**
 * Convert a single line to a slug using the supplied options.
 *
 * Pure function - no side effects.
 */
export function slugifyLine(line: string, options: SlugifyOptions): string {
  if (!line) return '';
  const { separator, lowercase, trim, strict } = options;

  let s = line;
  if (lowercase) s = s.toLowerCase();
  if (strict) {
    // Drop every run of non-ASCII-alphanumeric characters into a space so the
    // splitter produces clean word boundaries. Uppercase ASCII is preserved
    // (and lowercased above when the lowercase option is on).
    s = s.replace(/[^A-Za-z0-9]+/g, ' ');
  } else {
    s = transliterate(s);
    s = s.replace(/[^A-Za-z0-9]+/g, ' ');
  }

  const words = s.split(' ').filter((w) => w.length > 0);
  let slug = words.join(separator);
  if (trim) {
    const escaped = separator === '-' ? '-' : '_';
    slug = slug.replace(new RegExp(`^${escaped}+|${escaped}+$`, 'g'), '');
  }
  return slug;
}

/**
 * Convert `input` text to a slug (or one slug per line for multi-line input).
 *
 * Pure function - no side effects.
 */
export function slugify(input: string, options: SlugifyOptions): string {
  if (!input) return '';
  return input
    .split('\n')
    .map((line) => slugifyLine(line, options))
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseSlugifyStringReturn {
  input: Ref<string>;
  options: Ref<SlugifyOptions>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setSeparator: (s: SlugSeparator) => void;
  toggleLowercase: () => void;
  toggleTrim: () => void;
  toggleStrict: () => void;
}

export function useSlugifyString(): UseSlugifyStringReturn {
  const input = ref<string>('');
  const options = ref<SlugifyOptions>({ ...DEFAULT_SLUGIFY_OPTIONS });
  const output = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      return;
    }
    output.value = slugify(text, options.value);
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    run();
  }

  function setSeparator(s: SlugSeparator): void {
    options.value = { ...options.value, separator: s };
  }

  function toggleLowercase(): void {
    options.value = { ...options.value, lowercase: !options.value.lowercase };
  }

  function toggleTrim(): void {
    options.value = { ...options.value, trim: !options.value.trim };
  }

  function toggleStrict(): void {
    options.value = { ...options.value, strict: !options.value.strict };
  }

  watch(input, scheduleRun);
  watch(options, scheduleRun, { deep: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (p.options && typeof p.options === 'object') {
        const o = p.options as Record<string, unknown>;
        const next: SlugifyOptions = { ...options.value };
        if (o.separator === '-' || o.separator === '_') next.separator = o.separator;
        if (typeof o.lowercase === 'boolean') next.lowercase = o.lowercase;
        if (typeof o.trim === 'boolean') next.trim = o.trim;
        if (typeof o.strict === 'boolean') next.strict = o.strict;
        options.value = next;
      }
    },
  });

  watch(output, (o) => {
    if (isEmbed.value) {
      sendOutput({ output: o });
    }
  });

  return {
    input,
    options,
    output,
    isEmbed,
    embedInput,
    recompute,
    setSeparator,
    toggleLowercase,
    toggleTrim,
    toggleStrict,
  };
}
