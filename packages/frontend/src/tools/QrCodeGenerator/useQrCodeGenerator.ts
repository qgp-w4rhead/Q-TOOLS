/**
 * useQrCodeGenerator - composable + pure logic for the QR Code generator tool.
 *
 * Renders arbitrary text/URLs as QR codes in two formats:
 *   - PNG (canvas → data URL) for raster use and `.png` download
 *   - SVG (vector string) for scalable use and `.svg` download
 *
 * Configurable: size (px), error correction level (L/M/Q/H), margin (quiet
 * zone modules), foreground color, background color.
 *
 * Pure helpers (`generateQrDataUrl`, `generateQrSvg`, `generateQrCanvas`,
 * `normalizeHexColor`) have no Vue dependency and can be imported standalone
 * for unit testing or reuse. The `useQrCodeGenerator()` composable wraps them
 * in reactive state and wires up the embed PostMessage protocol.
 *
 * Uses the `qrcode` package (initial bundle, statically imported per
 * tech-stack.md). No other external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import QRCode from 'qrcode';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** QR error correction levels per the QR Code 2005 spec. */
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrErrorCorrectionInfo {
  value: ErrorCorrectionLevel;
  label: string;
  /** Approximate data capacity recovery ratio. */
  recovery: string;
}

export const ERROR_CORRECTION_LEVELS: QrErrorCorrectionInfo[] = [
  { value: 'L', label: 'Low', recovery: '~7%' },
  { value: 'M', label: 'Medium', recovery: '~15%' },
  { value: 'Q', label: 'Quartile', recovery: '~25%' },
  { value: 'H', label: 'High', recovery: '~30%' },
];

export const DEFAULT_ERROR_CORRECTION: ErrorCorrectionLevel = 'M';

/** Default QR pixel size (rendered canvas/SVG width/height). */
export const DEFAULT_SIZE = 256;
export const MIN_SIZE = 64;
export const MAX_SIZE = 2048;

/** Default quiet-zone margin (modules). */
export const DEFAULT_MARGIN = 4;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 20;

export const DEFAULT_FOREGROUND = '#000000';
export const DEFAULT_BACKGROUND = '#ffffff';

/** Full set of options accepted by the pure generators. */
export interface QrRenderOptions {
  size: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  margin: number;
  foreground: string;
  background: string;
}

export const DEFAULT_QR_OPTIONS: QrRenderOptions = {
  size: DEFAULT_SIZE,
  errorCorrectionLevel: DEFAULT_ERROR_CORRECTION,
  margin: DEFAULT_MARGIN,
  foreground: DEFAULT_FOREGROUND,
  background: DEFAULT_BACKGROUND,
};

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Normalise a CSS hex color string to `#RRGGBB` (lowercase). Accepts 3- or
 * 6-digit hex with or without a leading `#`. Returns the fallback when the
 * input cannot be parsed so the `qrcode` package always receives a valid
 * color string.
 */
