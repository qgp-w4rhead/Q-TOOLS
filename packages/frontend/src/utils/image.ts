/**
 * Pure image helpers shared by the Images & Videos tools.
 *
 * No Vue dependency - every function here can be imported standalone for
 * unit testing or reuse. Covers image decoding, canvas rasterisation,
 * canvas→Blob encoding with feature detection, and format↔MIME mapping.
 */

/** Raster formats the tools offer for canvas re-encoding. */
export type RasterFormat = 'png' | 'jpeg' | 'webp' | 'avif';

export const RASTER_FORMATS: readonly RasterFormat[] = [
  'png',
  'jpeg',
  'webp',
  'avif',
] as const;

/** MIME type for a raster format id. */
export function mimeForFormat(format: RasterFormat): string {
  const map: Record<RasterFormat, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    avif: 'image/avif',
  };
  return map[format] ?? 'image/png';
}

/** File extension for a raster format id. */
export function extensionForFormat(format: RasterFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}

/** Raster format for a MIME type, or `null` when not a canvas-encodable type. */
export function formatForMime(mime: string): RasterFormat | null {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpeg';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/avif') return 'avif';
  return null;
}

/** `true` when a format supports a quality parameter (lossy encode). */
export function formatSupportsQuality(format: RasterFormat): boolean {
  return format !== 'png';
}

/** `true` when a format can carry an alpha channel. */
export function formatSupportsAlpha(format: RasterFormat): boolean {
  return format === 'png' || format === 'webp' || format === 'avif';
}

/**
 * Load a `File`/`Blob` into an `HTMLImageElement` via an object URL.
 * The returned image is fully decoded (`img.complete`). The caller owns the
 * object URL - call `URL.revokeObjectURL(img.src)` when done, or use
 * `loadImageFromBlob` which returns the URL alongside the image.
 */
export function loadImageFromBlob(
  blob: Blob,
): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    if (typeof URL === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('Image decoding is not available in this environment.'));
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode the image - unsupported or corrupt file.'));
    };
    img.src = url;
  });
}

/**
 * Draw an image (or video/canvas source) onto a new canvas at the given
 * size, optionally flattening transparency onto a background colour.
 */
export function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  background?: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available.');
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Encode a canvas to a Blob. Wraps the callback-based `canvas.toBlob` in a
 * promise and rejects when the browser returns `null` (unsupported type).
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error(`Encoding to ${mimeType} is not supported by this browser.`));
        },
        mimeType,
        quality,
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Canvas encoding failed.'));
    }
  });
}

/**
 * Feature-detect whether the browser can ENCODE a given MIME type via
 * canvas. Uses a 1×1 probe; result is cached per MIME type.
 */
const encodeSupportCache = new Map<string, Promise<boolean>>();

export function canEncodeType(mimeType: string): Promise<boolean> {
  const cached = encodeSupportCache.get(mimeType);
  if (cached) return cached;
  const probe = (async (): Promise<boolean> => {
    if (typeof document === 'undefined') return false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 1, 1);
      // toDataURL falls back to PNG silently when the type is unsupported -
      // check the returned prefix to detect real support.
      const url = canvas.toDataURL(mimeType);
      return url.startsWith(`data:${mimeType}`);
    } catch {
      return false;
    }
  })();
  encodeSupportCache.set(mimeType, probe);
  return probe;
}

/** Return the subset of `RASTER_FORMATS` the browser can encode. */
export async function listEncodableFormats(): Promise<RasterFormat[]> {
  const checks = await Promise.all(
    RASTER_FORMATS.map(async (f) => ((await canEncodeType(mimeForFormat(f))) ? f : null)),
  );
  return checks.filter((f): f is RasterFormat => f !== null);
}

/** Extract pixel data from a source, downscaled to fit `maxDim`. */
export function getPixelData(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  maxDim = 256,
): { data: Uint8ClampedArray; width: number; height: number } | null {
  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
  const w = Math.max(1, Math.round(srcWidth * scale));
  const h = Math.max(1, Math.round(srcHeight * scale));
  const canvas = drawToCanvas(source, w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    const img = ctx.getImageData(0, 0, w, h);
    return { data: img.data, width: w, height: h };
  } catch {
    return null;
  }
}
