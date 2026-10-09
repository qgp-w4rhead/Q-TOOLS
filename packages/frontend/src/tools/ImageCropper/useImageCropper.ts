/**
 * useImageCropper - composable + pure logic for the image cropper tool.
 *
 * Drag-select a region on the image (with optional aspect-ratio presets),
 * then crop via Canvas and download. Everything runs locally in the
 * browser - no external dependencies.
 *
 * The composable owns the decoded image, the crop rectangle in *image*
 * coordinates, and the cropped output. The component owns the display
 * canvas and pointer events, translating screen coords → image coords via
 * the exposed `displayScale`.
 *
 * Pure helpers (`normalizeRect`, `clampRect`, `constrainToRatio`,
 * `rectFromPoints`) have no Vue dependency and can be imported standalone.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  canvasToBlob,
  extensionForFormat,
  formatSupportsAlpha,
  formatSupportsQuality,
  listEncodableFormats,
  loadImageFromBlob,
  mimeForFormat,
  type RasterFormat,
} from '@/utils/image';
import { downloadBlob, outputName, stripExtension } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** A crop rectangle in image pixel coordinates. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AspectPreset = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16';

export const ASPECT_PRESETS: readonly AspectPreset[] = [
  'free',
  '1:1',
  '4:3',
  '3:2',
  '16:9',
  '9:16',
] as const;

export const DEFAULT_PRESET: AspectPreset = 'free';

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** Numeric ratio (w/h) for a preset, or `null` for freeform. */
export function presetRatio(preset: AspectPreset): number | null {
  switch (preset) {
    case '1:1':
      return 1;
    case '4:3':
      return 4 / 3;
    case '3:2':
      return 3 / 2;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    default:
      return null;
  }
}

/** Normalise a rect so width/height are positive (drag direction agnostic). */
export function normalizeRect(r: CropRect): CropRect {
  return {
    x: r.width < 0 ? r.x + r.width : r.x,
    y: r.height < 0 ? r.y + r.height : r.y,
    width: Math.abs(r.width),
    height: Math.abs(r.height),
  };
}

/** Clamp a rect to lie fully inside `bounds` (an image's w×h). */
export function clampRect(r: CropRect, boundsW: number, boundsH: number): CropRect {
  const n = normalizeRect(r);
  const x = Math.min(Math.max(0, n.x), Math.max(0, boundsW));
  const y = Math.min(Math.max(0, n.y), Math.max(0, boundsH));
  return {
    x,
    y,
    width: Math.min(n.width, boundsW - x),
    height: Math.min(n.height, boundsH - y),
  };
}

/**
 * Build a rect from a drag start point and current point, constrained to
 * `ratio` (w/h) when given. The start point stays fixed; the rect grows in
 * the drag direction. Result is clamped to the image bounds.
 */
export function rectFromPoints(
  startX: number,
  startY: number,
  curX: number,
  curY: number,
  ratio: number | null,
  boundsW: number,
  boundsH: number,
): CropRect {
  let w = curX - startX;
  let h = curY - startY;
  if (ratio !== null && ratio > 0) {
    // Derive height from width along the drag direction.
    const signX = w < 0 ? -1 : 1;
    const signY = h < 0 ? -1 : 1;
    const absW = Math.abs(w);
    const absH = Math.abs(h);
    // Fit the larger of the two interpretations inside the drag box.
    if (absW / ratio >= absH) {
      h = (absW / ratio) * signY;
    } else {
      w = absH * ratio * signX;
    }
  }
  return clampRect({ x: startX, y: startY, width: w, height: h }, boundsW, boundsH);
}

