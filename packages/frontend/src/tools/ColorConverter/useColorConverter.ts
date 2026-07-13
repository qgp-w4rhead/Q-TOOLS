/**
 * useColorConverter — composable + pure logic for the Color converter tool.
 *
 * Bidirectional conversion between HEX, RGB, HSL, HSV, and CMYK color
 * spaces. A single text input is auto-detected (or parsed against a
 * user-selected format) into an internal RGB triple, then every supported
 * format is rendered simultaneously with a live preview swatch.
 *
 * All color math is implemented by hand — no external dependencies. The
 * conversions follow the standard formulas:
 *
 *   - RGB ↔ HEX:        per-channel 0-255 → 2-digit hex.
 *   - RGB ↔ HSL:        standard hue/saturation/lightness transform.
 *   - RGB ↔ HSV:        standard hue/saturation/value transform.
 *   - RGB ↔ CMYK:       subtractive model via K = 1 - max(r,g,b).
 *
 * Pure helpers (`parseColor`, `rgbToHex`, `hexToRgb`, `rgbToHsl`,
 * `hslToRgb`, `rgbToHsv`, `hsvToRgb`, `rgbToCmyk`, `cmykToRgb`,
 * `formatHex`, `formatRgb`, `formatHsl`, `formatHsv`, `formatCmyk`,
 * `computeAllFormats`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useColorConverter()`
 * composable wraps them in reactive state and wires up the embed
 * PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Internal RGB triple (0-255 integers). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** HSL triple (h: 0-360 degrees, s/l: 0-100 percent). */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** HSV triple (h: 0-360 degrees, s/v: 0-100 percent). */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** CMYK triple (c/m/y/k: 0-100 percent). */
export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

/** Supported input/output formats. */
export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsv' | 'cmyk';

/** All format strings for a single color. */
export interface ColorOutputs {
  hex: string;
  rgb: string;
  hsl: string;
  hsv: string;
  cmyk: string;
  /** Raw RGB triple used internally (for the swatch + native picker). */
  rgbTriple: Rgb;
}

/** Parse mode: `'auto'` detects the format, otherwise force the format. */
export type ParseMode = 'auto' | ColorFormat;

const DEG = 360;
const PCT = 100;

/** Clamp a number to [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/** Round to `dp` decimal places. */
function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/* --------------------------------- RGB ↔ HEX ------------------------------- */

/** Convert an RGB triple (0-255) to a 6-digit hex string (`#rrggbb`). */
export function rgbToHex(rgb: Rgb): string {
  const toHex = (n: number) =>
    clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Parse a hex color string into an RGB triple.
 *
 * Accepts `#rgb`, `#rrggbb`, `#rrggbbaa` (alpha ignored), with or without
 * the leading `#`. Returns `null` when the input is not a valid hex color.
 */
export function hexToRgb(input: string): Rgb | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 0) return null;
  // Expand 3-digit shorthand (#rgb → #rrggbb).
  if (s.length === 3) {
    s = s[0]! + s[0]! + s[1]! + s[1]! + s[2]! + s[2]!;
  } else if (s.length === 4) {
    // #rgba shorthand — drop alpha.
    s = s[0]! + s[0]! + s[1]! + s[1]! + s[2]! + s[2]!;
  } else if (s.length === 8) {
    // #rrggbbaa — drop alpha.
    s = s.slice(0, 6);
  }
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/* --------------------------------- RGB ↔ HSL ------------------------------- */

/** Convert RGB (0-255) to HSL (h: 0-360, s/l: 0-100). */
export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h: round(h, 2), s: round(s * PCT, 2), l: round(l * PCT, 2) };
}

/** Convert HSL (h: 0-360, s/l: 0-100) to RGB (0-255). */
export function hslToRgb(hsl: Hsl): Rgb {
  const h = ((hsl.h % DEG) + DEG) % DEG / DEG;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/* --------------------------------- RGB ↔ HSV ------------------------------- */

/** Convert RGB (0-255) to HSV (h: 0-360, s/v: 0-100). */
export function rgbToHsv(rgb: Rgb): Hsv {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h: round(h, 2), s: round(s * PCT, 2), v: round(v * PCT, 2) };
}

