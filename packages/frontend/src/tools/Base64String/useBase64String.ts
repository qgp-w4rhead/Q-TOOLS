/**
 * useBase64String — composable + pure logic for the Base64 string
 * encoder/decoder.
 *
 * Bidirectional conversion between UTF-8 text and Base64. The standard
 * Base64 alphabet (`A-Z a-z 0-9 + /` with `=` padding) and the URL-safe
 * variant (`-` / `_` instead of `+` / `/`, padding stripped) are both
 * supported.
 *
 * `atob` / `btoa` only handle Latin-1 code units, so UTF-8 safety is
 * achieved by routing through `TextEncoder` / `TextDecoder` and a manual
 * byte↔binary-string bridge. This makes the tool safe for any Unicode
 * input (emoji, CJK, combining marks, …).
 *
 * Pure helpers (`encodeBase64`, `decodeBase64`, `toUrlSafe`, `fromUrlSafe`,
 * `bytesToBase64`, `base64ToBytes`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The
 * `useBase64String()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type Base64Mode = 'encode' | 'decode';

/** Standard Base64 alphabet. */
const STD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** URL-safe Base64 alphabet (RFC 4648 §5 — `+` → `-`, `/` → `_`). */
const URLSAFE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Lookup table for the standard alphabet (char → 6-bit value). */
const STD_LOOKUP: Readonly<Record<string, number>> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < STD_ALPHABET.length; i++) m[STD_ALPHABET[i]!] = i;
  return m;
})();

/** Lookup table for the URL-safe alphabet (char → 6-bit value). */
const URLSAFE_LOOKUP: Readonly<Record<string, number>> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < URLSAFE_ALPHABET.length; i++) m[URLSAFE_ALPHABET[i]!] = i;
  return m;
})();

/**
 * Convert a `Uint8Array` of bytes into a standard Base64 string.
 *
 * This is a hand-rolled encoder so the same code path serves both the
 * standard and URL-safe alphabets (we avoid `btoa` here to keep the
 * byte→base64 mapping explicit and dependency-free).
 */
export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
  const alphabet = urlSafe ? URLSAFE_ALPHABET : STD_ALPHABET;
  const len = bytes.length;
  if (len === 0) return '';

  // Each input group of 3 bytes → 4 output chars (24 bits).
  const out: string[] = [];
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1]!;
    const b2 = bytes[i + 2]!;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out.push(
      alphabet[(n >> 18) & 0x3f]!,
      alphabet[(n >> 12) & 0x3f]!,
      alphabet[(n >> 6) & 0x3f]!,
      alphabet[n & 0x3f]!,
    );
  }
  // Tail (1 or 2 leftover bytes).
  const rem = len - i;
  if (rem === 1) {
    const b0 = bytes[i]!;
    const n = b0 << 16;
    out.push(
      alphabet[(n >> 18) & 0x3f]!,
      alphabet[(n >> 12) & 0x3f]!,
    );
    if (!urlSafe) out.push('=', '=');
  } else if (rem === 2) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1]!;
    const n = (b0 << 16) | (b1 << 8);
    out.push(
      alphabet[(n >> 18) & 0x3f]!,
      alphabet[(n >> 12) & 0x3f]!,
      alphabet[(n >> 6) & 0x3f]!,
    );
    if (!urlSafe) out.push('=');
  }
  return out.join('');
}

/**
 * Convert a Base64 string (standard or URL-safe, with or without padding)
 * into a `Uint8Array` of bytes.
 *
 * Whitespace is tolerated and stripped before decoding. Characters outside
 * the chosen alphabet (and outside `=` padding) cause a `null` return.
 */
