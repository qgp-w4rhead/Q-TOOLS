/**
 * useAffineCipher - composable + pure logic for the Affine cipher tool.
 *
 * A mathematical substitution cipher: each letter x is mapped to
 *   E(x) = (a * x + b) mod 26
 * where `a` must be coprime with 26 (i.e., gcd(a, 26) = 1). Valid values
 * for `a` are: 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25.
 *
 * Decryption uses the modular multiplicative inverse of `a` modulo 26:
 *   D(y) = a_inv * (y - b) mod 26
 *
 * Only ASCII letters are transformed; case is preserved. Non-letter
 * characters pass through unchanged.
 *
 * Pure helpers (`gcd`, `modInverse`, `affineEncrypt`, `affineDecrypt`,
 * `VALID_A_VALUES`) have no Vue dependency. The `useAffineCipher()`
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

const ALPHABET_SIZE = 26;

/** Valid `a` values (coprime with 26). */
export const VALID_A_VALUES: readonly number[] = [
  1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25,
];

/** Default `a` parameter. */
export const DEFAULT_A = 5;

/** Default `b` parameter. */
export const DEFAULT_B = 8;

/** Compute the greatest common divisor of `a` and `b`. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Compute the modular multiplicative inverse of `a` modulo `m` using the
 * extended Euclidean algorithm. Returns `null` if no inverse exists
 * (i.e., gcd(a, m) ≠ 1).
 */
export function modInverse(a: number, m: number): number | null {
  a = ((a % m) + m) % m;
  let [old_r, r] = [a, m];
  let [old_s, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1) return null;
  return ((old_s % m) + m) % m;
}

/** Check whether `a` is a valid affine parameter (coprime with 26). */
export function isValidA(a: number): boolean {
  return gcd(a, ALPHABET_SIZE) === 1;
}

/**
 * Encrypt `text` using the Affine cipher with parameters `a` and `b`.
 * Each letter x → (a*x + b) mod 26. Case is preserved; non-letters pass through.
 */
export function affineEncrypt(text: string, a: number, b: number): string {
  if (!text) return '';
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(((a * (code - 65) + b) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE + 65);
    } else if (code >= 97 && code <= 122) {
      out += String.fromCharCode(((a * (code - 97) + b) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE + 97);
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Decrypt `text` using the Affine cipher with parameters `a` and `b`.
 * Each letter y → a_inv * (y - b) mod 26. Returns `null` if `a` is not
 * coprime with 26 (no inverse exists).
 */
export function affineDecrypt(text: string, a: number, b: number): string | null {
  if (!text) return '';
  const aInv = modInverse(a, ALPHABET_SIZE);
  if (aInv === null) return null;
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(((aInv * ((code - 65 - b) % ALPHABET_SIZE + ALPHABET_SIZE)) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE + 65);
    } else if (code >= 97 && code <= 122) {
      out += String.fromCharCode(((aInv * ((code - 97 - b) % ALPHABET_SIZE + ALPHABET_SIZE)) % ALPHABET_SIZE + ALPHABET_SIZE) % ALPHABET_SIZE + 97);
    } else {
      out += ch;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type AffineMode = 'encrypt' | 'decrypt';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseAffineCipherReturn {
  input: Ref<string>;
  mode: Ref<AffineMode>;
  a: Ref<number>;
  b: Ref<number>;
  output: Ref<string>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: AffineMode) => void;
  setA: (n: number) => void;
  setB: (n: number) => void;
  swap: () => void;
}

export function useAffineCipher(): UseAffineCipherReturn {
  const input = ref<string>('');
  const mode = ref<AffineMode>('encrypt');
  const a = ref<number>(DEFAULT_A);
  const b = ref<number>(DEFAULT_B);
  const output = ref<string>('');
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      error.value = '';
      return;
    }
    if (!isValidA(a.value)) {
      output.value = '';
      error.value = `a=${a.value} is not coprime with 26. Valid values: ${VALID_A_VALUES.join(', ')}.`;
      return;
    }
    error.value = '';
    if (mode.value === 'encrypt') {
      output.value = affineEncrypt(text, a.value, b.value);
    } else {
      const result = affineDecrypt(text, a.value, b.value);
      if (result === null) {
        output.value = '';
        error.value = `Cannot decrypt: a=${a.value} has no modular inverse mod 26.`;
      } else {
        output.value = result;
      }
    }
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

  function setMode(m: AffineMode): void {
    mode.value = m;
  }

  function setA(n: number): void {
    a.value = n;
  }

  function setB(n: number): void {
    b.value = n;
  }

  function swap(): void {
    if (output.value) {
      input.value = output.value;
    }
    mode.value = mode.value === 'encrypt' ? 'decrypt' : 'encrypt';
  }

  watch(input, scheduleRun);
  watch(mode, scheduleRun);
  watch(a, scheduleRun);
  watch(b, scheduleRun);

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string' && (p.mode === 'encrypt' || p.mode === 'decrypt')) {
        mode.value = p.mode;
      }
      if (typeof p.a === 'number') a.value = p.a;
      if (typeof p.b === 'number') b.value = p.b;
    },
    output,
    toOutput: () => ({ output: output.value, mode: mode.value, a: a.value, b: b.value }),
  });

  return {
    input,
    mode,
    a,
    b,
    output,
    error,
    isEmbed,
    embedInput,
    recompute,
    setMode,
    setA,
    setB,
    swap,
  };
}
