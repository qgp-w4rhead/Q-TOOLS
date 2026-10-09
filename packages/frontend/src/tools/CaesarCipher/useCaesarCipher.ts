/**
 * useCaesarCipher - composable + pure logic for the Caesar / ROT cipher tool.
 *
 * Bidirectional shift cipher: each letter is shifted by a fixed number of
 * positions in the alphabet. ROT13 is the default (shift = 13). The shift
 * is configurable from 1–25. Encrypt shifts forward; decrypt shifts backward
 * (equivalently, shift by `26 - shift`).
 *
 * Only ASCII letters (A-Z, a-z) are shifted; all other characters (digits,
 * punctuation, whitespace, Unicode) are preserved verbatim. Case is preserved.
 *
 * Pure helpers (`caesarShift`, `caesarEncrypt`, `caesarDecrypt`, `caesarBruteForce`)
 * have no Vue dependency and can be imported standalone for unit testing or
 * reuse. The `useCaesarCipher()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Default shift (ROT13). */
export const DEFAULT_SHIFT = 13;

/** Minimum shift value. */
export const MIN_SHIFT = 1;

/** Maximum shift value. */
export const MAX_SHIFT = 25;

/** Size of the alphabet. */
const ALPHABET_SIZE = 26;

/**
 * Shift a single character by `shift` positions in the alphabet.
 * Non-letter characters are returned unchanged. Case is preserved.
 */
export function caesarShiftChar(char: string, shift: number): string {
  if (char.length !== 1) return char;
  const code = char.charCodeAt(0);
  // Uppercase A-Z
  if (code >= 65 && code <= 90) {
    return String.fromCharCode(
      ((code - 65 + shift) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE + 65,
    );
  }
  // Lowercase a-z
  if (code >= 97 && code <= 122) {
    return String.fromCharCode(
      ((code - 97 + shift) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE + 97,
    );
  }
  return char;
}

/**
 * Apply a Caesar shift to `text`. Positive `shift` encrypts (forward);
 * negative `shift` decrypts (backward). Non-letter characters are preserved.
 */
export function caesarShift(text: string, shift: number): string {
  if (!text) return '';
  let out = '';
  for (const char of text) {
    out += caesarShiftChar(char, shift);
  }
  return out;
}

/** Encrypt `text` with the given `shift` (1–25). */
export function caesarEncrypt(text: string, shift: number): string {
  return caesarShift(text, shift);
}

/** Decrypt `text` with the given `shift` (1–25). */
export function caesarDecrypt(text: string, shift: number): string {
  return caesarShift(text, -shift);
}

/** One row of the brute-force output table. */
export interface BruteForceRow {
  shift: number;
  result: string;
}

/**
 * Produce all 25 possible decryptions of `text` (shifts 1–25).
 * Useful for cryptanalysis without knowing the key.
 */
export function caesarBruteForce(text: string): BruteForceRow[] {
  const rows: BruteForceRow[] = [];
  for (let s = 1; s <= 25; s++) {
    rows.push({ shift: s, result: caesarDecrypt(text, s) });
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type CaesarMode = 'encrypt' | 'decrypt';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseCaesarCipherReturn {
  input: Ref<string>;
  shift: Ref<number>;
  mode: Ref<CaesarMode>;
  output: Ref<string>;
  bruteForce: Ref<BruteForceRow[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setShift: (n: number) => void;
  setMode: (m: CaesarMode) => void;
  swap: () => void;
}

export function useCaesarCipher(): UseCaesarCipherReturn {
  const input = ref<string>('');
  const shift = ref<number>(DEFAULT_SHIFT);
  const mode = ref<CaesarMode>('encrypt');
  const output = ref<string>('');
  const bruteForce = ref<BruteForceRow[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      bruteForce.value = [];
      return;
    }
    const s = shift.value;
    output.value = mode.value === 'encrypt' ? caesarEncrypt(text, s) : caesarDecrypt(text, s);
    bruteForce.value = caesarBruteForce(text);
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

  function setShift(n: number): void {
    shift.value = n;
  }

  function setMode(m: CaesarMode): void {
    mode.value = m;
  }

  /** Swap direction and feed the current output back as the new input. */
  function swap(): void {
    if (output.value) {
      input.value = output.value;
    }
    mode.value = mode.value === 'encrypt' ? 'decrypt' : 'encrypt';
  }

  watch(input, scheduleRun);
  watch(shift, scheduleRun);
  watch(mode, scheduleRun);

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.shift === 'number') shift.value = p.shift;
      if (typeof p.mode === 'string' && (p.mode === 'encrypt' || p.mode === 'decrypt')) {
        mode.value = p.mode;
      }
    },
    output,
    toOutput: () => ({ output: output.value, shift: shift.value, mode: mode.value }),
  });

  return {
    input,
    shift,
    mode,
    output,
    bruteForce,
    isEmbed,
    embedInput,
    recompute,
    setShift,
    setMode,
    swap,
  };
}
