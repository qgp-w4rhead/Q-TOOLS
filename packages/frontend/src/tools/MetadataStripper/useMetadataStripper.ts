/**
 * useMetadataStripper - composable + pure logic for the metadata stripper.
 *
 * Re-encodes an uploaded image through the Canvas 2D encoder, which drops
 * all embedded metadata (EXIF, GPS, IPTC, XMP, thumbnails) because canvas
 * output contains only pixel data. Uses the ExifViewer's parser to report
 * which metadata was present before stripping.
 *
 * No external dependencies - everything runs locally in the browser.
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
  formatSupportsQuality,
  listEncodableFormats,
  loadImageFromBlob,
  mimeForFormat,
  type RasterFormat,
} from '@/utils/image';
import { downloadBlob, outputName, stripExtension } from '@/utils/media';
import { parseExif } from '../ExifViewer/useExifViewer';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

export interface StripResult {
  blob: Blob;
  objectUrl: string;
  sizeBytes: number;
  format: RasterFormat;
}

export const DEFAULT_BACKGROUND = '#ffffff';

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseMetadataStripperReturn {
  fileName: Ref<string>;
  fileSizeBytes: Ref<number>;
  sourceUrl: Ref<string | null>;
  hasFile: Ref<boolean>;
  imageWidth: Ref<number>;
  imageHeight: Ref<number>;
  /** Number of EXIF tags detected in the source (0 = none found). */
  detectedTagCount: Ref<number>;
  hasGps: Ref<boolean>;
  format: Ref<RasterFormat>;
  quality: Ref<number>;
  background: Ref<string>;
  encodableFormats: Ref<RasterFormat[]>;
  result: Ref<StripResult | null>;
  isStripping: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  strip: () => Promise<void>;
  download: () => void;
  reset: () => void;
}

export function useMetadataStripper(): UseMetadataStripperReturn {
  const fileName = ref<string>('');
  const fileSizeBytes = ref<number>(0);
  const sourceUrl = ref<string | null>(null);
  const hasFile = ref<boolean>(false);
  const imageWidth = ref<number>(0);
  const imageHeight = ref<number>(0);
  const detectedTagCount = ref<number>(0);
  const hasGps = ref<boolean>(false);
  const format = ref<RasterFormat>('png');
  const quality = ref<number>(0.92);
  const background = ref<string>(DEFAULT_BACKGROUND);
  const encodableFormats = ref<RasterFormat[]>(['png', 'jpeg', 'webp']);
  const result = ref<StripResult | null>(null);
  const isStripping = ref<boolean>(false);
  const error = ref<string | null>(null);

  let sourceImg: HTMLImageElement | null = null;

  void listEncodableFormats()
    .then((f) => {
      if (f.length > 0) encodableFormats.value = f;
    })
    .catch(() => {
      /* keep defaults */
    });

  function clearResult(): void {
    if (result.value) URL.revokeObjectURL(result.value.objectUrl);
    result.value = null;
  }

  function clearSource(): void {
    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
    if (sourceImg) URL.revokeObjectURL(sourceImg.src);
    sourceUrl.value = null;
    sourceImg = null;
    hasFile.value = false;
    detectedTagCount.value = 0;
    hasGps.value = false;
  }

  async function setFile(file: File): Promise<void> {
    error.value = null;
    clearResult();
    clearSource();
    try {
      const { img, url } = await loadImageFromBlob(file);
      sourceImg = img;
      sourceUrl.value = url;
      fileName.value = file.name || 'image';
      fileSizeBytes.value = file.size;
      imageWidth.value = img.naturalWidth;
      imageHeight.value = img.naturalHeight;
      hasFile.value = true;
      // Report what metadata the source carries (best-effort).
      try {
        const buf = await file.arrayBuffer();
        const parsed = parseExif(buf);
        detectedTagCount.value = parsed?.tagCount ?? 0;
        hasGps.value = !!parsed?.gps;
      } catch {
        detectedTagCount.value = 0;
        hasGps.value = false;
      }
      // Default output format: keep the input's format when encodable.
      const inputFmt = formatForMime(file.type);
      if (inputFmt) format.value = inputFmt;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  async function strip(): Promise<void> {
    error.value = null;
    const img = sourceImg;
    if (!img || !hasFile.value) {
      error.value = 'Load an image first.';
      return;
    }
    const fmt = format.value;
    if (!encodableFormats.value.includes(fmt)) {
      error.value = `${fmt.toUpperCase()} encoding is not supported by this browser.`;
      return;
    }
    isStripping.value = true;
    clearResult();
    try {
      const bg = formatSupportsAlpha(fmt) ? undefined : background.value;
      const canvas = drawToCanvas(img, img.naturalWidth, img.naturalHeight, bg);
      const q = formatSupportsQuality(fmt)
        ? Math.min(1, Math.max(0.01, quality.value))
        : undefined;
      const blob = await canvasToBlob(canvas, mimeForFormat(fmt), q);
      result.value = {
        blob,
        objectUrl: URL.createObjectURL(blob),
        sizeBytes: blob.size,
        format: fmt,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Stripping failed.';
    } finally {
      isStripping.value = false;
    }
  }

  function download(): void {
    const out = result.value;
    if (!out) return;
    const ext = extensionForFormat(out.format);
    downloadBlob(out.blob, outputName(stripExtension(fileName.value), ext, '-clean'));
  }

  function reset(): void {
    clearResult();
    clearSource();
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.format === 'string' && ['png', 'jpeg', 'webp', 'avif'].includes(p.format)) {
        format.value = p.format as RasterFormat;
      }
      if (p.action === 'strip') void strip();
      if (p.action === 'reset') reset();
    },
  });

  watch(
    [hasFile, result, isStripping, detectedTagCount, hasGps, format, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        hasFile: hasFile.value,
        fileName: fileName.value,
        fileSizeBytes: fileSizeBytes.value,
        detectedTagCount: detectedTagCount.value,
        hasGps: hasGps.value,
        format: format.value,
        strippedSizeBytes: result.value?.sizeBytes,
        isStripping: isStripping.value,
        error: error.value ?? undefined,
      });
    },
  );

  onBeforeUnmount(reset);

  return {
    fileName,
    fileSizeBytes,
    sourceUrl,
    hasFile,
    imageWidth,
    imageHeight,
    detectedTagCount,
    hasGps,
    format,
    quality,
    background,
    encodableFormats,
    result,
    isStripping,
    error,
    isEmbed,
    embedInput,
    setFile,
    strip,
    download,
    reset,
  };
}
