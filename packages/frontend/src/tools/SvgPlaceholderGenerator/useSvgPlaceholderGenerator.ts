/**
 * useSvgPlaceholderGenerator — composable + pure logic for the SVG placeholder
 * generator tool.
 *
 * Builds a self-contained SVG placeholder image string from a set of options:
 *   - width / height (px)
 *   - background color (hex)
 *   - text (the label rendered centred in the SVG)
 *   - text color (hex)
 *   - font size (px)
 *
 * The SVG is generated entirely by hand-rolled string assembly — no external
 * dependencies. A PNG rasterisation helper (`svgToPngDataUrl`) is provided for
 * the download convenience button; it uses the browser's `Image` + `<canvas>`
 * APIs and is only invoked from the component (browser-only).
 *
 * Pure helpers (`escapeXml`, `normalizeHexColor`, `clamp`, `buildSvgPlaceholder`,
 * `defaultPlaceholderText`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useSvgPlaceholderGenerator()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** Full set of options accepted by the pure SVG builder. */
export interface SvgPlaceholderOptions {
  width: number;
  height: number;
  background: string;
  text: string;
  textColor: string;
  fontSize: number;
}

export const MIN_DIM = 8;
export const MAX_DIM = 4096;
export const MIN_FONT = 6;
export const MAX_FONT = 512;

export const DEFAULT_WIDTH = 600;
export const DEFAULT_HEIGHT = 300;
export const DEFAULT_BACKGROUND = '#cccccc';
export const DEFAULT_TEXT_COLOR = '#333333';
export const DEFAULT_FONT_SIZE = 28;
export const DEFAULT_TEXT = '';

export const DEFAULT_PLACEHOLDER_OPTIONS: SvgPlaceholderOptions = {
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  background: DEFAULT_BACKGROUND,
  text: DEFAULT_TEXT,
  textColor: DEFAULT_TEXT_COLOR,
  fontSize: DEFAULT_FONT_SIZE,
};

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Escape a string for safe inclusion in XML/SVG text content and attribute
 * values. Escapes `& < > " '` and replaces control characters (except tab,
 * newline, carriage return) with spaces to keep the SVG well-formed.
 */
export function escapeXml(input: string): string {
  if (input == null) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

/**
 * Normalise a CSS hex color string to `#RRGGBB` (lowercase). Accepts 3- or
 * 6-digit hex with or without a leading `#`. Returns the fallback when the
 * input cannot be parsed so the SVG always carries a valid color string.
 */
export function normalizeHexColor(input: string, fallback: string): string {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return fallback;
  const stripped = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(stripped)) return `#${stripped.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(stripped)) {
    const expanded = stripped
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase();
    return `#${expanded}`;
  }
  return fallback;
}

/** Clamp a number to the `[min, max]` range. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Default placeholder text when the user leaves the text field empty: the
 * dimensions in `WIDTH×HEIGHT` form (e.g. `600×300`).
 */
export function defaultPlaceholderText(width: number, height: number): string {
  return `${width}\u00D7${height}`;
}

/**
 * Build a self-contained SVG placeholder image string from the given options.
 *
 * The SVG:
 *   - carries explicit `width`/`height` (in px) plus a matching `viewBox`,
 *     so it scales cleanly when embedded;
 *   - fills the entire canvas with the background color;
 *   - renders the text (or the default `WIDTH×HEIGHT` label when empty)
 *     horizontally + vertically centred, clipped to the canvas so very long
 *     labels never overflow the SVG bounds;
 *   - uses the `xMidYMid` text-anchor / dominant-baseline combo for
 *     consistent centring across renderers.
 *
 * Returns the SVG markup as a string (no XML declaration — inline SVG / data
 * URI friendly).
 */
export function buildSvgPlaceholder(opts: SvgPlaceholderOptions): string {
  const width = Math.round(clamp(opts.width, MIN_DIM, MAX_DIM));
  const height = Math.round(clamp(opts.height, MIN_DIM, MAX_DIM));
  const bg = normalizeHexColor(opts.background, DEFAULT_BACKGROUND);
  const fg = normalizeHexColor(opts.textColor, DEFAULT_TEXT_COLOR);
  const fontSize = Math.round(clamp(opts.fontSize, MIN_FONT, MAX_FONT));
  const rawText = (opts.text ?? '').trim();
  const text = rawText.length > 0 ? rawText : defaultPlaceholderText(width, height);
  const escaped = escapeXml(text);

  // Clip the text to the canvas so very long labels never overflow the SVG.
  // A unique clip-path id avoids collisions when multiple SVGs are inlined.
  const clipId = `qt-svg-clip-${width}-${height}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`,
    ` role="img" aria-label="${escapeXml(text)}">`,
    `<title>${escaped}</title>`,
    `<defs><clipPath id="${clipId}"><rect width="${width}" height="${height}" rx="0" ry="0"/></clipPath></defs>`,
    `<rect width="${width}" height="${height}" fill="${bg}"/>`,
    `<g clip-path="url(#${clipId})">`,
    `<text x="50%" y="50%"`,
    ` text-anchor="middle" dominant-baseline="central"`,
    ` font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"`,
    ` font-size="${fontSize}px" fill="${fg}">${escaped}</text>`,
    `</g>`,
    `</svg>`,
  ].join('');
}

