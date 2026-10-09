/**
 * useColorContrastChecker - composable + pure logic for the color contrast checker.
 *
 * Computes WCAG 2.1 contrast ratios between two colors using the standard
 * relative luminance formula. Reports pass/fail for AA and AAA conformance
 * levels at normal and large text sizes.
 *
 * Pure helpers (`parseColor`, `relativeLuminance`, `contrastRatio`,
 * `evaluateContrast`) have no Vue dependency. The `useColorContrastChecker()`
 * composable wraps them in reactive state and wires up the embed
 * PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                     */
/* -------------------------------------------------------------------------- */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ContrastResult {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

export interface UseColorContrastCheckerReturn {
  foreground: Ref<string>;
  background: Ref<string>;
  result: Ref<ContrastResult | null>;
  foregroundRgb: Ref<RgbColor | null>;
  backgroundRgb: Ref<RgbColor | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  swap: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

const HEX3_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const HEX6_RE = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;
const RGB_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;

/** Parse a color string (hex3, hex6, or rgb()) into RGB components. */
export function parseColor(input: string): RgbColor | null {
  const s = input.trim();
  if (!s) return null;

  let m = HEX6_RE.exec(s);
  if (m && m[1] && m[2] && m[3]) {
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }

  m = HEX3_RE.exec(s);
  if (m && m[1] && m[2] && m[3]) {
    return {
      r: parseInt(m[1] + m[1], 16),
      g: parseInt(m[2] + m[2], 16),
      b: parseInt(m[3] + m[3], 16),
    };
  }

  m = RGB_RE.exec(s);
  if (m && m[1] && m[2] && m[3]) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    if (r > 255 || g > 255 || b > 255) return null;
    return { r, g, b };
  }

  return null;
}

/** Convert an 8-bit channel value to a linear sRGB value. */
function channelToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/** Compute the relative luminance of an RGB color (WCAG 2.x formula). */
export function relativeLuminance({ r, g, b }: RgbColor): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/** Compute the contrast ratio between two RGB colors. */
export function contrastRatio(fg: RgbColor, bg: RgbColor): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Evaluate a contrast ratio against WCAG thresholds. */
export function evaluateContrast(ratio: number): ContrastResult {
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3.0,
    aaaNormal: ratio >= 7.0,
    aaaLarge: ratio >= 4.5,
  };
}

/** Convert RGB to a CSS color string. */
export function rgbToCss({ r, g, b }: RgbColor): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export function useColorContrastChecker(): UseColorContrastCheckerReturn {
  const foreground = ref<string>('#000000');
  const background = ref<string>('#ffffff');
  const result = ref<ContrastResult | null>(null);
  const foregroundRgb = ref<RgbColor | null>(null);
  const backgroundRgb = ref<RgbColor | null>(null);

  function recompute(): void {
    const fg = parseColor(foreground.value);
    const bg = parseColor(background.value);
    foregroundRgb.value = fg;
    backgroundRgb.value = bg;
    if (!fg || !bg) {
      result.value = null;
      return;
    }
    const ratio = contrastRatio(fg, bg);
    result.value = evaluateContrast(ratio);
  }

  function swap(): void {
    const tmp = foreground.value;
    foreground.value = background.value;
    background.value = tmp;
  }

  watch([foreground, background], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.foreground === 'string') foreground.value = p.foreground;
      if (typeof p.background === 'string') background.value = p.background;
      if (typeof p.fg === 'string') foreground.value = p.fg;
      if (typeof p.bg === 'string') background.value = p.bg;
    },
    output: result,
    toOutput: () => ({
      foreground: foreground.value,
      background: background.value,
      ratio: result.value?.ratio ?? null,
      aaNormal: result.value?.aaNormal ?? false,
      aaLarge: result.value?.aaLarge ?? false,
      aaaNormal: result.value?.aaaNormal ?? false,
      aaaLarge: result.value?.aaaLarge ?? false,
    }),
  });

  return {
    foreground,
    background,
    result,
    foregroundRgb,
    backgroundRgb,
    isEmbed,
    embedInput,
    swap,
  };
}
