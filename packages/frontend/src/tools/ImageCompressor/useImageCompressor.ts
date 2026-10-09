/**
 * useImageCompressor - composable + pure logic for the image compressor tool.
 *
 * Compresses an uploaded image via the Canvas 2D `toBlob()` encoder. Two
 * modes:
 *   - Quality mode: explicit quality slider (1-100).
 *   - Target-size mode: binary-searches the quality parameter until the
 *     output lands at or under a target byte budget.
 *
 * No external dependencies - everything runs locally in the browser.
 * Pure helpers have no Vue dependency and can be imported standalone.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  canvasToBlob,
  drawToCanvas,
  extensionForFormat,
  formatForMime,
  formatSupportsAlpha,
  listEncodableFormats,
  loadImageFromBlob,
  mimeForFormat,
  type RasterFormat,
} from '@/utils/image';
import { downloadBlob, outputName, stripExtension } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

export type CompressMode = 'quality' | 'target-size';

export interface CompressedInfo {
  blob: Blob;
  objectUrl: string;
  sizeBytes: number;
  format: RasterFormat;
  /** The quality actually used for the final encode. */
  qualityUsed: number;
}

export const DEFAULT_MODE: CompressMode = 'quality';
export const DEFAULT_QUALITY = 0.7;
export const DEFAULT_TARGET_KB = 200;
export const MAX_TARGET_ITERATIONS = 8;
export const DEFAULT_BACKGROUND = '#ffffff';

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** Parse a target-size string like `200`, `200 KB`, `1.5 MB` into bytes. */
export function parseTargetSize(input: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i.exec(input ?? '');
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = (m[2] ?? 'kb').toLowerCase();
  const mult = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return Math.round(value * mult);
}

/** Compression ratio as a percentage saved (0-100). */
export function savingsPercent(inputBytes: number, outputBytes: number): number {
  if (!Number.isFinite(inputBytes) || inputBytes <= 0) return 0;
  return Math.max(0, (1 - outputBytes / inputBytes) * 100);
}

/**
 * Binary-search the highest quality whose encoded size fits `targetBytes`.
 * Returns the blob + the quality used. Falls back to the smallest encode
 * when even quality≈0.01 exceeds the target.
 */
export async function compressToTargetSize(
  canvas: HTMLCanvasElement,
  mimeType: string,
  targetBytes: number,
  maxIterations = MAX_TARGET_ITERATIONS,
): Promise<{ blob: Blob; quality: number }> {
  let lo = 0.01;
  let hi = 1;
  let best: { blob: Blob; quality: number } | null = null;
  let smallest: { blob: Blob; quality: number } | null = null;

  for (let i = 0; i < maxIterations; i++) {
    const q = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, mimeType, q);
    if (!smallest || blob.size < smallest.blob.size) smallest = { blob, quality: q };
    if (blob.size <= targetBytes) {
      best = { blob, quality: q };
      lo = q; // can afford more quality
    } else {
      hi = q; // too big - lower quality
    }
  }
  return best ?? smallest!;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseImageCompressorReturn {
  sourceName: Ref<string>;
  sourceSizeBytes: Ref<number>;
  sourceWidth: Ref<number>;
  sourceHeight: Ref<number>;
  sourceUrl: Ref<string | null>;
  hasSource: Ref<boolean>;
  mode: Ref<CompressMode>;
  format: Ref<RasterFormat>;
  quality: Ref<number>;
  targetSizeText: Ref<string>;
  background: Ref<string>;
  encodableFormats: Ref<RasterFormat[]>;
  compressed: Ref<CompressedInfo | null>;
  isCompressing: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  compress: () => Promise<void>;
  download: () => void;
  reset: () => void;
}