/**
 * Rasterise an SVG string to a PNG data URL (`data:image/png;base64,…`) using
 * the browser's `Image` + `<canvas>` APIs. Returns a Promise that resolves
 * with the data URL. Browser-only — must not be called during SSR.
 *
 * The SVG is fed to the `Image` via a `data:image/svg+xml;charset=utf-8,…`
 * URL (URL-encoded, not base64, for maximum renderer compatibility). The
 * image is drawn onto a canvas at the SVG's intrinsic pixel dimensions and
 * exported as PNG.
 */
export function svgToPngDataUrl(svg: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('PNG rasterisation requires a browser environment.'));
      return;
    }
    const w = Math.round(clamp(width, MIN_DIM, MAX_DIM));
    const h = Math.round(clamp(height, MIN_DIM, MAX_DIM));
    const encoded = encodeURIComponent(svg)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');
    const dataUri = `data:image/svg+xml;charset=utf-8,${encoded}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not acquire a 2D canvas context.'));
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => reject(new Error('Failed to load the SVG for rasterisation.'));
    img.src = dataUri;
  });
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseSvgPlaceholderGeneratorReturn {
  width: Ref<number>;
  height: Ref<number>;
  background: Ref<string>;
  text: Ref<string>;
  textColor: Ref<string>;
  fontSize: Ref<number>;
  svgString: Ref<string>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useSvgPlaceholderGenerator(): UseSvgPlaceholderGeneratorReturn {
  const width = ref<number>(DEFAULT_WIDTH);
  const height = ref<number>(DEFAULT_HEIGHT);
  const background = ref<string>(DEFAULT_BACKGROUND);
  const text = ref<string>(DEFAULT_TEXT);
  const textColor = ref<string>(DEFAULT_TEXT_COLOR);
  const fontSize = ref<number>(DEFAULT_FONT_SIZE);

  const svgString = ref<string>('');
  const error = ref<string | null>(null);

  function recompute(): void {
    try {
      const opts: SvgPlaceholderOptions = {
        width: clamp(Math.round(width.value), MIN_DIM, MAX_DIM),
        height: clamp(Math.round(height.value), MIN_DIM, MAX_DIM),
        background: background.value,
        text: text.value,
        textColor: textColor.value,
        fontSize: clamp(Math.round(fontSize.value), MIN_FONT, MAX_FONT),
      };
      svgString.value = buildSvgPlaceholder(opts);
      error.value = null;
    } catch (err) {
      svgString.value = '';
      error.value = (err as Error).message || 'Failed to generate SVG placeholder.';
    }
  }

  // SVG generation is synchronous and cheap — no debounce needed, but we still
  // watch all inputs so the preview stays live.
  watch(
    [width, height, background, text, textColor, fontSize],
    recompute,
    { immediate: true },
  );

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.width === 'number') width.value = p.width;
      if (typeof p.height === 'number') height.value = p.height;
      if (typeof p.background === 'string') background.value = p.background;
      if (typeof p.bg === 'string') background.value = p.bg;
      if (typeof p.backgroundColor === 'string') background.value = p.backgroundColor;
      if (typeof p.text === 'string') text.value = p.text;
      else if (typeof p.label === 'string') text.value = p.label;
      else if (typeof p.value === 'string') text.value = p.value;
      else if (typeof p.content === 'string') text.value = p.content;
      if (typeof p.textColor === 'string') textColor.value = p.textColor;
      if (typeof p.fg === 'string') textColor.value = p.fg;
      if (typeof p.fontSize === 'number') fontSize.value = p.fontSize;
    },
  });

  watch([svgString, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      svgString: svgString.value || undefined,
      width: width.value,
      height: height.value,
      background: background.value,
      text: text.value,
      textColor: textColor.value,
      fontSize: fontSize.value,
      error: error.value ?? undefined,
    });
  });

  return {
    width,
    height,
    background,
    text,
    textColor,
    fontSize,
    svgString,
    error,
    isEmbed,
    embedInput,
  };
}
