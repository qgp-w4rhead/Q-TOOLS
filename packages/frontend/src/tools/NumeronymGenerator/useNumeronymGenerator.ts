/**
 * useNumeronymGenerator — composable + pure logic for the Numeronym generator
 * tool.
 *
 * A numeronym is a word abbreviated by keeping the first and last letters and
 * replacing the middle with the count of omitted letters — e.g.
 * "internationalization" → "i18n" (20 letters, 20 − 2 = 18 middle letters).
 *
 * Supports multi-word phrases: each word (a run of letters/digits) is
 * abbreviated independently when its length meets the configurable minimum;
 * non-word separators (whitespace, punctuation) are preserved verbatim. An
 * optional `preserveCase` toggle controls whether the first/last letters keep
 * their original case or are lowercased.
 *
 * No external dependencies — pure string arithmetic.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface NumeronymOptions {
  /** Minimum word length required for a word to be abbreviated. Words shorter
   *  than this are returned verbatim. Clamped to [3, 20]. Default 4. */
  minLength: number;
  /** When true, the first and last letters keep their original case. When
   *  false, they are lowercased. Default true. */
  preserveCase: boolean;
}

export interface NumeronymToken {
  /** The original word token (a run of letters/digits). */
  original: string;
  /** The numeronym (or the original word if it was too short). */
  numeronym: string;
  /** Length of the original word. */
  length: number;
  /** Number of middle characters omitted (length − 2), or 0 when not
   *  abbreviated. */
  omitted: number;
  /** Whether the word was actually abbreviated (length ≥ minLength). */
  abbreviated: boolean;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Default minimum word length for abbreviation. */
export const DEFAULT_MIN_LENGTH = 4;
/** Lower bound for the minimum-length option. */
export const MIN_LENGTH_FLOOR = 3;
/** Upper bound for the minimum-length option. */
export const MIN_LENGTH_CEIL = 20;

/**
 * Word-token regex: a run of Unicode letters or digits. The `u` flag enables
 * Unicode property escapes (`\p{L}` letters, `\p{N}` numbers); `g` is added by
 * the caller via `split` (which ignores `g` anyway) — we use it with `match`
 * for tokenisation.
 */
const WORD_RE = /[\p{L}\p{N}]+/gu;

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Clamp an integer into the inclusive range [min, max]. Non-finite or
 * non-numeric inputs fall back to `min`. Floats are truncated toward zero.
 */
export function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  const truncated = Math.trunc(n);
  return Math.min(max, Math.max(min, truncated));
}

/**
 * Convert a single word token into a numeronym.
 *
 * Words of length < 3 cannot form a meaningful numeronym (the middle count
 * would be ≤ 0) and are returned verbatim. For length ≥ 3 the result is
 * `first + (length − 2) + last`. When `preserveCase` is false the first and
 * last letters are lowercased.
 *
 * Note: this function does NOT consult `minLength` — callers decide whether a
 * word is long enough to abbreviate. It only guards against the degenerate
 * sub-3-char case.
 */
export function toNumeronym(word: string, preserveCase: boolean): string {
  if (word.length < 3) return word;
  const first = word.charAt(0);
  const last = word.charAt(word.length - 1);
  const f = preserveCase ? first : first.toLowerCase();
  const l = preserveCase ? last : last.toLowerCase();
  return `${f}${word.length - 2}${l}`;
}

/**
 * Generate numeronyms for a phrase. Each run of letters/digits is treated as a
 * word; words with length ≥ `options.minLength` are abbreviated, shorter words
 * and all non-word separators are preserved verbatim.
 */
