/**
 * useBaconCipher - composable + pure logic for the Bacon cipher tool.
 *
 * A steganographic cipher that encodes each letter as a 5-bit pattern of
 * two typefaces (traditionally 'a' and 'b', or lowercase/uppercase). The
 * 26-letter alphabet is mapped using the standard Bacon's cipher table
 * (I/J and U/V share codes in the original 24-letter variant; the 26-letter
 * variant assigns unique codes).
 *
 *   Encode: text → 5-character groups of 'a' and 'b'
 *   Decode: 5-character groups of 'a'/'b' (or '0'/'1') → text
 *
 * Pure helpers (`BACON_MAP_26`, `baconEncrypt`, `baconDecrypt`) have no
 * Vue dependency. The `useBaconCipher()` composable wraps them in reactive
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

/** 26-letter Bacon cipher map (each letter gets a unique 5-bit code). */
export const BACON_MAP_26: Readonly<Record<string, string>> = {
  A: 'AAAAA', B: 'AAAAB', C: 'AAABA', D: 'AAABB',
  E: 'AABAA', F: 'AABAB', G: 'AABBA', H: 'AABBB',
  I: 'ABAAA', J: 'ABAAB', K: 'ABABA', L: 'ABABB',
  M: 'ABBAA', N: 'ABBAB', O: 'ABBBA', P: 'ABBBB',
  Q: 'BAAAA', R: 'BAAAB', S: 'BAABA', T: 'BAABB',
  U: 'BABAA', V: 'BABAB', W: 'BABBA', X: 'BABBB',
  Y: 'BBAAA', Z: 'BBAAB',
};

/** Reverse map for decoding. */
const BACON_DECODE_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(BACON_MAP_26).map(([ch, code]) => [code, ch]),
);

/** Default separator between 5-bit groups. */
export const DEFAULT_SEPARATOR = ' ';

/**
 * Encode `text` into Bacon cipher (5-bit 'a'/'b' groups). Only letters
 * are encoded; non-letter characters are skipped. Groups are joined by
 * `separator`.
 */
export function baconEncrypt(
  text: string,
  separator: string = DEFAULT_SEPARATOR,
): string {
  if (!text) return '';
  const parts: string[] = [];
  for (const ch of text) {
    const upper = ch.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') {
      parts.push(BACON_MAP_26[upper] ?? '');
    }
  }
  return parts.join(separator);
}

/**
 * Decode Bacon cipher (5-bit 'a'/'b' or '0'/'1' groups) back to text.
 * Tolerates 'a'/'b', 'A'/'B', '0'/'1' as the two symbols. Whitespace
 * is treated as a separator. Unrecognized groups are skipped.
 */
export function baconDecrypt(input: string): string {
  if (!input) return '';
  // Normalize: map 0→A, 1→B (and lowercase to uppercase).
  const normalized = input
    .toUpperCase()
    .replace(/0/g, 'A')
    .replace(/1/g, 'B');
  // Extract all 5-character groups of A/B.
  const groups = normalized
    .split(/[^AB]+/)
    .filter((g) => g.length > 0);
  let out = '';
  for (const g of groups) {
    // Process in 5-char chunks.
    for (let i = 0; i + 5 <= g.length; i += 5) {
      const code = g.slice(i, i + 5);
      const ch = BACON_DECODE_MAP[code];
      if (ch) out += ch;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type BaconMode = 'encode' | 'decode';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseBaconCipherReturn {
  input: Ref<string>;
  mode: Ref<BaconMode>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: BaconMode) => void;
  swap: () => void;
}

export function useBaconCipher(): UseBaconCipherReturn {
  const input = ref<string>('');
  const mode = ref<BaconMode>('encode');
  const output = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      output.value = '';
      return;
    }
    output.value =
      mode.value === 'encode' ? baconEncrypt(text) : baconDecrypt(text);
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

  function setMode(m: BaconMode): void {
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