export function useImageCompressor(): UseImageCompressorReturn {
  const sourceName = ref<string>('');
  const sourceSizeBytes = ref<number>(0);
  const sourceWidth = ref<number>(0);
  const sourceHeight = ref<number>(0);
  const sourceUrl = ref<string | null>(null);
  const hasSource = ref<boolean>(false);

  const mode = ref<CompressMode>(DEFAULT_MODE);
  const format = ref<RasterFormat>('webp');
  const quality = ref<number>(DEFAULT_QUALITY);
  const targetSizeText = ref<string>(`${DEFAULT_TARGET_KB} KB`);
  const background = ref<string>(DEFAULT_BACKGROUND);
  const encodableFormats = ref<RasterFormat[]>(['png', 'jpeg', 'webp']);
  const compressed = ref<CompressedInfo | null>(null);
  const isCompressing = ref<boolean>(false);
  const error = ref<string | null>(null);

  void listEncodableFormats()
    .then((f) => {
      if (f.length > 0) encodableFormats.value = f;
    })
    .catch(() => {
      /* keep defaults */
    });

  let sourceImg: HTMLImageElement | null = null;

  function clearCompressed(): void {
    if (compressed.value) {
      URL.revokeObjectURL(compressed.value.objectUrl);
      compressed.value = null;
    }
  }

  function clearSource(): void {
    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
    if (sourceImg) URL.revokeObjectURL(sourceImg.src);
    sourceUrl.value = null;
    sourceImg = null;
    hasSource.value = false;
  }

  async function setFile(file: File): Promise<void> {
    error.value = null;
    clearCompressed();
    clearSource();
    try {
      const { img, url } = await loadImageFromBlob(file);
      sourceImg = img;
      sourceUrl.value = url;
      sourceName.value = file.name || 'image';
      sourceSizeBytes.value = file.size;
      sourceWidth.value = img.naturalWidth;
      sourceHeight.value = img.naturalHeight;
      hasSource.value = true;
      // Default the output format to the input's format when encodable.
      const inputFmt = formatForMime(file.type);
      if (inputFmt && inputFmt !== 'png') format.value = inputFmt;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  async function compress(): Promise<void> {
    error.value = null;
    const img = sourceImg;
    if (!img || !hasSource.value) {
      error.value = 'Load an image first.';
      return;
    }
    const fmt = format.value;
    if (!encodableFormats.value.includes(fmt)) {
      error.value = `${fmt.toUpperCase()} encoding is not supported by this browser.`;
      return;
    }
    isCompressing.value = true;
    clearCompressed();
    try {
      const bg = formatSupportsAlpha(fmt) ? undefined : background.value;
      const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight, bg);
      const mime = mimeForFormat(fmt);
      if (mode.value === 'target-size') {
        const target = parseTargetSize(targetSizeText.value);
        if (target === null) {
          error.value = `Invalid target size "${targetSizeText.value}" - try "200 KB" or "1.5 MB".`;
          isCompressing.value = false;
          return;
        }
        const { blob, quality: q } = await compressToTargetSize(canvas, mime, target);
        compressed.value = {
          blob,
          objectUrl: URL.createObjectURL(blob),
          sizeBytes: blob.size,
          format: fmt,
          qualityUsed: q,
        };
      } else {
        const q = Math.min(1, Math.max(0.01, quality.value));
        const blob = await canvasToBlob(canvas, mime, q);
        compressed.value = {
          blob,
          objectUrl: URL.createObjectURL(blob),
          sizeBytes: blob.size,
          format: fmt,
          qualityUsed: q,
        };
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Compression failed.';
    } finally {
      isCompressing.value = false;
    }
  }

  function download(): void {
    const out = compressed.value;
    if (!out) return;
    const ext = extensionForFormat(out.format);
    downloadBlob(out.blob, outputName(stripExtension(sourceName.value), ext, '-min'));
  }

  function reset(): void {
    clearCompressed();
    clearSource();
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.mode === 'quality' || p.mode === 'target-size') mode.value = p.mode;
      const fmt = p.format;
      if (typeof fmt === 'string' && ['png', 'jpeg', 'webp', 'avif'].includes(fmt)) {
        format.value = fmt as RasterFormat;
      }
      if (typeof p.quality === 'number') {
        quality.value = Math.min(1, Math.max(0.01, p.quality > 1 ? p.quality / 100 : p.quality));
      }
      if (typeof p.targetSize === 'string') targetSizeText.value = p.targetSize;
      if (typeof p.targetSize === 'number') targetSizeText.value = `${p.targetSize} KB`;
      if (p.action === 'compress') void compress();
      if (p.action === 'reset') reset();
    },
  });

  watch(
    [hasSource, compressed, isCompressing, mode, format, quality, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        hasSource: hasSource.value,
        sourceName: sourceName.value,
        sourceSizeBytes: sourceSizeBytes.value,
        mode: mode.value,
        format: format.value,
        compressedSizeBytes: compressed.value?.sizeBytes,
        qualityUsed: compressed.value?.qualityUsed,
        savingsPercent: compressed.value
          ? savingsPercent(sourceSizeBytes.value, compressed.value.sizeBytes)
          : undefined,
        isCompressing: isCompressing.value,
        error: error.value ?? undefined,
      });
    },
  );

  onBeforeUnmount(() => {
    clearCompressed();
    clearSource();
  });

  return {
    sourceName,
    sourceSizeBytes,
    sourceWidth,
    sourceHeight,
    sourceUrl,
    hasSource,
    mode,
    format,
    quality,
    targetSizeText,
    background,
    encodableFormats,
    compressed,
    isCompressing,
    error,
    isEmbed,
    embedInput,
    setFile,
    compress,
    download,
    reset,
  };
}
