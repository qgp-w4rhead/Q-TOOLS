/**
 * useBidiTextChecker - composable + pure logic for bidirectional text analysis.
 *
 * Detects and visualizes RTL/LTR directionality and BiDi control characters
 * in text.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Direction = 'LTR' | 'RTL' | 'Neutral';

export interface CharDirectionInfo {
  char: string;
  codePoint: number;
  hex: string;
  direction: Direction;
  isControl: boolean;
  controlName?: string;
  isMirrored: boolean;
}

export interface BidiAnalysisResult {
  chars: CharDirectionInfo[];
  overallDirection: Direction;
  hasBiDiControls: boolean;
  controlCount: number;
  rtlCount: number;
  ltrCount: number;
  neutralCount: number;
  visualized: string;
}

export interface UseBidiTextCheckerReturn {
  input: Ref<string>;
  result: Ref<BidiAnalysisResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                 */
/* -------------------------------------------------------------------------- */

/** BiDi control characters. */
const BIDI_CONTROLS: Record<number, string> = {
  0x200e: 'LRM (Left-to-Right Mark)',
  0x200f: 'RLM (Right-to-Left Mark)',
  0x200b: 'ZWSP (Zero Width Space)',
  0x200c: 'ZWNJ (Zero Width Non-Joiner)',
  0x200d: 'ZWJ (Zero Width Joiner)',
  0x202a: 'LRE (Left-to-Right Embedding)',
  0x202b: 'RLE (Right-to-Left Embedding)',
  0x202c: 'PDF (Pop Directional Formatting)',
  0x202d: 'LRO (Left-to-Right Override)',
  0x202e: 'RLO (Right-to-Left Override)',
  0x2066: 'LRI (Left-to-Right Isolate)',
  0x2067: 'RLI (Right-to-Left Isolate)',
  0x2068: 'FSI (First Strong Isolate)',
  0x2069: 'PDI (Pop Directional Isolate)',
  0x061c: 'ALM (Arabic Letter Mark)',
};

/** RTL script ranges. */
const RTL_RANGES: { start: number; end: number }[] = [
  { start: 0x0590, end: 0x05ff }, // Hebrew
  { start: 0x0600, end: 0x06ff }, // Arabic
  { start: 0x0700, end: 0x074f }, // Syriac
  { start: 0x0750, end: 0x077f }, // Arabic Supplement
  { start: 0x0780, end: 0x07bf }, // Thaana
  { start: 0x07c0, end: 0x07ff }, // NKo
  { start: 0x0800, end: 0x083f }, // Samaritan
  { start: 0x0840, end: 0x085f }, // Mandaic
  { start: 0x08a0, end: 0x08ff }, // Arabic Extended-A
  { start: 0xfb1d, end: 0xfb4f }, // Hebrew presentation forms
  { start: 0xfb50, end: 0xfdff }, // Arabic presentation forms-A
  { start: 0xfe70, end: 0xfeff }, // Arabic presentation forms-B
  { start: 0x10800, end: 0x10fff }, // Various RTL scripts
];

/** LTR script ranges (Latin, Cyrillic, Greek, CJK, etc.). */
const LTR_RANGES: { start: number; end: number }[] = [
  { start: 0x0000, end: 0x058f }, // Basic Latin, Latin-1, extensions, Greek, Cyrillic, Armenian
  { start: 0x1e00, end: 0x1eff }, // Latin Extended Additional
  { start: 0x2000, end: 0x200d }, // General punctuation (excluding BiDi marks)
  { start: 0x2100, end: 0x27bf }, // Letterlike symbols, arrows, math, dingbats
  { start: 0x3000, end: 0x9fff }, // CJK
  { start: 0xac00, end: 0xd7af }, // Hangul
  { start: 0xff00, end: 0xffef }, // Halfwidth/Fullwidth
  { start: 0x1f300, end: 0x1f9ff }, // Emoji/symbols
];

/** Determine the direction of a single code point. */
export function getCharDirection(cp: number): Direction {
  if (BIDI_CONTROLS[cp]) return 'Neutral';

  for (const r of RTL_RANGES) {
    if (cp >= r.start && cp <= r.end) return 'RTL';
  }

  for (const r of LTR_RANGES) {
    if (cp >= r.start && cp <= r.end) return 'LTR';
  }

  // Numbers are LTR
  if (cp >= 0x0030 && cp <= 0x0039) return 'LTR';

  return 'Neutral';
}

