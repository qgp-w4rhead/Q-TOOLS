/**
 * useUnicodePropertyExplorer - composable + pure logic for Unicode inspection.
 *
 * Inspect code points, categories, scripts, blocks, and normalization forms.
 *
 * No external dependencies - uses String.prototype.normalize and
 * String.prototype.codePointAt.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface CodePointInfo {
  codePoint: number;
  hex: string;
  char: string;
  name: string;
  category: string;
  block: string;
  script: string;
  isControl: boolean;
  isWhitespace: boolean;
  isLetter: boolean;
  isDigit: boolean;
  isPunctuation: boolean;
  isSymbol: boolean;
  nfc: string;
  nfd: string;
  nfkd: string;
}

export interface UseUnicodePropertyExplorerReturn {
  input: Ref<string>;
  codePoints: Ref<CodePointInfo[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

/** Unicode general category names. */
const CATEGORY_NAMES: Record<string, string> = {
  Lu: 'Uppercase Letter', Ll: 'Lowercase Letter', Lt: 'Titlecase Letter',
  Lm: 'Modifier Letter', Lo: 'Other Letter',
  Mn: 'Nonspacing Mark', Mc: 'Spacing Mark', Me: 'Enclosing Mark',
  Nd: 'Decimal Number', Nl: 'Letter Number', No: 'Other Number',
  Pc: 'Connector Punctuation', Pd: 'Dash Punctuation', Ps: 'Open Punctuation',
  Pe: 'Close Punctuation', Pi: 'Initial Punctuation', Pf: 'Final Punctuation',
  Po: 'Other Punctuation',
  Sm: 'Math Symbol', Sc: 'Currency Symbol', Sk: 'Modifier Symbol', So: 'Other Symbol',
  Zs: 'Space Separator', Zl: 'Line Separator', Zp: 'Paragraph Separator',
  Cc: 'Control', Cf: 'Format', Cs: 'Surrogate', Co: 'Private Use', Cn: 'Unassigned',
};