export function generateNumeronyms(
  text: string,
  options: NumeronymOptions,
): string {
  const minLength = clampInt(options.minLength, MIN_LENGTH_FLOOR, MIN_LENGTH_CEIL);
  const preserveCase = Boolean(options.preserveCase);

  // Walk the string, alternating between word runs and separator runs.
  // `WORD_RE` with `match` gives us the word tokens; we splice the separators
  // back in by tracking the consumed index range.
  let out = '';
  let cursor = 0;
  const matches = text.match(WORD_RE);
  if (!matches || matches.length === 0) return text;

  for (const word of matches) {
    const idx = text.indexOf(word, cursor);
    // Append the separator (anything between cursor and this word) verbatim.
    if (idx > cursor) out += text.slice(cursor, idx);
    // Append the (possibly abbreviated) word.
    if (word.length >= minLength) {
      out += toNumeronym(word, preserveCase);
    } else {
      out += word;
    }
    cursor = idx + word.length;
  }
  // Append any trailing separator.
  if (cursor < text.length) out += text.slice(cursor);
  return out;
}

/**
 * Tokenise the input phrase into per-word `NumeronymToken` records (separators
 * are not included — only the word runs). Useful for the breakdown table.
 */
export function tokenizeNumeronyms(
  text: string,
  options: NumeronymOptions,
): NumeronymToken[] {
  const minLength = clampInt(options.minLength, MIN_LENGTH_FLOOR, MIN_LENGTH_CEIL);
  const preserveCase = Boolean(options.preserveCase);
  const matches = text.match(WORD_RE);
  if (!matches) return [];
  const seen = new Set<string>();
  const tokens: NumeronymToken[] = [];
  for (const word of matches) {
    // Deduplicate by original word so the breakdown table stays compact for
    // repeated words. First occurrence wins.
    if (seen.has(word)) continue;
    seen.add(word);
    const abbreviated = word.length >= minLength && word.length >= 3;
    tokens.push({
      original: word,
      numeronym: abbreviated
        ? toNumeronym(word, preserveCase)
        : word,
      length: word.length,
      omitted: abbreviated ? word.length - 2 : 0,
      abbreviated,
    });
  }
  return tokens;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseNumeronymGeneratorReturn {
  input: Ref<string>;
  minLength: Ref<number>;
  preserveCase: Ref<boolean>;
  output: Ref<string>;
  tokens: Ref<NumeronymToken[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useNumeronymGenerator(): UseNumeronymGeneratorReturn {
  const input = ref<string>('');
  const minLength = ref<number>(DEFAULT_MIN_LENGTH);
  const preserveCase = ref<boolean>(true);
  const output = ref<string>('');
  const tokens = ref<NumeronymToken[]>([]);

  function recompute(): void {
    const opts: NumeronymOptions = {
      minLength: minLength.value,
      preserveCase: preserveCase.value,
    };
    output.value = generateNumeronyms(input.value, opts);
    tokens.value = tokenizeNumeronyms(input.value, opts);
  }

  function reset(): void {
    input.value = '';
    minLength.value = DEFAULT_MIN_LENGTH;
    preserveCase.value = true;
    recompute();
  }

  // Recompute whenever any input changes.
  watch([input, minLength, preserveCase], recompute);

  // Seed an initial output for the empty input.
  recompute();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') input.value = p.text;
      else if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
      else if (typeof p.content === 'string') input.value = p.content;
      if (p.minLength !== undefined) {
        minLength.value = clampInt(p.minLength, MIN_LENGTH_FLOOR, MIN_LENGTH_CEIL);
      }
      if (p.minWordLength !== undefined) {
        minLength.value = clampInt(p.minWordLength, MIN_LENGTH_FLOOR, MIN_LENGTH_CEIL);
      }
      if (typeof p.preserveCase === 'boolean') preserveCase.value = p.preserveCase;
      const action = typeof p.action === 'string' ? p.action : null;
      if (action === 'reset' || action === 'clear') reset();
    },
  });

  watch([output, tokens], () => {
    if (!isEmbed.value) return;
    sendOutput({
      output: output.value,
      tokens: tokens.value,
      minLength: minLength.value,
      preserveCase: preserveCase.value,
    });
  });

  return {
    input,
    minLength,
    preserveCase,
    output,
    tokens,
    isEmbed,
    embedInput,
    reset,
  };
}