export function normalizeHexColor(input: string, fallback: string): string {
  const trimmed = input.trim();
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

/** Build the `qrcode` package options object from our render options. */
function buildQrOptions(opts: QrRenderOptions): QRCode.QRCodeRenderersOptions {
  return {
    width: opts.size,
    margin: opts.margin,
    errorCorrectionLevel: opts.errorCorrectionLevel,
    color: {
      dark: normalizeHexColor(opts.foreground, DEFAULT_FOREGROUND),
      light: normalizeHexColor(opts.background, DEFAULT_BACKGROUND),
    },
  };
}

/**
 * Render `text` as a PNG data URL (`data:image/png;base64,…`) via the
 * `qrcode` package. Throws on empty input or invalid options.
 */
export async function generateQrDataUrl(
  text: string,
  opts: QrRenderOptions,
): Promise<string> {
  const data = text ?? '';
  if (data.length === 0) {
    throw new Error('Input text is empty - nothing to encode.');
  }
  return QRCode.toDataURL(data, buildQrOptions(opts));
}

/**
 * Render `text` as an SVG string via the `qrcode` package. The SVG carries
 * explicit `width`/`height` (in px) plus a `viewBox` in module units, so it
 * scales cleanly. Throws on empty input or invalid options.
 */
export async function generateQrSvg(
  text: string,
  opts: QrRenderOptions,
): Promise<string> {
  const data = text ?? '';
  if (data.length === 0) {
    throw new Error('Input text is empty - nothing to encode.');
  }
  return QRCode.toString(data, {
    ...buildQrOptions(opts),
    type: 'svg',
  });
}

/**
 * Render `text` onto an existing `<canvas>` element via the `qrcode` package.
 * The canvas is sized to `opts.size`. Throws on empty input or invalid
 * options. No-op when `canvas` is null (e.g. SSR or detached element).
 */
export async function generateQrCanvas(
  canvas: HTMLCanvasElement | null,
  text: string,
  opts: QrRenderOptions,
): Promise<void> {
  if (!canvas) return;
  const data = text ?? '';
  if (data.length === 0) {
    throw new Error('Input text is empty - nothing to encode.');
  }
  await QRCode.toCanvas(canvas, data, buildQrOptions(opts));
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseQrCodeGeneratorReturn {
  text: Ref<string>;
  size: Ref<number>;
  errorCorrectionLevel: Ref<ErrorCorrectionLevel>;
  margin: Ref<number>;
  foreground: Ref<string>;
  background: Ref<string>;
  pngDataUrl: Ref<string>;
  svgString: Ref<string>;
  error: Ref<string | null>;
  computing: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useQrCodeGenerator(): UseQrCodeGeneratorReturn {
  const text = ref<string>('');
  const size = ref<number>(DEFAULT_SIZE);
  const errorCorrectionLevel = ref<ErrorCorrectionLevel>(DEFAULT_ERROR_CORRECTION);
  const margin = ref<number>(DEFAULT_MARGIN);
  const foreground = ref<string>(DEFAULT_FOREGROUND);
  const background = ref<string>(DEFAULT_BACKGROUND);

  const pngDataUrl = ref<string>('');
  const svgString = ref<string>('');
  const error = ref<string | null>(null);
  const computing = ref<boolean>(false);

  let renderToken = 0;

  async function recompute(): Promise<void> {
    const trimmed = text.value.trim();
    if (trimmed.length === 0) {
      pngDataUrl.value = '';
      svgString.value = '';
      error.value = null;
      computing.value = false;
      return;
    }
    const token = ++renderToken;
    computing.value = true;
    const opts: QrRenderOptions = {
      size: clamp(Math.round(size.value), MIN_SIZE, MAX_SIZE),
      errorCorrectionLevel: errorCorrectionLevel.value,
      margin: clamp(Math.round(margin.value), MIN_MARGIN, MAX_MARGIN),
      foreground: foreground.value,
      background: background.value,
    };
    try {
      const [png, svg] = await Promise.all([
        generateQrDataUrl(trimmed, opts),
        generateQrSvg(trimmed, opts),
      ]);
      if (token !== renderToken) return; // a newer render superseded us
      pngDataUrl.value = png;
      svgString.value = svg;
      error.value = null;
    } catch (err) {
      if (token !== renderToken) return;
      pngDataUrl.value = '';
      svgString.value = '';
      error.value = (err as Error).message || 'Failed to generate QR code.';
    } finally {
      if (token === renderToken) computing.value = false;
    }
  }

  // Debounce: avoid re-rendering on every keystroke for large payloads.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleRecompute(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void recompute();
    }, 150);
  }

  watch(
    [text, size, errorCorrectionLevel, margin, foreground, background],
    scheduleRecompute,
    { immediate: true },
  );

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') text.value = p.text;
      else if (typeof p.value === 'string') text.value = p.value;
      else if (typeof p.url === 'string') text.value = p.url;
      else if (typeof p.content === 'string') text.value = p.content;
      if (typeof p.size === 'number') size.value = p.size;
      if (typeof p.margin === 'number') margin.value = p.margin;
      if (
        typeof p.errorCorrectionLevel === 'string' &&
        (p.errorCorrectionLevel === 'L' ||
          p.errorCorrectionLevel === 'M' ||
          p.errorCorrectionLevel === 'Q' ||
          p.errorCorrectionLevel === 'H')
      ) {
        errorCorrectionLevel.value = p.errorCorrectionLevel;
      }
      if (typeof p.foreground === 'string') foreground.value = p.foreground;
      if (typeof p.background === 'string') background.value = p.background;
    },
  });

  watch([pngDataUrl, svgString, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      pngDataUrl: pngDataUrl.value || undefined,
      svgString: svgString.value || undefined,
      text: text.value,
      size: size.value,
      errorCorrectionLevel: errorCorrectionLevel.value,
      margin: margin.value,
      foreground: foreground.value,
      background: background.value,
      error: error.value ?? undefined,
    });
  });

  return {
    text,
    size,
    errorCorrectionLevel,
    margin,
    foreground,
    background,
    pngDataUrl,
    svgString,
    error,
    computing,
    isEmbed,
    embedInput,
  };
}