/** Check if a code point is a BiDi control character. */
export function isBidiControl(cp: number): boolean {
  return cp in BIDI_CONTROLS;
}

/** Check if a character is mirrored (e.g., parentheses in RTL context). */
export function isMirroredChar(cp: number): boolean {
  const mirrored = new Set([
    0x0028, 0x0029, 0x003c, 0x003e, 0x005b, 0x005d, 0x007b, 0x007d,
    0x00ab, 0x00bb, 0x2039, 0x203a, 0x2045, 0x2046, 0x207d, 0x207e,
    0x208d, 0x208e, 0x2329, 0x232a, 0x27e8, 0x27e9, 0x27ea, 0x27eb,
    0x27ec, 0x27ed, 0x27ee, 0x27ef, 0x2983, 0x2984, 0x2985, 0x2986,
  0x2987, 0x2988, 0x2989, 0x298a, 0x298b, 0x298c, 0x298d, 0x298e,
    0x298f, 0x2990, 0x2991, 0x2992, 0x2993, 0x2994, 0x2995, 0x2996,
    0x2997, 0x2998, 0x29d8, 0x29d9, 0x29da, 0x29db, 0x29fc, 0x29fd,
    0x2e22, 0x2e23, 0x2e24, 0x2e25, 0x2e26, 0x2e27, 0x2e28, 0x2e29,
    0x3008, 0x3009, 0x300a, 0x300b, 0x300c, 0x300d, 0x300e, 0x300f,
    0x3010, 0x3011, 0x3014, 0x3015, 0x3016, 0x3017, 0x3018, 0x3019,
    0x301a, 0x301b, 0xfe59, 0xfe5a, 0xfe5b, 0xfe5c, 0xfe5d, 0xfe5e,
    0xfe64, 0xfe65, 0xff08, 0xff09, 0xff1c, 0xff1e, 0xff3b, 0xff3d,
    0xff5b, 0xff5d, 0xff5f, 0xff60, 0xff62, 0xff63,
  ]);
  return mirrored.has(cp);
}

/** Analyze text for BiDi properties. */
export function analyzeBidi(input: string): BidiAnalysisResult {
  const chars: CharDirectionInfo[] = [];
  let rtlCount = 0;
  let ltrCount = 0;
  let neutralCount = 0;
  let controlCount = 0;
  const visualParts: string[] = [];

  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    const direction = getCharDirection(cp);
    const control = isBidiControl(cp);
    const controlName = BIDI_CONTROLS[cp];
    const mirrored = isMirroredChar(cp);

    chars.push({
      char: ch,
      codePoint: cp,
      hex: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      direction,
      isControl: control,
      controlName,
      isMirrored: mirrored,
    });

    if (control) {
      controlCount++;
    } else if (direction === 'RTL') {
      rtlCount++;
      visualParts.push(`⟦${ch}⟧`);
    } else if (direction === 'LTR') {
      ltrCount++;
      visualParts.push(ch);
    } else {
      neutralCount++;
      visualParts.push(ch);
    }
  }

  let overallDirection: Direction = 'Neutral';
  if (rtlCount > ltrCount) overallDirection = 'RTL';
  else if (ltrCount > 0) overallDirection = 'LTR';

  return {
    chars,
    overallDirection,
    hasBiDiControls: controlCount > 0,
    controlCount,
    rtlCount,
    ltrCount,
    neutralCount,
    visualized: visualParts.join(''),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useBidiTextChecker(): UseBidiTextCheckerReturn {
  const input = ref<string>('Hello مرحبا World עולם');
  const result = ref<BidiAnalysisResult | null>(null);

  function recompute(): void {
    result.value = analyzeBidi(input.value);
  }

  function reset(): void {
    input.value = 'Hello مرحبا World עולם';
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
    output: result,
    toOutput: () => {
      const r = result.value;
      if (!r) return {};
      return {
        overallDirection: r.overallDirection,
        hasBiDiControls: r.hasBiDiControls,
        controlCount: r.controlCount,
        rtlCount: r.rtlCount,
        ltrCount: r.ltrCount,
        neutralCount: r.neutralCount,
      };
    },
  });

  return {
    input,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