/** Unicode block ranges (subset of common blocks). */
const BLOCKS: { start: number; end: number; name: string }[] = [
  { start: 0x0000, end: 0x007f, name: 'Basic Latin' },
  { start: 0x0080, end: 0x00ff, name: 'Latin-1 Supplement' },
  { start: 0x0100, end: 0x017f, name: 'Latin Extended-A' },
  { start: 0x0180, end: 0x024f, name: 'Latin Extended-B' },
  { start: 0x0250, end: 0x02af, name: 'IPA Extensions' },
  { start: 0x02b0, end: 0x02ff, name: 'Spacing Modifier Letters' },
  { start: 0x0300, end: 0x036f, name: 'Combining Diacritical Marks' },
  { start: 0x0370, end: 0x03ff, name: 'Greek and Coptic' },
  { start: 0x0400, end: 0x04ff, name: 'Cyrillic' },
  { start: 0x0530, end: 0x058f, name: 'Armenian' },
  { start: 0x0590, end: 0x05ff, name: 'Hebrew' },
  { start: 0x0600, end: 0x06ff, name: 'Arabic' },
  { start: 0x0700, end: 0x074f, name: 'Syriac' },
  { start: 0x0750, end: 0x077f, name: 'Arabic Supplement' },
  { start: 0x0780, end: 0x07bf, name: 'Thaana' },
  { start: 0x0900, end: 0x097f, name: 'Devanagari' },
  { start: 0x0980, end: 0x09ff, name: 'Bengali' },
  { start: 0x0a00, end: 0x0a7f, name: 'Gurmukhi' },
  { start: 0x0a80, end: 0x0aff, name: 'Gujarati' },
  { start: 0x0b00, end: 0x0b7f, name: 'Oriya' },
  { start: 0x0b80, end: 0x0bff, name: 'Tamil' },
  { start: 0x0c00, end: 0x0c7f, name: 'Telugu' },
  { start: 0x0c80, end: 0x0cff, name: 'Kannada' },
  { start: 0x0d00, end: 0x0d7f, name: 'Malayalam' },
  { start: 0x0d80, end: 0x0dff, name: 'Sinhala' },
  { start: 0x0e00, end: 0x0e7f, name: 'Thai' },
  { start: 0x0e80, end: 0x0eff, name: 'Lao' },
  { start: 0x0f00, end: 0x0fff, name: 'Tibetan' },
  { start: 0x1000, end: 0x109f, name: 'Myanmar' },
  { start: 0x10a0, end: 0x10ff, name: 'Georgian' },
  { start: 0x1100, end: 0x11ff, name: 'Hangul Jamo' },
  { start: 0x1200, end: 0x137f, name: 'Ethiopic' },
  { start: 0x13a0, end: 0x13ff, name: 'Cherokee' },
  { start: 0x1400, end: 0x167f, name: 'Unified Canadian Aboriginal Syllabics' },
  { start: 0x2000, end: 0x206f, name: 'General Punctuation' },
  { start: 0x2070, end: 0x209f, name: 'Superscripts and Subscripts' },
  { start: 0x20a0, end: 0x20cf, name: 'Currency Symbols' },
  { start: 0x20d0, end: 0x20ff, name: 'Combining Diacritical Marks for Symbols' },
  { start: 0x2100, end: 0x214f, name: 'Letterlike Symbols' },
  { start: 0x2150, end: 0x218f, name: 'Number Forms' },
  { start: 0x2190, end: 0x21ff, name: 'Arrows' },
  { start: 0x2200, end: 0x22ff, name: 'Mathematical Operators' },
  { start: 0x2300, end: 0x23ff, name: 'Miscellaneous Technical' },
  { start: 0x2400, end: 0x243f, name: 'Control Pictures' },
  { start: 0x2500, end: 0x257f, name: 'Box Drawing' },
  { start: 0x2580, end: 0x259f, name: 'Block Elements' },
  { start: 0x25a0, end: 0x25ff, name: 'Geometric Shapes' },
  { start: 0x2600, end: 0x26ff, name: 'Miscellaneous Symbols' },
  { start: 0x2700, end: 0x27bf, name: 'Dingbats' },
  { start: 0x3000, end: 0x303f, name: 'CJK Symbols and Punctuation' },
  { start: 0x3040, end: 0x309f, name: 'Hiragana' },
  { start: 0x30a0, end: 0x30ff, name: 'Katakana' },
  { start: 0x3100, end: 0x312f, name: 'Bopomofo' },
  { start: 0x3130, end: 0x318f, name: 'Hangul Compatibility Jamo' },
  { start: 0x4e00, end: 0x9fff, name: 'CJK Unified Ideographs' },
  { start: 0xac00, end: 0xd7af, name: 'Hangul Syllables' },
  { start: 0xe000, end: 0xf8ff, name: 'Private Use Area' },
  { start: 0xf900, end: 0xfaff, name: 'CJK Compatibility Ideographs' },
  { start: 0xfb00, end: 0xfb4f, name: 'Alphabetic Presentation Forms' },
  { start: 0xfb50, end: 0xfdff, name: 'Arabic Presentation Forms-A' },
  { start: 0xfe00, end: 0xfe0f, name: 'Variation Selectors' },
  { start: 0xfe20, end: 0xfe2f, name: 'Combining Half Marks' },
  { start: 0xfe30, end: 0xfe4f, name: 'CJK Compatibility Forms' },
  { start: 0xfe50, end: 0xfe6f, name: 'Small Form Variants' },
  { start: 0xfe70, end: 0xfeff, name: 'Arabic Presentation Forms-B' },
  { start: 0xff00, end: 0xffef, name: 'Halfwidth and Fullwidth Forms' },
  { start: 0xfff0, end: 0xffff, name: 'Specials' },
  { start: 0x1f600, end: 0x1f64f, name: 'Emoticons' },
  { start: 0x1f300, end: 0x1f5ff, name: 'Miscellaneous Symbols and Pictographs' },
  { start: 0x1f680, end: 0x1f6ff, name: 'Transport and Map Symbols' },
  { start: 0x1f900, end: 0x1f9ff, name: 'Supplemental Symbols and Pictographs' },
];