/** Convert HSV (h: 0-360, s/v: 0-100) to RGB (0-255). */
export function hsvToRgb(hsv: Hsv): Rgb {
  const h = ((hsv.h % DEG) + DEG) % DEG / 60;
  const s = clamp(hsv.s, 0, 100) / 100;
  const v = clamp(hsv.v, 0, 100) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  const hi = Math.floor(h) % 6;
  if (hi === 0) { r = c; g = x; }
  else if (hi === 1) { r = x; g = c; }
  else if (hi === 2) { g = c; b = x; }
  else if (hi === 3) { g = x; b = c; }
  else if (hi === 4) { r = x; b = c; }
  else { r = c; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/* --------------------------------- RGB ↔ CMYK ------------------------------ */

/** Convert RGB (0-255) to CMYK (c/m/y/k: 0-100). */
export function rgbToCmyk(rgb: Rgb): Cmyk {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) {
    // Pure black — CMY are all 0.
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return {
    c: round(c * PCT, 2),
    m: round(m * PCT, 2),
    y: round(y * PCT, 2),
    k: round(k * PCT, 2),
  };
}

/** Convert CMYK (c/m/y/k: 0-100) to RGB (0-255). */
export function cmykToRgb(cmyk: Cmyk): Rgb {
  const c = clamp(cmyk.c, 0, 100) / 100;
  const m = clamp(cmyk.m, 0, 100) / 100;
  const y = clamp(cmyk.y, 0, 100) / 100;
  const k = clamp(cmyk.k, 0, 100) / 100;
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  };
}

/* ------------------------------- formatters -------------------------------- */

/** Format an RGB triple as `rgb(r, g, b)`. */
export function formatRgb(rgb: Rgb): string {
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}

/** Format an HSL triple as `hsl(h, s%, l%)`. */
export function formatHsl(hsl: Hsl): string {
  return `hsl(${round(hsl.h, 2)}, ${round(hsl.s, 2)}%, ${round(hsl.l, 2)}%)`;
}

/** Format an HSV triple as `hsv(h, s%, v%)`. */
export function formatHsv(hsv: Hsv): string {
  return `hsv(${round(hsv.h, 2)}, ${round(hsv.s, 2)}%, ${round(hsv.v, 2)}%)`;
}

/** Format a CMYK triple as `cmyk(c%, m%, y%, k%)`. */
export function formatCmyk(cmyk: Cmyk): string {
  return `cmyk(${round(cmyk.c, 2)}%, ${round(cmyk.m, 2)}%, ${round(cmyk.y, 2)}%, ${round(cmyk.k, 2)}%)`;
}

/** Compute all format strings for a given RGB triple. */
export function computeAllFormats(rgb: Rgb): ColorOutputs {
  return {
    hex: rgbToHex(rgb),
    rgb: formatRgb(rgb),
    hsl: formatHsl(rgbToHsl(rgb)),
    hsv: formatHsv(rgbToHsv(rgb)),
    cmyk: formatCmyk(rgbToCmyk(rgb)),
    rgbTriple: { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) },
  };
}

/* --------------------------------- parsing --------------------------------- */

/**
 * Parse a percentage-or-absolute channel value.
 *
 * Accepts `0-255` (or `0-1` when `max === 1`), and `0%-100%`. Returns the
 * value scaled to 0-255, or `null` when out of range / unparseable.
 */
function parseChannel(token: string, max: number): number | null {
  const t = token.trim();
  if (t.length === 0) return null;
  const isPct = t.endsWith('%');
  const numStr = isPct ? t.slice(0, -1) : t;
  const n = Number(numStr);
  if (!Number.isFinite(n)) return null;
  if (isPct) {
    if (n < 0 || n > 100) return null;
    return (n / 100) * 255;
  }
  if (n < 0 || n > max) return null;
  // Normalise 0-1 floats to 0-255 when max === 1 and the value is a fraction.
  return max === 1 ? n * 255 : n;
}