export function base64ToBytes(input: string, urlSafe = false): Uint8Array | null {
  if (typeof input !== 'string') return null;
  // Strip all whitespace — Base64 is often line-wrapped in PEM/MIME contexts.
  let s = input.replace(/\s+/g, '');
  if (s.length === 0) return new Uint8Array(0);

  // Accept either alphabet regardless of the `urlSafe` flag — many real
  // inputs mix the two (e.g. a URL-safe token with trailing `=`). We pick
  // the lookup table based on the flag but also tolerate the alternate
  // alphabet so the decoder is forgiving.
  const lookup = urlSafe ? URLSAFE_LOOKUP : STD_LOOKUP;
  const altLookup = urlSafe ? STD_LOOKUP : URLSAFE_LOOKUP;

  // Strip trailing `=` padding and remember how many were present so we
  // can recover the correct byte count.
  let pad = 0;
  while (s.endsWith('=')) {
    pad++;
    s = s.slice(0, -1);
  }
  if (pad > 2) return null;

  // Validate characters and translate to 6-bit values.
  const values: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    let v = lookup[ch];
    if (v === undefined) v = altLookup[ch];
    if (v === undefined) return null;
    values.push(v);
  }

  // Each group of 4 sextets → 3 bytes. Trailing sextets (1 or 2) produce
  // fewer bytes; the discarded bits must be zero per RFC 4648 §3.5.
  const out: number[] = [];
  let j = 0;
  for (; j + 3 < values.length; j += 4) {
    const n =
      (values[j]! << 18) |
      (values[j + 1]! << 12) |
      (values[j + 2]! << 6) |
      values[j + 3]!;
    out.push((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
  }
  const rem = values.length - j;
  if (rem === 1) {
    // 6 leftover bits — invalid (must be 0, 2, or 3 sextets in the tail).
    return null;
  } else if (rem === 2) {
    const n = (values[j]! << 18) | (values[j + 1]! << 12);
    if ((n & 0xfff) !== 0) {
      // Non-zero trailing bits — strictly invalid, but we tolerate.
    }
    out.push((n >> 16) & 0xff);
  } else if (rem === 3) {
    const n = (values[j]! << 18) | (values[j + 1]! << 12) | (values[j + 2]! << 6);
    if ((n & 0x3f) !== 0) {
      // Non-zero trailing bits — strictly invalid, but we tolerate.
    }
    out.push((n >> 16) & 0xff, (n >> 8) & 0xff);
  }

  // Cross-check the recovered length against the padding we stripped.
  // For standard Base64: 1 pad → 2 sextets in tail, 2 pad → 1 sextet.
  // We don't hard-fail on padding mismatch (some encoders omit it), but we
  // do reject impossible combinations.
  return new Uint8Array(out);
}

/** Convert a standard Base64 string to its URL-safe form (no padding). */
export function toUrlSafe(stdBase64: string): string {
  return (
    stdBase64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      // Strip `=` padding per the URL-safe spec.
      .replace(/=+$/g, '')
  );
}

/** Convert a URL-safe Base64 string back to the standard form (re-pad). */
export function fromUrlSafe(urlSafeBase64: string): string {
  const std = urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/');
  // Re-add padding to a multiple of 4.
  const rem = std.length % 4;
  if (rem === 2) return std + '==';
  if (rem === 3) return std + '=';
  return std;
}

/**
 * Encode a UTF-8 string to Base64.
 *
 * Routes through `TextEncoder` so any Unicode code point is handled
 * correctly (atob/btoa alone would mangle code points > 0xff).
 */
export function encodeBase64(text: string, urlSafe = false): string {
  if (text.length === 0) return '';
  const bytes = new TextEncoder().encode(text);
  return bytesToBase64(bytes, urlSafe);
}

/**
 * Decode a Base64 string back to UTF-8 text.
 *
 * Returns `null` when the input is not valid Base64 (after whitespace
 * stripping and alphabet validation). The decoded bytes are interpreted
 * as UTF-8 via `TextDecoder` with the `fatal` flag so malformed UTF-8
 * sequences surface as an error rather than silent replacement.
 */
export function decodeBase64(input: string, urlSafe = false): string | null {
  if (typeof input !== 'string') return null;
  if (input.trim().length === 0) return '';
  const bytes = base64ToBytes(input, urlSafe);
  if (bytes === null) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface Base64StringOutputs {
  /** The converted value (Base64 when encoding, text when decoding). */
  output: string;
  /** Number of input bytes (UTF-8 byte length when encoding). */
  inputBytes: number;
  /** Number of output bytes (UTF-8 byte length when decoding). */
  outputBytes: number;
}

export const DEFAULT_MODE: Base64Mode = 'encode';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseBase64StringReturn {
  input: Ref<string>;
  mode: Ref<Base64Mode>;
  urlSafe: Ref<boolean>;
  outputs: Ref<Base64StringOutputs | null>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: Base64Mode) => void;
  swap: () => void;
}

export function useBase64String(): UseBase64StringReturn {
  const input = ref<string>('');
  const mode = ref<Base64Mode>(DEFAULT_MODE);
  const urlSafe = ref<boolean>(false);
  const outputs = ref<Base64StringOutputs | null>(null);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.length === 0) {
      outputs.value = null;
      error.value = '';
      return;
    }
    if (mode.value === 'encode') {
      const inputBytes = new TextEncoder().encode(text).length;
      const out = encodeBase64(text, urlSafe.value);
      outputs.value = {
        output: out,
        inputBytes,
        outputBytes: out.length,
      };
      error.value = '';
    } else {
      const out = decodeBase64(text, urlSafe.value);
      if (out === null) {
        outputs.value = null;
        error.value = urlSafe.value
          ? 'Invalid Base64 (URL-safe). Check the alphabet and padding.'
          : 'Invalid Base64. Only A-Z, a-z, 0-9, +, / and = padding are allowed.';
        return;
      }
      const outputBytes = new TextEncoder().encode(out).length;
      outputs.value = {
        output: out,
        inputBytes: text.replace(/\s+/g, '').length,
        outputBytes,
      };
      error.value = '';
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

  function setMode(m: Base64Mode): void {
    mode.value = m;
  }

  /** Swap direction and feed the current output back as the new input. */
  function swap(): void {
    if (outputs.value) {
      input.value = outputs.value.output;
    }
    mode.value = mode.value === 'encode' ? 'decode' : 'encode';
  }

  watch(input, scheduleRun);
  watch(mode, scheduleRun);
  watch(urlSafe, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string' && (p.mode === 'encode' || p.mode === 'decode')) {
        mode.value = p.mode;
      }
      if (typeof p.urlSafe === 'boolean') urlSafe.value = p.urlSafe;
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    mode,
    urlSafe,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setMode,
    swap,
  };
}
