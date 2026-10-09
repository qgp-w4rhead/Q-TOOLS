/**
 * useTextStatistics - composable + pure logic for the Text statistics tool.
 *
 * Computes a comprehensive set of statistics about a body of text:
 *   - character count (UTF-16 code units)
 *   - character count excluding whitespace
 *   - word count (Unicode-whitespace split)
 *   - sentence count (terminal punctuation with abbreviation guard)
 *   - paragraph count (blank-line separated)
 *   - line count (newline separated)
 *   - average word length (in characters, excluding whitespace)
 *   - average sentence length (in words)
 *   - reading time (at 200 words per minute)
 *   - speaking time (at 130 words per minute)
 *
 * No external dependencies - pure string arithmetic + Intl helpers.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface TextStats {
  /** Total number of UTF-16 code units (`text.length`). */
  characters: number;
  /** Characters excluding all whitespace. */
  charactersNoSpaces: number;
  /** Number of whitespace-separated word tokens. */
  words: number;
  /** Number of sentences (terminal punctuation with abbreviation guard). */
  sentences: number;
  /** Number of blank-line separated paragraphs. */
  paragraphs: number;
  /** Number of newline-separated lines. */
  lines: number;
  /** Average word length in characters (excluding whitespace), 0 if no words. */
  avgWordLength: number;
  /** Average sentence length in words, 0 if no sentences. */
  avgSentenceLength: number;
  /** Estimated reading time in milliseconds (200 wpm). */
  readingTimeMs: number;
  /** Estimated speaking time in milliseconds (130 wpm). */
  speakingTimeMs: number;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Reading speed in words per minute (average adult silent reading). */
export const READING_WPM = 200;
/** Speaking speed in words per minute (average presentation pace). */
export const SPEAKING_WPM = 130;

/**
 * Common English abbreviation tokens that should not be treated as sentence
 * terminators even when they end with a period. Compared case-insensitively
 * against the trailing token of a candidate sentence.
 */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st',
  'inc', 'ltd', 'co', 'corp',
  'rev', 'hon', 'pres', 'rep', 'sen', 'gov', 'capt', 'lt', 'sgt', 'gen',
  'est', 'approx', 'min', 'max', 'avg',
  'etc', 'vs', 'viz',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'a.m', 'p.m', 'u.s', 'u.k', 'e.g', 'i.e',
  'no', 'vol', 'pp', 'ed', 'eds',
]);

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Count total characters (UTF-16 code units). This matches `String.prototype.length`.
 */
export function countCharacters(text: string): number {
  return text.length;
}

/**
 * Count characters excluding all Unicode whitespace.
 */
export function countCharactersNoSpaces(text: string): number {
  // \s matches [ \t\n\r\f\v] plus Unicode whitespace. Strip globally.
  return text.replace(/\s/g, '').length;
}

/**
 * Count whitespace-separated word tokens. Empty input → 0.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  // Split on any run of Unicode whitespace.
  return trimmed.split(/\s+/).length;
}

/**
 * Count the number of newline-separated lines. A trailing newline does not
 * produce an extra empty line (consistent with most text editors).
 */
export function countLines(text: string): number {
  if (text.length === 0) return 0;
  // Strip a single trailing newline so "a\n" → 1 line, not 2.
  const normalised = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (normalised.length === 0) return 0;
  return normalised.split('\n').length;
}

/**
 * Count the number of blank-line separated paragraphs. Whitespace-only lines
 * are treated as blank. Empty input → 0. A non-blank single block → 1.
 */
export function countParagraphs(text: string): number {
  if (text.trim().length === 0) return 0;
  // Split on one or more blank lines (lines containing only whitespace).
  const blocks = text.split(/\n\s*\n/);
  let count = 0;
  for (const block of blocks) {
    if (block.trim().length > 0) count++;
  }
  return count;
}

/**
 * Count sentences using terminal punctuation (`.`, `!`, `?`). Abbreviations
 * from a curated list do not count as sentence boundaries. A terminal mark
 * followed by whitespace + capital letter is a stronger signal; we accept
 * any terminal mark that is not part of a known abbreviation.
 */
