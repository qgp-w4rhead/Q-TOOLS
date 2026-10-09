/**
 * useVigenereCipher - composable + pure logic for the Vigenère cipher tool.
 *
 * Polyalphabetic substitution cipher using a keyword. Each letter of the
 * plaintext is shifted by the corresponding letter of the keyword (repeated
 * to match the length of the plaintext). Non-letter characters are preserved
 * and do not advance the keyword pointer.
 *
 *   Encrypt:  C[i] = (P[i] + K[i]) mod 26
 *   Decrypt:  P[i] = (C[i] - K[i]) mod 26
 *
 * Only ASCII letters (A-Z, a-z) are shifted; case is preserved. The keyword
 * is case-insensitive and non-letter characters in the keyword are skipped.
 *
 * Pure helpers (`vigenereEncrypt`, `vigenereDecrypt`, `sanitizeKeyword`) have
 * no Vue dependency. The `useVigenereCipher()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

const ALPHABET_SIZE = 26;

/**
 * Extract only the alphabetic characters from a keyword and convert to
 * uppercase. Returns an array of letter indices (0–25).
 */
export function sanitizeKeyword(keyword: string): number[] {
  if (!keyword) return [];
  const indices: number[] = [];
  for (const ch of keyword) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      indices.push(code - 65);
    } else if (code >= 97 && code <= 122) {
      indices.push(code - 97);
    }
  }
  return indices;
}

/**
 * Apply the Vigenère cipher to `text` using `keyIndices`.
 * `sign` is +1 for encrypt, -1 for decrypt.
 */
function vigenereApply(text: string, keyIndices: number[], sign: 1 | -1): string {
  if (!text || keyIndices.length === 0) return text;
  let out = '';
  let keyPos = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      const shift = keyIndices[keyPos % keyIndices.length]!;
      out += String.fromCharCode(
        ((code - 65 + sign * shift) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE + 65,
      );
      keyPos++;
    } else if (code >= 97 && code <= 122) {
      const shift = keyIndices[keyPos % keyIndices.length]!;
      out += String.fromCharCode(
        ((code - 97 + sign * shift) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE + 97,
      );
      keyPos++;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Encrypt `text` with the given `keyword`. */
export function vigenereEncrypt(text: string, keyword: string): string {
  const keyIndices = sanitizeKeyword(keyword);
  if (keyIndices.length === 0) return text;
  return vigenereApply(text, keyIndices, 1);
}

/** Decrypt `text` with the given `keyword`. */
export function vigenereDecrypt(text: string, keyword: string): string {
  const keyIndices = sanitizeKeyword(keyword);
  if (keyIndices.length === 0) return text;
  return vigenereApply(text, keyIndices, -1);
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type VigenereMode = 'encrypt' | 'decrypt';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseVigenereCipherReturn {
  input: Ref<string>;
  keyword: Ref<string>;
  mode: Ref<VigenereMode>;
  output: Ref<string>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setKeyword: (k: string) => void;
  setMode: (m: VigenereMode) => void;
  swap: () => void;
}

export function useVigenereCipher(): UseVigenereCipherReturn {
  const input = ref<string>('');
  const keyword = ref<string>('');
  const mode = ref<VigenereMode>('encrypt');
  const output = ref<string>('');
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    const kw = keyword.value;
    if (text.length === 0) {
      output.value = '';
      error.value = '';
      return;
    }
    if (sanitizeKeyword(kw).length === 0) {
      output.value = '';
      error.value = 'Keyword must contain at least one letter.';
      return;
    }
    error.value = '';
    output.value = mode.value === 'encrypt' ? vigenereEncrypt(text, kw) : vigenereDecrypt(text, kw);
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

  function setKeyword(k: string): void {
    keyword.value = k;
  }

  function setMode(m: VigenereMode): void {
    mode.value = m;
  }

  function swap(): void {
    if (output.value) {
      input.value = output.value;
    }
    mode.value = mode.value === 'encrypt' ? 'decrypt' : 'encrypt';
  }

  watch(input, scheduleRun);
  watch(keyword, scheduleRun);
  watch(mode, scheduleRun);

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.keyword === 'string') keyword.value = p.keyword;
      if (typeof p.mode === 'string' && (p.mode === 'encrypt' || p.mode === 'decrypt')) {
        mode.value = p.mode;
      }
    },
    output,
    toOutput: () => ({ output: output.value, keyword: keyword.value, mode: mode.value }),
  });

  return {
    input,
    keyword,
    mode,
    output,
    error,
    isEmbed,
    embedInput,
    recompute,
    setKeyword,
    setMode,
    swap,
  };
}