/** Parse an angle in degrees (0-360, wraps). Returns null if unparseable. */
function parseAngle(token: string): number | null {
  const t = token.trim();
  if (t.length === 0) return null;
  const numStr = t.endsWith('deg') ? t.slice(0, -3) : t;
  const n = Number(numStr.trim());
  if (!Number.isFinite(n)) return null;
  return ((n % DEG) + DEG) % DEG;
}

/** Parse a percentage (0-100). Returns null if unparseable or out of range. */
function parsePercent(token: string): number | null {
  const t = token.trim();
  if (t.length === 0) return null;
  const numStr = t.endsWith('%') ? t.slice(0, -1) : t;
  const n = Number(numStr.trim());
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return n;
}

/** Split a `fn(a, b, c)` or `a, b, c` / `a b c` argument list into tokens. */
function splitArgs(input: string): string[] {
  let s = input.trim();
  // Strip a leading `fn(` and trailing `)`.
  const fnMatch = s.match(/^([a-zA-Z]+)\s*\((.*)\)\s*$/);
  if (fnMatch) {
    s = fnMatch[2] ?? '';
  } else if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1);
  }
  // Split on commas or whitespace.
  return s.split(/[,\s]+/).filter((t) => t.length > 0);
}

/** Parse an RGB string (`rgb(r,g,b)` / `r,g,b` / `r g b`). */
function parseRgbString(input: string): Rgb | null {
  const tokens = splitArgs(input);
  if (tokens.length < 3) return null;
  // Detect 0-1 float mode when all three channels are <= 1 and at least one
  // is a fraction (e.g. `0.5, 0.2, 0.9`). Percentages bypass this.
  const hasPct = tokens.slice(0, 3).some((t) => t.endsWith('%'));
  const max = hasPct ? 255 : 1;
  let r = parseChannel(tokens[0]!, 255);
  let g = parseChannel(tokens[1]!, 255);
  let b = parseChannel(tokens[2]!, 255);
  // If none are percentages and all <= 1, treat as 0-1 floats.
  if (!hasPct && r !== null && g !== null && b !== null) {
    const allSmall = [tokens[0]!, tokens[1]!, tokens[2]!].every(
      (t) => Number(t) <= 1,
    );
    if (allSmall) {
      r = parseChannel(tokens[0]!, max);
      g = parseChannel(tokens[1]!, max);
      b = parseChannel(tokens[2]!, max);
    }
  }
  if (r === null || g === null || b === null) return null;
  return { r, g, b };
}

/** Parse an HSL string (`hsl(h, s%, l%)` / `h, s%, l%`). */
function parseHslString(input: string): Rgb | null {
  const tokens = splitArgs(input);
  if (tokens.length < 3) return null;
  const h = parseAngle(tokens[0]!);
  const s = parsePercent(tokens[1]!);
  const l = parsePercent(tokens[2]!);
  if (h === null || s === null || l === null) return null;
  return hslToRgb({ h, s, l });
}

/** Parse an HSV string (`hsv(h, s%, v%)` / `h, s%, v%`). */
function parseHsvString(input: string): Rgb | null {
  const tokens = splitArgs(input);
  if (tokens.length < 3) return null;
  const h = parseAngle(tokens[0]!);
  const s = parsePercent(tokens[1]!);
  const v = parsePercent(tokens[2]!);
  if (h === null || s === null || v === null) return null;
  return hsvToRgb({ h, s, v });
}

/** Parse a CMYK string (`cmyk(c%, m%, y%, k%)` / `c%, m%, y%, k%`). */
function parseCmykString(input: string): Rgb | null {
  const tokens = splitArgs(input);
  if (tokens.length < 4) return null;
  const c = parsePercent(tokens[0]!);
  const m = parsePercent(tokens[1]!);
  const y = parsePercent(tokens[2]!);
  const k = parsePercent(tokens[3]!);
  if (c === null || m === null || y === null || k === null) return null;
  return cmykToRgb({ c, m, y, k });
}

