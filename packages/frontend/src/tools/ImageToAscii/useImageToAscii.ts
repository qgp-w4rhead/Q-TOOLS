/**
 * useImageToAscii - composable + pure logic for the image-to-ASCII tool.
 *
 * Renders an uploaded image as ASCII text by sampling the image onto a
 * character grid and mapping each cell's average luminance to a character
 * ramp. Controls: output width (chars), charset preset (or custom ramp),
 * and an invert toggle. Everything runs locally in the browser.
 *
 * Pure helpers (`CHARSETS`, `imageToAscii`, `luminanceToChar`) have no Vue
 * dependency and can be imported standalone.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import { loadImageFromBlob } from '@/utils/image';
import { downloadBytes, formatBytes } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

export type CharsetPreset = 'standard' | 'blocks' | 'simple' | 'custom';

/** Character ramps, darkest → lightest. */
export const CHARSETS: Record<Exclude<CharsetPreset, 'custom'>, string> = {
  standard: '@%#*+=-:. ',
  blocks: '█▓▒░ ',
  simple: '#. ',
};

export const CHARSET_LABELS: Record<CharsetPreset, string> = {
  standard: 'Standard (@%#*+=-:. )',
  blocks: 'Blocks (█▓▒░ )',
  simple: 'Simple (#. )',
  custom: 'Custom',
};

export const DEFAULT_WIDTH = 100;
export const MIN_WIDTH = 20;
export const MAX_WIDTH = 400;
export const DEFAULT_CHARSET: CharsetPreset = 'standard';
export const DEFAULT_CUSTOM_CHARSET = '@#*+=-:. ';

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** Map a 0-255 luminance to a character in `ramp` (dark → light). */
export function luminanceToChar(lum: number, ramp: string, invert: boolean): string {
  if (ramp.length === 0) return ' ';
  const t = Math.min(1, Math.max(0, lum / 255));
  const idx = Math.round((invert ? t : 1 - t) * (ramp.length - 1));
  return ramp[idx] ?? ' ';
}

/**
 * Render an image source to ASCII text.
 *
 * The image is drawn onto a canvas of `width × height` cells (height is
 * derived from the aspect ratio, halved to compensate for character cells
 * being ~2× taller than wide). Each cell's average luminance maps to a
 * character in `ramp`.
 */
export function imageToAscii(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  width: number,
  ramp: string,
  invert: boolean,
): string {
  const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)));
  // Character cells are ~2× taller than wide - halve the row count.
  const h = Math.max(1, Math.round((srcHeight / Math.max(1, srcWidth)) * w * 0.5));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available.');
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const lines: string[] = [];
  for (let y = 0; y < h; y++) {
    let line = '';
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 255;
      // Treat transparent pixels as white background.
      const lum = a < 128 ? 255 : 0.2126 * r + 0.7152 * g + 0.0722 * b;
      line += luminanceToChar(lum, ramp, invert);
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseImageToAsciiReturn {
  fileName: Ref<string>;
  fileSizeBytes: Ref<number>;
  previewUrl: Ref<string | null>;
  hasFile: Ref<boolean>;
  width: Ref<number>;
  charset: Ref<CharsetPreset>;
  customCharset: Ref<string>;
  invert: Ref<boolean>;
  ascii: Ref<string>;
  isRendering: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  render: () => Promise<void>;
  download: () => void;
  reset: () => void;
}

export function useImageToAscii(): UseImageToAsciiReturn {
  const fileName = ref<string>('');
  const fileSizeBytes = ref<number>(0);
  const previewUrl = ref<string | null>(null);
  const hasFile = ref<boolean>(false);
  const width = ref<number>(DEFAULT_WIDTH);
  const charset = ref<CharsetPreset>(DEFAULT_CHARSET);
  const customCharset = ref<string>(DEFAULT_CUSTOM_CHARSET);
  const invert = ref<boolean>(false);
  const ascii = ref<string>('');
  const isRendering = ref<boolean>(false);
  const error = ref<string | null>(null);

  let sourceImg: HTMLImageElement | null = null;

  function activeRamp(): string {
    return charset.value === 'custom' ? customCharset.value : CHARSETS[charset.value];
  }

  function clear(): void {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    if (sourceImg) URL.revokeObjectURL(sourceImg.src);
    previewUrl.value = null;
    sourceImg = null;
    hasFile.value = false;
    ascii.value = '';
  }

  async function setFile(file: File): Promise<void> {
    error.value = null;
    clear();
    try {
      const { img, url } = await loadImageFromBlob(file);
      sourceImg = img;
      previewUrl.value = url;
      fileName.value = file.name || 'image';
      fileSizeBytes.value = file.size;
      hasFile.value = true;
      await render();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  async function render(): Promise<void> {
    error.value = null;
    const img = sourceImg;
    if (!img || !hasFile.value) {
      error.value = 'Load an image first.';
      return;
    }
    const ramp = activeRamp();
    if (ramp.length === 0) {
      error.value = 'The character ramp is empty - add at least one character.';
      return;
    }
    isRendering.value = true;
    try {
      ascii.value = imageToAscii(
        img,
        img.naturalWidth,
        img.naturalHeight,
        width.value,
        ramp,
        invert.value,
      );
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Rendering failed.';
    } finally {
      isRendering.value = false;
    }
  }

  function download(): void {
    if (!ascii.value) return;
    const base = fileName.value.replace(/\.[^.]+$/, '') || 'ascii';
    downloadBytes(new TextEncoder().encode(ascii.value), `${base}.txt`, 'text/plain');
  }

  function reset(): void {
    clear();
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.width === 'number') {
        width.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(p.width)));
      }
      if (typeof p.charset === 'string' && p.charset in CHARSET_LABELS) {
        charset.value = p.charset as CharsetPreset;
      }
      if (typeof p.customCharset === 'string') customCharset.value = p.customCharset;
      if (typeof p.invert === 'boolean') invert.value = p.invert;
      if (p.action === 'render') void render();
      if (p.action === 'reset') reset();
    },
  });

  watch([hasFile, ascii, width, charset, customCharset, invert, isRendering, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      hasFile: hasFile.value,
      fileName: fileName.value,
      width: width.value,
      charset: charset.value,
      invert: invert.value,
      ascii: ascii.value || undefined,
      isRendering: isRendering.value,
      error: error.value ?? undefined,
    });
  });

  onBeforeUnmount(reset);

  return {
    fileName,
    fileSizeBytes,
    previewUrl,
    hasFile,
    width,
    charset,
    customCharset,
    invert,
    ascii,
    isRendering,
    error,
    isEmbed,
    embedInput,
    setFile,
    render,
    download,
    reset,
  };
}

export { formatBytes };
