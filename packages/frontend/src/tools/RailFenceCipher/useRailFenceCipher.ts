/**
 * useRailFenceCipher - composable + pure logic for the Rail Fence cipher tool.
 *
 * A transposition cipher where the plaintext is written in a zig-zag pattern
 * across `rails` rows, then read off row by row to produce the ciphertext.
 *
 *   rails = 3, "HELLO WORLD" →
 *     H . . . O . . . R . .
 *     . E . L . O . W . R . D
 *     . . L . . . . . L . . .
 *   → "HOLELWRDLOL" (with spaces stripped: "HOLELWRDLOL")
 *
 * Pure helpers (`railFenceEncrypt`, `railFenceDecrypt`) have no Vue
 * dependency. The `useRailFenceCipher()` composable wraps them in reactive
 * state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Minimum number of rails. */
export const MIN_RAILS = 2;

/** Maximum number of rails. */
export const MAX_RAILS = 20;

/** Default number of rails. */
export const DEFAULT_RAILS = 3;

/**
 * Compute the zig-zag pattern: for each character position, determine which
 * rail it belongs to. Returns an array of rail indices (0-based).
 */
function railPattern(length: number, rails: number): number[] {
  const pattern: number[] = new Array(length);
  let rail = 0;
  let direction = 1;
  for (let i = 0; i < length; i++) {
    pattern[i] = rail;
    if (rail === 0) direction = 1;
    else if (rail === rails - 1) direction = -1;
    rail += direction;
  }
  return pattern;
}

/**
 * Encrypt `text` using the Rail Fence cipher with `rails` rails.
 * Non-alphabetic characters are preserved in the output. The zig-zag
 * pattern is applied to the full text (including spaces and punctuation).
 */
export function railFenceEncrypt(text: string, rails: number = DEFAULT_RAILS): string {
  if (!text || rails < 2) return text;
  const n = text.length;
  if (n < rails) return text;
  const pattern = railPattern(n, rails);
  // Group characters by rail.
  const railChars: string[][] = Array.from({ length: rails }, () => []);
  for (let i = 0; i < n; i++) {
    railChars[pattern[i]!]!.push(text[i]!);
  }
  return railChars.map((r) => r.join('')).join('');
}

/**
 * Decrypt `text` using the Rail Fence cipher with `rails` rails.
 * Reconstructs the zig-zag pattern to determine how many characters
 * belong to each rail, then reads them back in zig-zag order.
 */
export function railFenceDecrypt(text: string, rails: number = DEFAULT_RAILS): string {
  if (!text || rails < 2) return text;
  const n = text.length;
  if (n < rails) return text;
  const pattern = railPattern(n, rails);
  // Count how many characters belong to each rail.
  const counts: number[] = new Array(rails).fill(0);
  for (let i = 0; i < n; i++) {
    counts[pattern[i]!]!++;
  }
  // Slice the ciphertext into per-rail segments.
  const segments: string[] = [];
  let pos = 0;
  for (let r = 0; r < rails; r++) {
    segments.push(text.slice(pos, pos + counts[r]!));
    pos += counts[r]!;
  }
  // Read back in zig-zag order.
  const indices: number[] = new Array(rails).fill(0);
  let out = '';
  for (let i = 0; i < n; i++) {
    const r = pattern[i]!;
    out += segments[r]![indices[r]!]!;
    indices[r]!++;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type RailFenceMode = 'encrypt' | 'decrypt';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseRailFenceCipherReturn {
  input: Ref<string>;
  mode: Ref<RailFenceMode>;
  rails: Ref<number>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: RailFenceMode) => void;
  setRails: (n: number) => void;
  swap: () => void;
}

export function useRailFenceCipher(): UseRailFenceCipherReturn {
  const input = ref<string>('');
  const mode = ref<RailFenceMode>('encrypt');
  const rails = ref<number>(DEFAULT_RAILS);
  const output = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      return;
    }
    output.value =
      mode.value === 'encrypt'
        ? railFenceEncrypt(text, rails.value)
        : railFenceDecrypt(text, rails.value);
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

  function setMode(m: RailFenceMode): void {
    mode.value = m;
  }

  function setRails(n: number): void {
    rails.value = Math.max(MIN_RAILS, Math.min(MAX_RAILS, n));
  }

  function swap(): void {
    if (output.value) {
      input.value = output.value;
    }
    mode.value = mode.value === 'encrypt' ? 'decrypt' : 'encrypt';
  }

  watch(input, scheduleRun);
  watch(mode, scheduleRun);
  watch(rails, scheduleRun);

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string' && (p.mode === 'encrypt' || p.mode === 'decrypt')) {
        mode.value = p.mode;
      }
      if (typeof p.rails === 'number') setRails(p.rails);
    },
    output,
    toOutput: () => ({ output: output.value, mode: mode.value, rails: rails.value }),
  });

  return {
    input,
    mode,
    rails,
    output,
    isEmbed,
    embedInput,
    recompute,
    setMode,
    setRails,
    swap,
  };
}
