/**
 * useImageConverter - composable + pure logic for the image converter tool.
 *
 * Converts an uploaded image between PNG / JPEG / WebP / AVIF via the Canvas
 * 2D `toBlob()` encoder. No external dependencies - everything runs locally
 * in the browser. AVIF encode support varies by browser; unsupported output
 * formats are feature-detected and disabled in the UI.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing. The composable wraps them in reactive state and wires up
 * the embed PostMessage protocol.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  canvasToBlob,
  drawToCanvas,
  extensionForFormat,
  formatSupportsAlpha,
  formatSupportsQuality,
  listEncodableFormats,
  loadImageFromBlob,
  mimeForFormat,
  RASTER_FORMATS,
  type RasterFormat,
} from '@/utils/image';
import { downloadBlob, outputName, stripExtension } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

export interface SourceInfo {
  name: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  objectUrl: string;
}

export interface ConvertedInfo {
  blob: Blob;
  objectUrl: string;
  sizeBytes: number;
  format: RasterFormat;
}

export const DEFAULT_FORMAT: RasterFormat = 'webp';
export const DEFAULT_QUALITY = 0.85;
export const DEFAULT_BACKGROUND = '#ffffff';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Clamp a quality value (0-1 or 0-100 input) into the 0-1 range. */
export function normalizeQuality(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_QUALITY;
  const v = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0.01, v));
}

/** Human label for a raster format. */
export function formatLabel(format: RasterFormat): string {
  return format === 'jpeg' ? 'JPEG' : format.toUpperCase();
}

/** Percentage size change from input to output (negative = smaller). */
export function sizeChangePercent(inputBytes: number, outputBytes: number): number {
  if (!Number.isFinite(inputBytes) || inputBytes <= 0) return 0;
  return ((outputBytes - inputBytes) / inputBytes) * 100;
}

/** Describe the size change as a short human string. */
export function describeSizeChange(inputBytes: number, outputBytes: number): string {
  const pct = sizeChangePercent(inputBytes, outputBytes);
  const abs = Math.abs(pct);
  if (abs < 0.5) return 'same size';
  return pct < 0 ? `${abs.toFixed(1)}% smaller` : `${abs.toFixed(1)}% larger`;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseImageConverterReturn {
  source: Ref<SourceInfo | null>;
  targetFormat: Ref<RasterFormat>;
  quality: Ref<number>;
  background: Ref<string>;
  encodableFormats: Ref<RasterFormat[]>;
  converted: Ref<ConvertedInfo | null>;
  isConverting: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  convert: () => Promise<void>;
  download: () => void;
  reset: () => void;
}

export function useImageConverter(): UseImageConverterReturn {
  const source = ref<SourceInfo | null>(null);
  const targetFormat = ref<RasterFormat>(DEFAULT_FORMAT);
  const quality = ref<number>(DEFAULT_QUALITY);
  const background = ref<string>(DEFAULT_BACKGROUND);
  const encodableFormats = ref<RasterFormat[]>(['png', 'jpeg', 'webp']);
  const converted = ref<ConvertedInfo | null>(null);
  const isConverting = ref<boolean>(false);
  const error = ref<string | null>(null);

  // Detect which formats this browser can encode (AVIF varies).
  void listEncodableFormats()
    .then((formats) => {
      if (formats.length > 0) encodableFormats.value = formats;
    })
    .catch(() => {
      /* keep defaults */
    });

  let sourceImg: HTMLImageElement | null = null;

  function clearConverted(): void {
    if (converted.value) {
      URL.revokeObjectURL(converted.value.objectUrl);
      converted.value = null;
    }
  }

  function clearSource(): void {
    if (source.value) URL.revokeObjectURL(source.value.objectUrl);
    if (sourceImg) URL.revokeObjectURL(sourceImg.src);
    source.value = null;
    sourceImg = null;
  }

  async function setFile(file: File): Promise<void> {
    error.value = null;
    clearConverted();
    clearSource();
    try {
      const { img, url } = await loadImageFromBlob(file);
      sourceImg = img;
      source.value = {
        name: file.name || 'image',
        mimeType: file.type || img.src.slice(5, img.src.indexOf(';')) || 'unknown',
        sizeBytes: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
        objectUrl: url,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  async function convert(): Promise<void> {
    error.value = null;
    const src = source.value;
    const img = sourceImg;
    if (!src || !img) {
      error.value = 'Load an image first.';
      return;
    }
    const format = targetFormat.value;
    if (!encodableFormats.value.includes(format)) {
      error.value = `${formatLabel(format)} encoding is not supported by this browser.`;
      return;
    }
    isConverting.value = true;
    clearConverted();
    try {
      // Flatten transparency when the target has no alpha channel.
      const bg = formatSupportsAlpha(format) ? undefined : background.value;
      const canvas = drawToCanvas(img, src.width, src.height, bg);
      const q = formatSupportsQuality(format) ? normalizeQuality(quality.value) : undefined;
      const blob = await canvasToBlob(canvas, mimeForFormat(format), q);
      converted.value = {
        blob,
        objectUrl: URL.createObjectURL(blob),
        sizeBytes: blob.size,
        format,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Conversion failed.';
    } finally {
      isConverting.value = false;
    }
  }

  function download(): void {
    const out = converted.value;
    const src = source.value;
    if (!out || !src) return;
    const ext = extensionForFormat(out.format);
    downloadBlob(out.blob, outputName(stripExtension(src.name), ext, '-converted'));
  }

  function reset(): void {
    clearConverted();
    clearSource();
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      const fmt = p.format ?? p.targetFormat;
      if (typeof fmt === 'string' && (RASTER_FORMATS as readonly string[]).includes(fmt)) {
        targetFormat.value = fmt as RasterFormat;
      }
      if (typeof p.quality === 'number') quality.value = normalizeQuality(p.quality);
      if (typeof p.background === 'string') background.value = p.background;
      if (p.action === 'convert') void convert();
      if (p.action === 'reset') reset();
    },
  });

  watch(
    [source, converted, isConverting, targetFormat, quality, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        hasSource: !!source.value,
        sourceName: source.value?.name,
        sourceSizeBytes: source.value?.sizeBytes,
        width: source.value?.width,
        height: source.value?.height,
        targetFormat: targetFormat.value,
        quality: quality.value,
        convertedSizeBytes: converted.value?.sizeBytes,
        isConverting: isConverting.value,
        error: error.value ?? undefined,
      });
    },
  );

  onBeforeUnmount(() => {
    clearConverted();
    clearSource();
  });

  return {
    source,
    targetFormat,
    quality,
    background,
    encodableFormats,
    converted,
    isConverting,
    error,
    isEmbed,
    embedInput,
    setFile,
    convert,
    download,
    reset,
  };
}

// Re-export for the module index.
export { formatBytes } from '@/utils/media';
export { RASTER_FORMATS } from '@/utils/image';
