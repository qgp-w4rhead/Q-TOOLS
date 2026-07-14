/**
 * useStringObfuscator — composable + pure logic for the String obfuscator tool.
 *
 * Obfuscates text by replacing ASCII characters with visually-similar Unicode
 * lookalikes (homoglyphs) and/or inserting zero-width characters between
 * visible characters. Provides a deobfuscate mode that strips zero-width
 * characters and reverses homoglyph substitution back to ASCII.
 *
 * The homoglyph map uses Cyrillic, Greek, IPA, and Armenian code points that
 * are visually confusable with Latin letters. Every lookalike in the map is
 * unique across all ASCII sources, so the reverse map is unambiguous and
 * deobfuscation is deterministic.
 *
 * All randomness uses `crypto.getRandomValues()` with rejection sampling
 * (no modulo bias). No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type ObfuscationMethod = 'homoglyph' | 'zero-width' | 'mixed';
export type Intensity = 'low' | 'medium' | 'high';
export type ObfuscatorMode = 'obfuscate' | 'deobfuscate';

export interface ObfuscatorOptions {
  method: ObfuscationMethod;
  intensity: Intensity;
}

/* -------------------------------------------------------------------------- */
/* Constants — bundled homoglyph + zero-width tables (no external dependency)  */
/* -------------------------------------------------------------------------- */

/**
 * Homoglyph substitution table. Each ASCII character maps to one or more
 * visually-similar Unicode characters drawn from Cyrillic, Greek, IPA, and
 * Armenian blocks. Every lookalike code point appears in exactly one entry,
 * guaranteeing an unambiguous reverse map.
 */
export const HOMOGLYPHS: Readonly<Record<string, readonly string[]>> = {
  // ── lowercase Latin ────────────────────────────────────────────────────
  'a': ['\u0430', '\u03B1', '\u0251'], // Cyrillic а, Greek α, IPA ɑ
  'c': ['\u0441', '\u03F2'],           // Cyrillic с, Greek lunate sigma ϲ
  'e': ['\u0435', '\u03B5'],           // Cyrillic е, Greek ε
  'i': ['\u0456', '\u03B9', '\u0131'], // Cyrillic і, Greek ι, dotless ı
  'j': ['\u0458'],                     // Cyrillic ј
  'o': ['\u043E', '\u03BF', '\u0585'], // Cyrillic о, Greek ο, Armenian օ
  'p': ['\u0440', '\u03C1'],           // Cyrillic р, Greek ρ
  's': ['\u0455', '\u03C2'],           // Cyrillic ѕ, Greek final sigma ς
  'x': ['\u0445', '\u03C7'],           // Cyrillic х, Greek χ
  'y': ['\u0443', '\u03B3'],           // Cyrillic у, Greek γ
  // ── uppercase Latin ────────────────────────────────────────────────────
  'A': ['\u0410', '\u0391'],           // Cyrillic А, Greek Α
  'B': ['\u0412', '\u0392'],           // Cyrillic В, Greek Β
  'C': ['\u0421', '\u03F9'],           // Cyrillic С, Greek Ϲ
  'E': ['\u0415', '\u0395'],           // Cyrillic Е, Greek Ε
  'H': ['\u041D', '\u0397'],           // Cyrillic Н, Greek Η
  'I': ['\u0406', '\u0399'],           // Cyrillic І, Greek Ι
  'K': ['\u041A', '\u039A'],           // Cyrillic К, Greek Κ
  'M': ['\u041C', '\u039C'],           // Cyrillic М, Greek Μ
  'N': ['\u039D'],                     // Greek Ν
  'O': ['\u041E', '\u039F', '\u0554'], // Cyrillic О, Greek Ο, Armenian Օ
  'P': ['\u0420', '\u03A1'],           // Cyrillic Р, Greek Ρ
  'S': ['\u0405'],                     // Cyrillic Ѕ
  'T': ['\u0422', '\u03A4'],           // Cyrillic Т, Greek Τ
  'X': ['\u0425', '\u03A7'],           // Cyrillic Х, Greek Χ
  'Y': ['\u0423', '\u03A5'],           // Cyrillic У, Greek Υ
};

/**
 * Reverse homoglyph map: lookalike → ASCII source. Built once from
 * `HOMOGLYPHS`; every lookalike is unique so this is unambiguous.
 */
export const REVERSE_HOMOGLYPHS: Readonly<Record<string, string>> = (() => {
  const rev: Record<string, string> = {};
  for (const [ascii, lookalikes] of Object.entries(HOMOGLYPHS)) {
    for (const lk of lookalikes) rev[lk] = ascii;
  }
  return rev;
})();

/**
 * Zero-width characters inserted between visible characters in the
 * `zero-width` and `mixed` methods.
 *
 * - U+200B Zero-Width Space
 * - U+200C Zero-Width Non-Joiner
 * - U+200D Zero-Width Joiner
 * - U+FEFF Zero-Width No-Break Space (BOM)
 */
export const ZERO_WIDTH_CHARS = [
  '\u200B',
  '\u200C',
  '\u200D',
  '\uFEFF',
] as const;

/** Set of all zero-width characters for fast deobfuscation stripping. */
const ZERO_WIDTH_SET = new Set<string>(ZERO_WIDTH_CHARS);

/** Substitution probability per eligible character, keyed by intensity. */
const INTENSITY_RATE: Record<Intensity, number> = {
  low: 0.3,
  medium: 0.6,
  high: 1.0,
};

/** Number of zero-width characters inserted between visible characters. */
const INTENSITY_ZW_COUNT: Record<Intensity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Generate a uniformly-distributed random float in [0, 1) using
 * `crypto.getRandomValues()` with a 32-bit draw. Falls back to `Math.random()`
 * in non-secure contexts so the tool still functions.
 */
