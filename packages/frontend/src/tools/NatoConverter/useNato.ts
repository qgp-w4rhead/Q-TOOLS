/**
 * useNatoConverter — composable + pure logic for the Text-to-NATO tool.
 *
 * Converts text into the NATO phonetic alphabet:
 *
 *   - Letters A-Z → NATO words (Alpha, Bravo, Charlie, …, Zulu).
 *   - Digits 0-9 → ITU spellings (Zero, One, Two, …, Niner).
 *   - All other characters (whitespace, punctuation, symbols) are preserved
 *     verbatim in the flat-string output so the reader can still see
 *     sentence structure.
 *
 * Two output shapes are produced:
 *
 *   - `toNato(text)` → flat string of space-joined NATO words and preserved
 *     non-alphanumeric characters (e.g. `"Hello!"` → `"Hotel Echo Lima Lima Oscar !"`).
 *   - `toNatoRows(text)` → array of `{ char, word }` rows, one per input
 *     character. For non-alphanumeric characters `word` is `null` and the
 *     original character is shown in `char`.
 *
 * Pure helpers (`NATO_ALPHABET`, `NATO_DIGITS`, `natoWordFor`, `toNato`,
 * `toNatoRows`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useNatoConverter()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** NATO phonetic alphabet — index 0 = 'A'. */
export const NATO_ALPHABET: readonly string[] = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
  'India', 'Juliett', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
  'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey',
  'X-ray', 'Yankee', 'Zulu',
];

/** ITU digit spellings — index 0 = '0'. */
export const NATO_DIGITS: readonly string[] = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
  'Niner',
];

/** One row of the per-character output table. */
export interface NatoRow {
  /** Original input character. */
  char: string;
  /** NATO/ITU word, or `null` for non-alphanumeric characters. */
  word: string | null;
}

/**
 * Return the NATO/ITU word for a single character, or `null` if the
 * character is not an ASCII letter or digit. Case-insensitive for letters.
 */
export function natoWordFor(char: string): string | null {
  if (char.length !== 1) return null;
  const code = char.charCodeAt(0);
  // A-Z
  if (code >= 65 && code <= 90) {
    return NATO_ALPHABET[code - 65] ?? null;
  }
  // a-z
  if (code >= 97 && code <= 122) {
    return NATO_ALPHABET[code - 97] ?? null;
  }
  // 0-9
  if (code >= 48 && code <= 57) {
    return NATO_DIGITS[code - 48] ?? null;
  }
  return null;
}

/**
 * Convert `text` to a flat NATO-phonetic string. Each alphanumeric character
 * is replaced by its NATO word; non-alphanumeric characters (whitespace,
 * punctuation, symbols) are preserved verbatim. Words and preserved
 * characters are joined with single spaces, except that a preserved space
 * character is emitted as-is (so multi-word input keeps its spacing).
 */
export function toNato(text: string): string {
  if (!text) return '';
  const parts: string[] = [];
  for (const char of text) {
    const word = natoWordFor(char);
    if (word !== null) {
      parts.push(word);
    } else if (char === ' ') {
      // Keep spaces literal so word boundaries are visible in the flat output.
      parts.push(' ');
    } else {
      // Other non-alphanumeric characters: emit verbatim, padded with spaces
      // so they don't fuse with adjacent words.
      parts.push(char);
    }
  }
  // Join with spaces, then collapse the doubled spaces produced by literal
  // space characters into single spaces for a tidy flat string.
  return parts.join(' ').replace(/ {2,}/g, ' ').trim();
}

/**
 * Convert `text` to a per-character row table. One row per input character,
 * preserving order, whitespace, and punctuation. Newlines are kept as their
 * own rows so the table mirrors the input layout.
 */
export function toNatoRows(text: string): NatoRow[] {
  if (!text) return [];
  const rows: NatoRow[] = [];
  for (const char of text) {
    rows.push({ char, word: natoWordFor(char) });
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseNatoConverterReturn {
  input: Ref<string>;
  output: Ref<string>;
  rows: Ref<NatoRow[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useNatoConverter(): UseNatoConverterReturn {
  const input = ref<string>('');
  const output = ref<string>('');
  const rows = ref<NatoRow[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      rows.value = [];
      return;
    }
    output.value = toNato(text);
    rows.value = toNatoRows(text);
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

  watch(input, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
  });

  watch(output, (o) => {
    if (isEmbed.value) {
      sendOutput({ output: o, rows: rows.value });
    }
  });

  return {
    input,
    output,
    rows,
    isEmbed,
    embedInput,
    recompute,
  };
}