/** Script ranges (subset). */
const SCRIPTS: { start: number; end: number; name: string }[] = [
  { start: 0x0000, end: 0x007f, name: 'Latin' },
  { start: 0x0080, end: 0x00ff, name: 'Latin' },
  { start: 0x0100, end: 0x024f, name: 'Latin' },
  { start: 0x0250, end: 0x02af, name: 'Latin' },
  { start: 0x0370, end: 0x03ff, name: 'Greek' },
  { start: 0x0400, end: 0x04ff, name: 'Cyrillic' },
  { start: 0x0530, end: 0x058f, name: 'Armenian' },
  { start: 0x0590, end: 0x05ff, name: 'Hebrew' },
  { start: 0x0600, end: 0x06ff, name: 'Arabic' },
  { start: 0x0900, end: 0x097f, name: 'Devanagari' },
  { start: 0x0980, end: 0x09ff, name: 'Bengali' },
  { start: 0x0e00, end: 0x0e7f, name: 'Thai' },
  { start: 0x3040, end: 0x309f, name: 'Hiragana' },
  { start: 0x30a0, end: 0x30ff, name: 'Katakana' },
  { start: 0x4e00, end: 0x9fff, name: 'Han' },
  { start: 0xac00, end: 0xd7af, name: 'Hangul' },
];

/** Get the Unicode block name for a code point. */
export function getBlockName(cp: number): string {
  for (const b of BLOCKS) {
    if (cp >= b.start && cp <= b.end) return b.name;
  }
  return 'Unknown';
}

/** Get the script name for a code point. */
export function getScriptName(cp: number): string {
  for (const s of SCRIPTS) {
    if (cp >= s.start && cp <= s.end) return s.name;
  }
  return 'Common';
}

/** Determine the general category of a code point. */
export function getCategory(cp: number): string {
  const ch = String.fromCodePoint(cp);
  if (cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f)) return 'Cc';
  if (/\s/.test(ch)) {
    if (ch === ' ' || ch === '\u00a0' || ch === '\u2000') return 'Zs';
    if (ch === '\n' || ch === '\r' || ch === '\t') return 'Cc';
    return 'Zs';
  }
  if (/[a-z]/.test(ch)) return 'Ll';
  if (/[A-Z]/.test(ch)) return 'Lu';
  if (/[0-9]/.test(ch)) return 'Nd';
  if (/[¡¿]/.test(ch)) return 'Pi';
  if (/[\p{P}]/u.test(ch)) return 'Po';
  if (/[\p{S}]/u.test(ch)) return 'So';
  if (/[\p{M}]/u.test(ch)) return 'Mn';
  return 'Cn';
}