function randomFloat(): number {
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto?.getRandomValues === 'function'
  ) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return (buf[0] ?? 0) / 0x100000000;
  }
  return Math.random();
}

/**
 * Generate a uniformly-distributed random integer in [0, max) using
 * `crypto.getRandomValues()` with rejection sampling (no modulo bias).
 */
function randomInt(max: number): number {
  if (max <= 0) return 0;
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto?.getRandomValues === 'function'
  ) {
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    for (let i = 0; i < 32; i++) {
      globalThis.crypto.getRandomValues(buf);
      const r = buf[0] ?? 0;
      if (r < limit) return r % max;
    }
    return Math.floor(Math.random() * max);
  }
  return Math.floor(Math.random() * max);
}

/**
 * Obfuscate text by replacing eligible ASCII characters with random Unicode
 * homoglyphs. Characters without a homoglyph entry pass through unchanged.
 * The substitution rate is controlled by `intensity`.
 */
export function obfuscateHomoglyph(text: string, intensity: Intensity): string {
  const rate = INTENSITY_RATE[intensity];
  let out = '';
  for (const ch of text) {
    const lookalikes = HOMOGLYPHS[ch];
    if (lookalikes !== undefined && lookalikes.length > 0 && randomFloat() < rate) {
      out += lookalikes[randomInt(lookalikes.length)] ?? ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Obfuscate text by inserting random zero-width characters between visible
 * characters. The number of zero-width characters per gap is controlled by
 * `intensity`. No zero-width characters are inserted at the very start or end.
 */
export function obfuscateZeroWidth(text: string, intensity: Intensity): string {
  const count = INTENSITY_ZW_COUNT[intensity];
  if (text.length === 0) return '';
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += text[i];
    // Insert zero-width chars after every character except the last.
    if (i < text.length - 1) {
      for (let z = 0; z < count; z++) {
        out += ZERO_WIDTH_CHARS[randomInt(ZERO_WIDTH_CHARS.length)];
      }
    }
  }
  return out;
}

/**
 * Obfuscate text using the configured method and intensity.
 *
 * - `homoglyph`   — substitute ASCII chars with Unicode lookalikes.
 * - `zero-width`  — insert zero-width characters between visible chars.
 * - `mixed`       — apply homoglyph substitution first, then zero-width
 *                   insertion.
 */
export function obfuscate(text: string, options: ObfuscatorOptions): string {
  const { method, intensity } = options;
  if (method === 'homoglyph') return obfuscateHomoglyph(text, intensity);
  if (method === 'zero-width') return obfuscateZeroWidth(text, intensity);
  // mixed
  return obfuscateZeroWidth(obfuscateHomoglyph(text, intensity), intensity);
}

/**
 * Deobfuscate text by stripping all zero-width characters and reversing
 * homoglyph substitution back to ASCII. This is method-agnostic: it removes
 * any zero-width characters present and maps any known lookalikes back to
 * their ASCII source. Characters that are neither zero-width nor known
 * lookalikes pass through unchanged.
 */
export function deobfuscate(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ZERO_WIDTH_SET.has(ch)) continue;
    out += REVERSE_HOMOGLYPHS[ch] ?? ch;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseStringObfuscatorReturn {
  input: Ref<string>;
  output: Ref<string>;
  mode: Ref<ObfuscatorMode>;
  method: Ref<ObfuscationMethod>;
  intensity: Ref<Intensity>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  swap: () => void;
  reset: () => void;
}

export function useStringObfuscator(): UseStringObfuscatorReturn {
  const input = ref<string>('');
  const output = ref<string>('');
  const mode = ref<ObfuscatorMode>('obfuscate');
  const method = ref<ObfuscationMethod>('homoglyph');
  const intensity = ref<Intensity>('medium');

  function recompute(): void {
    if (input.value.length === 0) {
      output.value = '';
      return;
    }
    if (mode.value === 'deobfuscate') {
      output.value = deobfuscate(input.value);
    } else {
      output.value = obfuscate(input.value, {
        method: method.value,
        intensity: intensity.value,
      });
    }
  }

  function swap(): void {
    input.value = output.value;
    recompute();
  }

  function reset(): void {
    input.value = '';
    output.value = '';
    mode.value = 'obfuscate';
    method.value = 'homoglyph';
    intensity.value = 'medium';
  }

  // Recompute whenever any input or option changes.
  watch([input, mode, method, intensity], recompute);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') input.value = p.text;
      else if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
      else if (typeof p.content === 'string') input.value = p.content;
      if (typeof p.mode === 'string') {
        if (p.mode === 'obfuscate' || p.mode === 'deobfuscate') mode.value = p.mode;
      }
      if (typeof p.method === 'string') {
        if (p.method === 'homoglyph' || p.method === 'zero-width' || p.method === 'mixed') {
          method.value = p.method;
        }
      }
      if (typeof p.intensity === 'string') {
        if (p.intensity === 'low' || p.intensity === 'medium' || p.intensity === 'high') {
          intensity.value = p.intensity;
        }
      }
      const action = typeof p.action === 'string' ? p.action : null;
      if (action === 'reset' || action === 'clear') reset();
      else if (action === 'swap') swap();
    },
  });

  watch(output, () => {
    if (!isEmbed.value) return;
    sendOutput({
      output: output.value,
      mode: mode.value,
      method: method.value,
      intensity: intensity.value,
    });
  });

  return {
    input,
    output,
    mode,
    method,
    intensity,
    isEmbed,
    embedInput,
    swap,
    reset,
  };
}
