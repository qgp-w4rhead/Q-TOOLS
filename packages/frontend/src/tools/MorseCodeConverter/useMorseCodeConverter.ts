/**
 * useMorseCodeConverter - composable + pure logic for the Morse code tool.
 *
 * Bidirectional text ↔ Morse code conversion using the ITU standard Morse
 * code alphabet. Letters A–Z, digits 0–9, and a set of common punctuation
 * marks are mapped. Unmapped characters are preserved verbatim.
 *
 *   Encode: text → dots and dashes, letters separated by a configurable
 *     letter separator (default " "), words by a word separator (default " / ").
 *   Decode: Morse code → text. Tolerates `.`/`-` as well as `·`/`-`.
 *
 * Pure helpers (`MORSE_CODE_MAP`, `MORSE_DECODE_MAP`, `textToMorse`,
 * `morseToText`) have no Vue dependency. The `useMorseCodeConverter()`
 * composable wraps them in reactive state and wires up the embed
 * PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** ITU standard Morse code map (letters, digits, common punctuation). */
export const MORSE_CODE_MAP: Readonly<Record<string, string>> = {
  // Letters
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  // Digits
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  // Punctuation
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
  '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--..', '"': '.-..-.',
  '$': '...-..-', '@': '.--.-.',
};

/** Reverse map for decoding. */
export const MORSE_DECODE_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(MORSE_CODE_MAP).map(([ch, morse]) => [morse, ch]),
);

/** Default separator between Morse letters. */
export const DEFAULT_LETTER_SEPARATOR = ' ';

/** Default separator between Morse words. */
export const DEFAULT_WORD_SEPARATOR = ' / ';

/**
 * Encode `text` into Morse code. Letters are separated by `letterSep`,
 * words by `wordSep`. Characters not in the Morse map are preserved
 * verbatim (e.g. newlines, tabs, other symbols).
 */
export function textToMorse(
  text: string,
  letterSep: string = DEFAULT_LETTER_SEPARATOR,
  wordSep: string = DEFAULT_WORD_SEPARATOR,
): string {
  if (!text) return '';
  const lines = text.split('\n');
  return lines
    .map((line) => {
      const words = line.split(/ +/);
      return words
        .map((word) => {
          const parts: string[] = [];
          for (const ch of word) {
            const upper = ch.toUpperCase();
            const morse = MORSE_CODE_MAP[upper];
            if (morse) {
              parts.push(morse);
            } else {
              parts.push(ch);
            }
          }
          return parts.join(letterSep);
        })
        .filter((w) => w.length > 0)
        .join(wordSep);
    })
    .join('\n');
}

/**
 * Decode Morse code back to text. Tolerates `.` / `-` and `·` / `-` as
 * dot/dash. Letters are split on `letterSep` (or whitespace), words on
 * ` / ` (or multiple spaces). Unrecognized Morse sequences are preserved
 * verbatim.
 */
export function morseToText(
  input: string,
  letterSep: string = DEFAULT_LETTER_SEPARATOR,
  wordSep: string = DEFAULT_WORD_SEPARATOR,
): string {
  if (!input) return '';
  const lines = input.split('\n');
  return lines
    .map((line) => {
      // Normalize Unicode dots/dashes to ASCII.
      const normalized = line
        .replace(/[\u00B7\u2022\u2024\u2027]/g, '.')
        .replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-');
      // Split into words on the word separator.
      const wordSepRegex = wordSep.trim()
        ? new RegExp(escapeRegex(wordSep.trim()), 'g')
        : / {2,}/;
      const words = normalized.split(wordSepRegex);
      return words
        .map((word) => {
          const trimmed = word.trim();
          if (!trimmed) return '';
          // Split letters on letter separator or single space.
          const letterSepRegex = letterSep
            ? new RegExp(escapeRegex(letterSep), 'g')
            : / /;
          const letters = trimmed.split(letterSepRegex);
          return letters
            .map((morse) => {
              const decoded = MORSE_DECODE_MAP[morse];
              return decoded ?? morse;
            })
            .join('');
        })
        .join(' ');
    })
    .join('\n');
}

/** Escape a string for use in a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type MorseMode = 'encode' | 'decode';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseMorseCodeConverterReturn {
  input: Ref<string>;
  mode: Ref<MorseMode>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: MorseMode) => void;
  swap: () => void;
}

export function useMorseCodeConverter(): UseMorseCodeConverterReturn {
  const input = ref<string>('');
  const mode = ref<MorseMode>('encode');
  const output = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      return;
    }
    output.value =
      mode.value === 'encode'
        ? textToMorse(text)
        : morseToText(text);
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

  function setMode(m: MorseMode): void {
    mode.value = m;
  }

  function swap(): void {
    if (output.value) {
      input.value = output.value;
    }
    mode.value = mode.value === 'encode' ? 'decode' : 'encode';
  }

  watch(input, scheduleRun);
  watch(mode, scheduleRun);

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string' && (p.mode === 'encode' || p.mode === 'decode')) {
        mode.value = p.mode;
      }
    },
    output,
    toOutput: () => ({ output: output.value, mode: mode.value }),
  });

  return {
    input,
    mode,
    output,
    isEmbed,
    embedInput,
    recompute,
    setMode,
    swap,
  };
}
