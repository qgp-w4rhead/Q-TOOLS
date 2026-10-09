/**
 * useTextToUnicode - composable + pure logic for the Text-to-Unicode tool.
 *
 * Bidirectional conversion between text and Unicode escape sequences
 * (`\uXXXX`). Encode mode renders each UTF-16 code unit as a `\uXXXX` escape
 * (supplementary-plane code points therefore emit a surrogate pair
 * `\uD83D\uDE00`). Decode mode parses `\uXXXX` / `\UXXXX` escapes (4 hex
 * digits, case-insensitive on both the prefix and the hex) back into text.
 * Bare backslashes and unrecognized escapes are preserved verbatim during
 * decode so the input never silently loses characters.
 *
 * The analysis panel reports, for the input string:
 *   - code points (count + `U+XXXX` list)
 *   - UTF-16 code units (count + byte length)
 *   - UTF-8 byte length
 *   - per-character breakdown (char, code point, UTF-16 units, UTF-8 bytes)
 *
 * Pure helpers (`encodeUnicodeEscapes`, `decodeUnicodeEscapes`,
 * `toCodePointHex`, `iterCodePoints`, `analyzeChars`) have no Vue dependency
 * and can be imported standalone for unit testing or reuse. The
 * `useTextToUnicode()` composable wraps them in reactive state and wires up
 * the embed PostMessage protocol.
 *
 * No external dependencies - only the JS `String` API and `TextEncoder`.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type UnicodeMode = 'encode' | 'decode';

/** Default escape prefix (`\u`). */
export const DEFAULT_PREFIX = '\\u';

/** Regex matching a `\uXXXX` or `\UXXXX` escape (4 hex digits, case-insensitive). */
const UNICODE_ESCAPE_RE = /\\[uU][0-9a-fA-F]{4}/g;

/**
 * Pad a hex code-unit/code-point value to at least 4 hex digits (uppercase).
 * Supplementary-plane code points (> 0xFFFF) are padded to 6 digits.
 */
export function toCodePointHex(cp: number): string {
  if (cp > 0xffff) return cp.toString(16).toUpperCase().padStart(6, '0');
  return cp.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Iterate over the Unicode code points of a string, yielding each code point
 * value and the index of its first UTF-16 code unit. Uses `String.prototype[
 * Symbol.iterator]` which decodes surrogate pairs correctly; lone surrogates
 * yield their individual code-unit value.
 */
export function iterCodePoints(str: string): Array<{ codePoint: number; index: number }> {
  const out: Array<{ codePoint: number; index: number }> = [];
  let i = 0;
  // Manual iteration so we can track the UTF-16 index of each code point.
  while (i < str.length) {
    const codeUnit = str.charCodeAt(i);
    const hi = codeUnit;
    const lo = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
    // High surrogate followed by low surrogate → full code point.
    if (hi >= 0xd800 && hi <= 0xdbff && lo >= 0xdc00 && lo <= 0xdfff) {
      const cp = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      out.push({ codePoint: cp, index: i });
      i += 2;
    } else {
      out.push({ codePoint: codeUnit, index: i });
      i += 1;
    }
  }
  return out;
}

/**
 * Encode a string into `\uXXXX` Unicode escape sequences. Each UTF-16 code
 * unit becomes one `\uXXXX` escape, so supplementary-plane code points emit
 * a surrogate pair (`\uD83D\uDE00` for 😀). The output is a contiguous string
 * of escapes with no separators.
 *
 * `prefix` defaults to `\u` but can be overridden (e.g. `\U`) - useful for
 * testing or alternate conventions.
 */
export function encodeUnicodeEscapes(text: string, prefix: string = DEFAULT_PREFIX): string {
  if (text.length === 0) return '';
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    out += prefix + unit.toString(16).toUpperCase().padStart(4, '0');
  }
  return out;
}

/**
 * Decode a string containing `\uXXXX` / `\UXXXX` escapes back into text.
 * Escapes are 4 hex digits, case-insensitive on both the prefix and the hex
 * digits. Bare backslashes and unrecognized escape sequences (e.g. `\n`,
 * `\t`, `\\`, `\u12`) are preserved verbatim so input is never silently
 * lost. Returns the decoded string; never returns `null` (decode is
 * best-effort and always yields a string).
 */
export function decodeUnicodeEscapes(input: string): string {
  if (input.length === 0) return '';
  // Reset regex state (it's a global regex, reused across calls).
  UNICODE_ESCAPE_RE.lastIndex = 0;
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = UNICODE_ESCAPE_RE.exec(input)) !== null) {
    const matchStart = m.index;
    // Append any literal text before this escape verbatim.
    if (matchStart > last) out += input.slice(last, matchStart);
    const hex = m[0].slice(2); // strip `\u` / `\U`
    const codeUnit = parseInt(hex, 16);
    out += String.fromCharCode(codeUnit);
    last = matchStart + m[0].length;
  }
  if (last < input.length) out += input.slice(last);
  return out;
}