export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  let count = 0;
  // Walk the string looking for terminal punctuation.
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    // Skip consecutive terminal marks (e.g. "..." or "?!") - only the first
    // of a run counts as a sentence terminator.
    if (i > 0) {
      const prev = trimmed[i - 1]!;
      if (prev === '.' || prev === '!' || prev === '?') continue;
    }

    // For periods, check whether the preceding token is an abbreviation.
    if (ch === '.') {
      // Walk back to find the start of the preceding word token.
      let j = i - 1;
      while (j >= 0 && /[\w.]/.test(trimmed[j]!)) j--;
      const token = trimmed.slice(j + 1, i).toLowerCase();
      // If the token (possibly multi-dotted like "e.g") is an abbreviation,
      // skip this as a sentence terminator.
      if (token.length > 0 && ABBREVIATIONS.has(token)) continue;
      // Single-capital-letter tokens (initials like "J." in "J. Smith") - skip.
      if (token.length === 1 && /[a-z]/.test(token)) continue;
      // Numeric token (e.g. "3.14" decimal point or "1." list marker) - skip
      // when followed by a digit (decimal) - but a period after a digit
      // followed by whitespace may still be a sentence end. We only skip
      // decimals: period between two digits.
      if (
        i > 0 && /\d/.test(trimmed[i - 1]!) &&
        i + 1 < trimmed.length && /\d/.test(trimmed[i + 1]!)
      ) continue;
    }

    // Count this as a sentence boundary.
    count++;
  }

  // If the text has content but no terminal punctuation was found, treat it
  // as a single sentence.
  if (count === 0 && countWords(trimmed) > 0) count = 1;

  return count;
}

/**
 * Compute the average word length in characters (excluding whitespace).
 * Returns 0 when there are no words.
 */
export function averageWordLength(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  const words = trimmed.split(/\s+/);
  if (words.length === 0) return 0;
  let total = 0;
  for (const w of words) total += w.length;
  return total / words.length;
}

/**
 * Compute the average sentence length in words. Returns 0 when there are no
 * sentences.
 */
export function averageSentenceLength(text: string): number {
  const words = countWords(text);
  const sentences = countSentences(text);
  if (sentences === 0) return 0;
  return words / sentences;
}

/**
 * Compute reading time in milliseconds at the given words-per-minute rate.
 */
export function readingTimeMs(text: string, wpm = READING_WPM): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return (words / wpm) * 60_000;
}

/**
 * Compute speaking time in milliseconds at the given words-per-minute rate.
 */
export function speakingTimeMs(text: string, wpm = SPEAKING_WPM): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return (words / wpm) * 60_000;
}

/**
 * Compute the full statistics object for a body of text.
 */
export function computeStats(text: string): TextStats {
  const words = countWords(text);
  const sentences = countSentences(text);
  return {
    characters: countCharacters(text),
    charactersNoSpaces: countCharactersNoSpaces(text),
    words,
    sentences,
    paragraphs: countParagraphs(text),
    lines: countLines(text),
    avgWordLength: averageWordLength(text),
    avgSentenceLength: sentences === 0 ? 0 : words / sentences,
    readingTimeMs: readingTimeMs(text),
    speakingTimeMs: speakingTimeMs(text),
  };
}

/**
 * Format a duration in milliseconds as a compact human-readable string.
 * Examples: 0 → "0s", 500 → "<1s", 45000 → "45s", 90000 → "1m 30s",
 * 7500000 → "2h 5m".
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms < 1000) return '<1s';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseTextStatisticsReturn {
  input: Ref<string>;
  stats: Ref<TextStats>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useTextStatistics(): UseTextStatisticsReturn {
  const input = ref<string>('');
  const stats = ref<TextStats>(computeStats(''));

  function recompute(): void {
    stats.value = computeStats(input.value);
  }

  function reset(): void {
    input.value = '';
    recompute();
  }

  // Recompute whenever the input changes (debounced in the component).
  watch(input, recompute);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') input.value = p.text;
      else if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
      else if (typeof p.content === 'string') input.value = p.content;
      const action = typeof p.action === 'string' ? p.action : null;
      if (action === 'reset' || action === 'clear') reset();
    },
  });

  watch(stats, () => {
    if (!isEmbed.value) return;
    sendOutput({ stats: stats.value, text: input.value });
  });

  return {
    input,
    stats,
    isEmbed,
    embedInput,
    reset,
  };
}