/** Get a human-readable name for a code point (common subset). */
export function getCodePointName(cp: number): string {
  const names: Record<number, string> = {
    0: 'NULL', 9: 'CHARACTER TABULATION', 10: 'LINE FEED', 13: 'CARRIAGE RETURN',
    32: 'SPACE', 33: 'EXCLAMATION MARK', 34: 'QUOTATION MARK', 35: 'NUMBER SIGN',
    36: 'DOLLAR SIGN', 37: 'PERCENT SIGN', 38: 'AMPERSAND', 39: 'APOSTROPHE',
    40: 'LEFT PARENTHESIS', 41: 'RIGHT PARENTHESIS', 42: 'ASTERISK',
    43: 'PLUS SIGN', 44: 'COMMA', 45: 'HYPHEN-MINUS', 46: 'FULL STOP',
    47: 'SOLIDUS', 48: 'DIGIT ZERO', 49: 'DIGIT ONE', 50: 'DIGIT TWO',
    58: 'COLON', 59: 'SEMICOLON', 60: 'LESS-THAN SIGN', 61: 'EQUALS SIGN',
    62: 'GREATER-THAN SIGN', 63: 'QUESTION MARK', 64: 'COMMERCIAL AT',
    91: 'LEFT SQUARE BRACKET', 92: 'REVERSE SOLIDUS', 93: 'RIGHT SQUARE BRACKET',
    94: 'CIRCUMFLEX ACCENT', 95: 'LOW LINE', 96: 'GRAVE ACCENT',
    123: 'LEFT CURLY BRACKET', 124: 'VERTICAL LINE', 125: 'RIGHT CURLY BRACKET',
    126: 'TILDE',
    0x20ac: 'EURO SIGN', 0x00a3: 'POUND SIGN', 0x00a5: 'YEN SIGN',
    0x00a9: 'COPYRIGHT SIGN', 0x00ae: 'REGISTERED SIGN', 0x2122: 'TRADE MARK SIGN',
    0x2603: 'SNOWMAN', 0x263a: 'SMILING FACE', 0x2705: 'WHITE HEAVY CHECK MARK',
    0x2714: 'HEAVY CHECK MARK', 0x2716: 'HEAVY MULTIPLICATION X',
    0x2728: 'SPARKLES', 0x274c: 'CROSS MARK',
    0x1f600: 'GRINNING FACE', 0x1f601: 'BEAMING FACE WITH SMILING EYES',
    0x1f602: 'FACE WITH TEARS OF JOY', 0x1f603: 'SMILING FACE WITH OPEN MOUTH',
    0x1f604: 'SMILING FACE WITH OPEN MOUTH AND SMILING EYES',
    0x1f60a: 'SMILING FACE WITH SMILING EYES', 0x1f60d: 'SMILING FACE WITH HEART-EYES',
    0x1f61e: 'DISAPPOINTED FACE', 0x1f622: 'CRYING FACE',
    0x1f625: 'SAD BUT RELIEVED FACE', 0x1f62d: 'LOUDLY CRYING FACE',
    0x1f630: 'ANXIOUS FACE WITH SWEAT', 0x1f648: 'SEE-NO-EVIL MONKEY',
    0x1f649: 'HEAR-NO-EVIL MONKEY', 0x1f64a: 'SPEAK-NO-EVIL MONKEY',
    0x1f44d: 'THUMBS UP SIGN', 0x1f44e: 'THUMBS DOWN SIGN',
    0x1f525: 'FIRE', 0x1f527: 'WRENCH', 0x1f4bb: 'LAPTOP COMPUTER',
    0x1f389: 'PARTY POPPER',
  };
  return names[cp] ?? `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Analyze a single code point and return its properties. */
export function analyzeCodePoint(cp: number): CodePointInfo {
  const ch = String.fromCodePoint(cp);
  const category = getCategory(cp);
  const isControl = category === 'Cc';
  const isWhitespace = /\s/.test(ch);
  const isLetter = category.startsWith('L');
  const isDigit = category === 'Nd';
  const isPunctuation = category.startsWith('P');
  const isSymbol = category.startsWith('S');

  return {
    codePoint: cp,
    hex: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
    char: ch,
    name: getCodePointName(cp),
    category: `${category} (${CATEGORY_NAMES[category] ?? 'Unknown'})`,
    block: getBlockName(cp),
    script: getScriptName(cp),
    isControl,
    isWhitespace,
    isLetter,
    isDigit,
    isPunctuation,
    isSymbol,
    nfc: ch.normalize('NFC'),
    nfd: ch.normalize('NFD'),
    nfkd: ch.normalize('NFKD'),
  };
}

/** Analyze all code points in a string. */
export function analyzeString(input: string): CodePointInfo[] {
  const result: CodePointInfo[] = [];
  for (const ch of input) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) {
      result.push(analyzeCodePoint(cp));
    }
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useUnicodePropertyExplorer(): UseUnicodePropertyExplorerReturn {
  const input = ref<string>('Hello 世界 🌍');
  const codePoints = ref<CodePointInfo[]>([]);

  function recompute(): void {
    codePoints.value = analyzeString(input.value);
  }

  function reset(): void {
    input.value = 'Hello 世界 🌍';
    recompute();
  }

  watch(input, () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
    output: codePoints,
    toOutput: () => ({ codePoints: codePoints.value }),
  });

  return {
    input,
    codePoints,
    isEmbed,
    embedInput,
    reset,
  };
}
