/**
 * useAsciiBinary - composable + pure logic for the Text-to-ASCII-binary tool.
 *
 * Bidirectional conversion between UTF-8 text and binary (base-2) byte
 * representations. Each input byte is rendered as 8 bits (zero-padded to
 * the left), and bytes are joined with a configurable separator (default a
 * single space).
 *
 * Because the conversion operates on UTF-8 bytes (via `TextEncoder` /
 * `TextDecoder`), any Unicode code point round-trips correctly - not just
 * ASCII. The "ASCII binary" name is the conventional label for this kind of
 * tool; the implementation is UTF-8 safe.
 *
 * Pure helpers (`bytesToBinary`, `binaryToBytes`, `textToBinary`,
 * `binaryToText`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useAsciiBinary()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type BinaryMode = 'encode' | 'decode';

/** Built-in byte separator presets. */
export type SeparatorPreset = 'space' | 'none';

/** Default separator (a single ASCII space). */
export const DEFAULT_SEPARATOR = ' ';

/**
 * Convert a `Uint8Array` of bytes into a binary string. Each byte is rendered
 * as 8 zero-padded bits (most-significant bit first), and bytes are joined
 * with `separator`.
 *
 * `separator === ''` produces a contiguous bit stream (no delimiters).
 */
export function bytesToBinary(bytes: Uint8Array, separator: string = DEFAULT_SEPARATOR): string {
  if (bytes.length === 0) return '';
  const parts: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    // toString(2) gives the binary representation without leading zeros;
    // padStart(8, '0') fixes the width to 8 bits per byte.
    parts[i] = (bytes[i]! >>> 0).toString(2).padStart(8, '0');
  }
  return parts.join(separator);
}

/**
 * Convert a binary string back into a `Uint8Array` of bytes.
 *
 * The input may be:
 *   - a contiguous stream of `0`/`1` characters (length must be a multiple
 *     of 8), or
 *   - groups of 8 bits separated by whitespace (spaces, tabs, newlines).
 *
 * Characters other than `0`, `1`, and whitespace cause a `null` return
 * (invalid input). Trailing bits that don't form a complete byte (when no
 * separator is present) also cause `null`.
 */
export function binaryToBytes(input: string): Uint8Array | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return new Uint8Array(0);

  // Detect whether the input uses whitespace separators. If it does, we
  // split on whitespace and parse each group as a single byte. If not, we
  // treat it as a contiguous bit stream and chunk it into 8-bit groups.
  const hasWhitespace = /\s/.test(trimmed);

  if (hasWhitespace) {
    const groups = trimmed.split(/\s+/).filter((g) => g.length > 0);
    const out = new Uint8Array(groups.length);
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!;
      if (g.length !== 8 || !/^[01]{8}$/.test(g)) return null;
      out[i] = parseInt(g, 2);
    }
    return out;
  }

  // Contiguous stream - must be a multiple of 8 bits, all 0/1.
  if (!/^[01]+$/.test(trimmed)) return null;
  if (trimmed.length % 8 !== 0) return null;
  const count = trimmed.length / 8;
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = parseInt(trimmed.slice(i * 8, i * 8 + 8), 2);
  }
  return out;
}

/**
 * Encode a UTF-8 string into a binary representation. Routes through
 * `TextEncoder` so any Unicode code point is handled correctly.
 */
export function textToBinary(text: string, separator: string = DEFAULT_SEPARATOR): string {
  if (text.length === 0) return '';
  const bytes = new TextEncoder().encode(text);
  return bytesToBinary(bytes, separator);
}

/**
 * Decode a binary string back to UTF-8 text. Returns `null` when the input
 * is not valid binary (after whitespace handling and 8-bit grouping). The
 * decoded bytes are interpreted as UTF-8 via `TextDecoder` with the `fatal`
 * flag so malformed UTF-8 sequences surface as an error rather than silent
 * replacement.
 */
export function binaryToText(input: string): string | null {
  const bytes = binaryToBytes(input);
  if (bytes === null) return null;
  if (bytes.length === 0) return '';
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface AsciiBinaryOutputs {
  /** The converted value (binary when encoding, text when decoding). */
  output: string;
  /** Number of input bytes (UTF-8 byte length when encoding). */
  inputBytes: number;
  /** Number of output bytes (UTF-8 byte length when decoding). */
  outputBytes: number;
  /** Number of 8-bit byte groups in the binary representation. */
  byteCount: number;
}

export const DEFAULT_MODE: BinaryMode = 'encode';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseAsciiBinaryReturn {
  input: Ref<string>;
  mode: Ref<BinaryMode>;
  separator: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  outputs: Ref<AsciiBinaryOutputs | null>;
  error: Ref<string>;
  recompute: () => void;
  setMode: (m: BinaryMode) => void;
  setSeparator: (s: string) => void;
  swap: () => void;
}

export function useAsciiBinary(): UseAsciiBinaryReturn {
  const input = ref<string>('');
  const mode = ref<BinaryMode>(DEFAULT_MODE);
  const separator = ref<string>(DEFAULT_SEPARATOR);
  const outputs = ref<AsciiBinaryOutputs | null>(null);
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
      const bytes = new TextEncoder().encode(text);
      const out = bytesToBinary(bytes, separator.value);
      outputs.value = {
        output: out,
        inputBytes: bytes.length,
        outputBytes: out.length,
        byteCount: bytes.length,
      };
      error.value = '';
    } else {
      const out = binaryToText(text);
      if (out === null) {
        outputs.value = null;
        error.value =
          'Invalid binary. Use only 0 and 1, in 8-bit groups (whitespace-separated or a contiguous multiple-of-8 stream).';
        return;
      }
      const outputBytes = new TextEncoder().encode(out).length;
      // Count byte groups in the input for display.
      const trimmed = text.trim();
      const byteCount = /\s/.test(trimmed)
        ? trimmed.split(/\s+/).filter((g) => g.length > 0).length
        : Math.floor(trimmed.length / 8);
      outputs.value = {
        output: out,
        inputBytes: trimmed.replace(/\s+/g, '').length,
        outputBytes,
        byteCount,
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

  function setMode(m: BinaryMode): void {
    mode.value = m;
  }

  function setSeparator(s: string): void {
    separator.value = s;
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
  watch(separator, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string' && (p.mode === 'encode' || p.mode === 'decode')) {
        mode.value = p.mode;
      }
      if (typeof p.separator === 'string') separator.value = p.separator;
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
    separator,
    isEmbed,
    embedInput,
    outputs,
    error,
    recompute,
    setMode,
    setSeparator,
    swap,
  };
}