/** `true` when a rect is large enough to crop (>= 2×2 px). */
export function isUsableRect(r: CropRect | null): boolean {
  return !!r && r.width >= 2 && r.height >= 2;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseImageCropperReturn {
  hasImage: Ref<boolean>;
  imageUrl: Ref<string | null>;
  imageName: Ref<string>;
  imageWidth: Ref<number>;
  imageHeight: Ref<number>;
  preset: Ref<AspectPreset>;
  cropRect: Ref<CropRect | null>;
  format: Ref<RasterFormat>;
  quality: Ref<number>;
  background: Ref<string>;
  encodableFormats: Ref<RasterFormat[]>;
  outputUrl: Ref<string | null>;
  outputSizeBytes: Ref<number>;
  isCropping: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  setCropRect: (rect: CropRect | null) => void;
  selectAll: () => void;
  applyCrop: () => Promise<void>;
  download: () => void;
  reset: () => void;
}

export function useImageCropper(): UseImageCropperReturn {
  const hasImage = ref<boolean>(false);
  const imageUrl = ref<string | null>(null);
  const imageName = ref<string>('');
  const imageWidth = ref<number>(0);
  const imageHeight = ref<number>(0);
  const preset = ref<AspectPreset>(DEFAULT_PRESET);
  const cropRect = ref<CropRect | null>(null);
  const format = ref<RasterFormat>('png');
  const quality = ref<number>(0.92);
  const background = ref<string>('#ffffff');
  const encodableFormats = ref<RasterFormat[]>(['png', 'jpeg', 'webp']);
  const outputUrl = ref<string | null>(null);
  const outputSizeBytes = ref<number>(0);
  const isCropping = ref<boolean>(false);
  const error = ref<string | null>(null);

  let sourceImg: HTMLImageElement | null = null;

  void listEncodableFormats()
    .then((f) => {
      if (f.length > 0) encodableFormats.value = f;
    })
    .catch(() => {
      /* keep defaults */
    });

  function clearOutput(): void {
    if (outputUrl.value) URL.revokeObjectURL(outputUrl.value);
    outputUrl.value = null;
    outputSizeBytes.value = 0;
  }

  function clearImage(): void {
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
    if (sourceImg) URL.revokeObjectURL(sourceImg.src);
    imageUrl.value = null;
    sourceImg = null;
    hasImage.value = false;
    cropRect.value = null;
  }

  async function setFile(file: File): Promise<void> {
    error.value = null;
    clearOutput();
    clearImage();
    try {
      const { img, url } = await loadImageFromBlob(file);
      sourceImg = img;
      imageUrl.value = url;
      imageName.value = file.name || 'image';
      imageWidth.value = img.naturalWidth;
      imageHeight.value = img.naturalHeight;
      hasImage.value = true;
      // Default to the full image selected.
      cropRect.value = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  function setCropRect(rect: CropRect | null): void {
    if (!rect) {
      cropRect.value = null;
      return;
    }
    cropRect.value = clampRect(rect, imageWidth.value, imageHeight.value);
  }

  function selectAll(): void {
    if (!hasImage.value) return;
    cropRect.value = { x: 0, y: 0, width: imageWidth.value, height: imageHeight.value };
  }

  async function applyCrop(): Promise<void> {
    error.value = null;
    const img = sourceImg;
    const rect = cropRect.value;
    if (!img || !hasImage.value) {
      error.value = 'Load an image first.';
      return;
    }
    if (!isUsableRect(rect)) {
      error.value = 'Drag on the image to select a crop region first.';
      return;
    }
    const fmt = format.value;
    if (!encodableFormats.value.includes(fmt)) {
      error.value = `${fmt.toUpperCase()} encoding is not supported by this browser.`;
      return;
    }
    isCropping.value = true;
    clearOutput();
    try {
      const r = normalizeRect(rect!);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(r.width));
      canvas.height = Math.max(1, Math.round(r.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context is not available.');
      if (!formatSupportsAlpha(fmt)) {
        ctx.fillStyle = background.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(
        img,
        r.x,
        r.y,
        r.width,
        r.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const q = formatSupportsQuality(fmt)
        ? Math.min(1, Math.max(0.01, quality.value))
        : undefined;
      const blob = await canvasToBlob(canvas, mimeForFormat(fmt), q);
      outputUrl.value = URL.createObjectURL(blob);
      outputSizeBytes.value = blob.size;
      outputBlob = blob;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Crop failed.';
    } finally {
      isCropping.value = false;
    }
  }

  let outputBlob: Blob | null = null;

  function download(): void {
    if (!outputBlob) return;
    const ext = extensionForFormat(format.value);
    const r = cropRect.value;
    const suffix = r ? `-${Math.round(r.width)}x${Math.round(r.height)}` : '-crop';
    downloadBlob(outputBlob, outputName(stripExtension(imageName.value), ext, suffix));
  }

  function reset(): void {
    clearOutput();
    clearImage();
    outputBlob = null;
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.preset === 'string' && (ASPECT_PRESETS as readonly string[]).includes(p.preset)) {
        preset.value = p.preset as AspectPreset;
      }
      if (typeof p.format === 'string' && ['png', 'jpeg', 'webp', 'avif'].includes(p.format)) {
        format.value = p.format as RasterFormat;
      }
      if (p.action === 'select-all') selectAll();
      if (p.action === 'crop') void applyCrop();
      if (p.action === 'reset') reset();
    },
  });

  watch(
    [hasImage, cropRect, outputUrl, isCropping, preset, format, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        hasImage: hasImage.value,
        imageName: imageName.value,
        imageWidth: imageWidth.value,
        imageHeight: imageHeight.value,
        preset: preset.value,
        crop: cropRect.value ?? undefined,
        hasOutput: !!outputUrl.value,
        outputSizeBytes: outputSizeBytes.value,
        isCropping: isCropping.value,
        error: error.value ?? undefined,
      });
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    reset();
  });

  return {
    hasImage,
    imageUrl,
    imageName,
    imageWidth,
    imageHeight,
    preset,
    cropRect,
    format,
    quality,
    background,
    encodableFormats,
    outputUrl,
    outputSizeBytes,
    isCropping,
    error,
    isEmbed,
    embedInput,
    setFile,
    setCropRect,
    selectAll,
    applyCrop,
    download,
    reset,
  };
}