/** Per-character breakdown row. */
export interface CharBreakdownRow {
  /** The literal character (may be a surrogate pair rendered as one glyph). */
  char: string;
  /** Code point as `U+XXXX` (6 hex digits for supplementary plane). */
  codePoint: string;
  /** Numeric code point value. */
  codePointValue: number;
  /** Number of UTF-16 code units (1 for BMP, 2 for supplementary). */
  utf16Units: number;
  /** Number of UTF-8 bytes for this code point. */
  utf8Bytes: number;
  /** Display label for the character (escapes for control chars / empty). */
  display: string;
}

/** Full analysis of a string. */
export interface UnicodeAnalysis {
  /** Total UTF-16 code unit count (`string.length`). */
  codeUnits: number;
  /** Total code point count (decoded surrogate pairs). */
  codePointCount: number;
  /** UTF-16 byte length (`codeUnits * 2`). */
  utf16Bytes: number;
  /** UTF-8 byte length (via `TextEncoder`). */
  utf8Bytes: number;
  /** `U+XXXX` list (one entry per code point). */
  codePoints: string[];
  /** Per-character breakdown rows. */
  rows: CharBreakdownRow[];
}

/** A printable display label for a single character / code point. */
function displayForChar(char: string, cp: number): string {
  if (char === '') return '\\0';
  if (cp === 0x09) return '\\t';
  if (cp === 0x0a) return '\\n';
  if (cp === 0x0d) return '\\r';
  if (cp < 0x20 || cp === 0x7f) return '\\x' + cp.toString(16).toUpperCase().padStart(2, '0');
  return char;
}

/**
 * Analyse a string: count code points / units / bytes and build a per-char
 * breakdown table. UTF-8 byte counts are computed per code point via
 * `TextEncoder` so multi-byte sequences are reported correctly.
 */
export function analyzeChars(text: string): UnicodeAnalysis {
  const encoder = new TextEncoder();
  const points = iterCodePoints(text);
  const rows: CharBreakdownRow[] = points.map(({ codePoint }) => {
    const char = String.fromCodePoint(codePoint);
    const utf16Units = codePoint > 0xffff ? 2 : 1;
    const utf8Bytes = encoder.encode(char).length;
    return {
      char,
      codePoint: 'U+' + toCodePointHex(codePoint),
      codePointValue: codePoint,
      utf16Units,
      utf8Bytes,
      display: displayForChar(char, codePoint),
    };
  });
  return {
    codeUnits: text.length,
    codePointCount: points.length,
    utf16Bytes: text.length * 2,
    utf8Bytes: encoder.encode(text).length,
    codePoints: rows.map((r) => r.codePoint),
    rows,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface TextToUnicodeOutputs {
  /** The converted value (escapes when encoding, text when decoding). */
  output: string;
  /** Analysis of the *input* string (always the source text, regardless of mode). */
  analysis: UnicodeAnalysis;
}

export const DEFAULT_MODE: UnicodeMode = 'encode';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UseTextToUnicodeReturn {
  input: Ref<string>;
  mode: Ref<UnicodeMode>;
  prefix: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  outputs: Ref<TextToUnicodeOutputs | null>;
  error: Ref<string>;
  recompute: () => void;
  setMode: (m: UnicodeMode) => void;
  setPrefix: (p: string) => void;
  swap: () => void;
}

export function useTextToUnicode(): UseTextToUnicodeReturn {
  const input = ref<string>('');
  const mode = ref<UnicodeMode>(DEFAULT_MODE);
  const prefix = ref<string>(DEFAULT_PREFIX);
  const outputs = ref<TextToUnicodeOutputs | null>(null);
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
      const out = encodeUnicodeEscapes(text, prefix.value);
      outputs.value = {
        output: out,
        analysis: analyzeChars(text),
      };
      error.value = '';
    } else {
      const out = decodeUnicodeEscapes(text);
      outputs.value = {
        output: out,
        // Analyse the *decoded* text so the panel reflects the real characters.
        analysis: analyzeChars(out),
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

  function setMode(m: UnicodeMode): void {
    mode.value = m;
  }

  function setPrefix(p: string): void {
    prefix.value = p;
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
  watch(prefix, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string' && (p.mode === 'encode' || p.mode === 'decode')) {
        mode.value = p.mode;
      }
      if (typeof p.prefix === 'string') prefix.value = p.prefix;
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
    prefix,
    isEmbed,
    embedInput,
    outputs,
    error,
    recompute,
    setMode,
    setPrefix,
    swap,
  };
}