/**
 * Parse a color string into an RGB triple.
 *
 * When `mode` is `'auto'` (default), the format is auto-detected from the
 * input shape. Otherwise the input is parsed against the chosen format.
 * Returns `null` when the input cannot be parsed.
 */
export function parseColor(input: string, mode: ParseMode = 'auto'): Rgb | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (s.length === 0) return null;

  if (mode !== 'auto') {
    switch (mode) {
      case 'hex':
        return hexToRgb(s);
      case 'rgb':
        return parseRgbString(s);
      case 'hsl':
        return parseHslString(s);
      case 'hsv':
        return parseHsvString(s);
      case 'cmyk':
        return parseCmykString(s);
    }
  }

  // Auto-detect.
  // HEX: leading `#` or pure hex digits of length 3/4/6/8.
  if (/^#?[0-9a-fA-F]{3,8}$/.test(s)) {
    const rgb = hexToRgb(s);
    if (rgb) return rgb;
  }
  // Function form: `rgb(...)`, `hsl(...)`, `hsv(...)`, `cmyk(...)`.
  const fnMatch = s.match(/^([a-zA-Z]+)\s*\(/);
  if (fnMatch) {
    const fn = (fnMatch[1] ?? '').toLowerCase();
    if (fn === 'rgb' || fn === 'rgba') return parseRgbString(s);
    if (fn === 'hsl' || fn === 'hsla') return parseHslString(s);
    if (fn === 'hsv' || fn === 'hsb') return parseHsvString(s);
    if (fn === 'cmyk') return parseCmykString(s);
    return null;
  }
  // Bare argument lists — try each parser in turn. CMYK needs 4 tokens,
  // HSL/HSV/RGB need 3, so order by specificity.
  const tokens = splitArgs(s);
  if (tokens.length >= 4) {
    const cmyk = parseCmykString(s);
    if (cmyk) return cmyk;
  }
  if (tokens.length >= 3) {
    // If any of the last two tokens is a percentage, prefer HSL/HSV.
    const hasPct = tokens.slice(1, 3).some((t) => t.endsWith('%'));
    if (hasPct) {
      const hsl = parseHslString(s);
      if (hsl) return hsl;
      const hsv = parseHsvString(s);
      if (hsv) return hsv;
    }
    const rgb = parseRgbString(s);
    if (rgb) return rgb;
    const hsl = parseHslString(s);
    if (hsl) return hsl;
    const hsv = parseHsvString(s);
    if (hsv) return hsv;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseColorConverterReturn {
  input: Ref<string>;
  mode: Ref<ParseMode>;
  outputs: Ref<ColorOutputs | null>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: ParseMode) => void;
  /** Update the input from the native color picker (`#rrggbb`). */
  setFromHex: (hex: string) => void;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export function useColorConverter(): UseColorConverterReturn {
  const input = ref<string>('#58a6ff');
  const mode = ref<ParseMode>('auto');
  const outputs = ref<ColorOutputs | null>(null);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = '';
      return;
    }
    const rgb = parseColor(text, mode.value);
    if (rgb === null) {
      outputs.value = null;
      error.value =
        mode.value === 'auto'
          ? 'Unrecognised color format. Try HEX (#rrggbb), RGB, HSL, HSV, or CMYK.'
          : `Invalid ${mode.value.toUpperCase()} color.`;
      return;
    }
    outputs.value = computeAllFormats(rgb);
    error.value = '';
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

  function setMode(m: ParseMode): void {
    mode.value = m;
  }

  /** Set the input from a `#rrggbb` hex (from the native color picker). */
  function setFromHex(hex: string): void {
    input.value = hex;
    mode.value = 'auto';
  }

  watch(input, scheduleRun);
  watch(mode, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string') {
        const m = p.mode as ParseMode;
        if (
          m === 'auto' || m === 'hex' || m === 'rgb' ||
          m === 'hsl' || m === 'hsv' || m === 'cmyk'
        ) {
          mode.value = m;
        }
      }
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
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
    setMode,
    setFromHex,
  };
}
