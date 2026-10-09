/**
 * useImageResizer - composable + pure logic for the image resizer tool.
 *
 * Scales one or more uploaded images by pixels or percent, with an
 * aspect-ratio lock, and re-encodes via the Canvas 2D `toBlob()` encoder.
 * Batch export downloads each resized image individually (no zip dep).
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

export type ResizeMode = 'pixels' | 'percent';

export interface ResizeItem {
  id: number;
  name: string;
  inputSizeBytes: number;
  srcWidth: number;
  srcHeight: number;
  /** Object URL of the source for preview. */
  sourceUrl: string;
  /** Set after `resizeAll()` runs. */
  outputUrl: string | null;
  outputSizeBytes: number;
  outWidth: number;
  outHeight: number;
  blob: Blob | null;
  error: string | null;
}

export const DEFAULT_MODE: ResizeMode = 'percent';
export const DEFAULT_PERCENT = 50;
export const DEFAULT_WIDTH = 800;
export const DEFAULT_HEIGHT = 600;
export const MAX_DIMENSION = 16384;

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Compute output dimensions for a source image.
 * - `percent` mode: `percent` scales both axes.
 * - `pixels` mode: `width`/`height` are targets; when `lockAspect` is on the
 *   non-edited axis is derived from the source ratio (pass `null` for the
 *   axis to derive).
 */
export function computeOutputSize(
  srcWidth: number,
  srcHeight: number,
  mode: ResizeMode,
  opts: { percent?: number; width?: number | null; height?: number | null; lockAspect?: boolean },
): { width: number; height: number } {
  const sw = Math.max(1, srcWidth);
  const sh = Math.max(1, srcHeight);
  if (mode === 'percent') {
    const p = Math.max(1, opts.percent ?? 100) / 100;
    return {
      width: Math.min(MAX_DIMENSION, Math.max(1, Math.round(sw * p))),
      height: Math.min(MAX_DIMENSION, Math.max(1, Math.round(sh * p))),
    };
  }
  const ratio = sw / sh;
  let w = opts.width ?? null;
  let h = opts.height ?? null;
  if (opts.lockAspect !== false) {
    if (w !== null && w > 0) h = Math.max(1, Math.round(w / ratio));
    else if (h !== null && h > 0) w = Math.max(1, Math.round(h * ratio));
    else {
      w = sw;
      h = sh;
    }
  }
  w = Math.min(MAX_DIMENSION, Math.max(1, Math.round(w ?? sw)));
  h = Math.min(MAX_DIMENSION, Math.max(1, Math.round(h ?? sh)));
  return { width: w, height: h };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseImageResizerReturn {
  items: Ref<ResizeItem[]>;
  mode: Ref<ResizeMode>;
  percent: Ref<number>;
  width: Ref<number>;
  height: Ref<number>;
  lockAspect: Ref<boolean>;
  format: Ref<RasterFormat>;
  quality: Ref<number>;
  background: Ref<string>;
  encodableFormats: Ref<RasterFormat[]>;
  isResizing: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  addFiles: (files: File[]) => Promise<void>;
  removeItem: (id: number) => void;
  resizeAll: () => Promise<void>;
  downloadItem: (id: number) => void;
  downloadAll: () => void;
  reset: () => void;
}

let nextId = 1;

export function useImageResizer(): UseImageResizerReturn {
  const items = ref<ResizeItem[]>([]);
  const mode = ref<ResizeMode>(DEFAULT_MODE);
  const percent = ref<number>(DEFAULT_PERCENT);
  const width = ref<number>(DEFAULT_WIDTH);
  const height = ref<number>(DEFAULT_HEIGHT);
  const lockAspect = ref<boolean>(true);
  const format = ref<RasterFormat>('png');
  const quality = ref<number>(0.9);
  const background = ref<string>('#ffffff');
  const encodableFormats = ref<RasterFormat[]>(['png', 'jpeg', 'webp']);
  const isResizing = ref<boolean>(false);
  const error = ref<string | null>(null);

  // Keep decoded images alongside the reactive item list (non-reactive).
  const images = new Map<number, HTMLImageElement>();

  void listEncodableFormats()
    .then((f) => {
      if (f.length > 0) encodableFormats.value = f;
    })
    .catch(() => {
      /* keep defaults */
    });

  async function addFiles(files: File[]): Promise<void> {
    error.value = null;
    for (const file of files) {
      try {
        const { img, url } = await loadImageFromBlob(file);
        const id = nextId++;
        images.set(id, img);
        items.value.push({
          id,
          name: file.name || `image-${id}`,
          inputSizeBytes: file.size,
          srcWidth: img.naturalWidth,
          srcHeight: img.naturalHeight,
          sourceUrl: url,
          outputUrl: null,
          outputSizeBytes: 0,
          outWidth: 0,
          outHeight: 0,
          blob: null,
          error: null,
        });
      } catch {
        error.value = `Could not decode "${file.name}" - skipped.`;
      }
    }
  }

  function removeItem(id: number): void {
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const item = items.value[idx];
    if (!item) return;
    URL.revokeObjectURL(item.sourceUrl);
    if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    const img = images.get(id);
    if (img) URL.revokeObjectURL(img.src);
    images.delete(id);
    items.value.splice(idx, 1);
  }

  async function resizeAll(): Promise<void> {
    error.value = null;
    if (items.value.length === 0) {
      error.value = 'Add at least one image first.';
      return;
    }
    const fmt = format.value;
    if (!encodableFormats.value.includes(fmt)) {
      error.value = `${fmt.toUpperCase()} encoding is not supported by this browser.`;
      return;
    }
    isResizing.value = true;
    const bg = formatSupportsAlpha(fmt) ? undefined : background.value;
    const q = formatSupportsQuality(fmt)
      ? Math.min(1, Math.max(0.01, quality.value))
      : undefined;
    for (const item of items.value) {
      const img = images.get(item.id);
      if (!img) {
        item.error = 'Source image missing.';
        continue;
      }
      try {
        const dims = computeOutputSize(item.srcWidth, item.srcHeight, mode.value, {
          percent: percent.value,
          width: width.value,
          height: height.value,
          lockAspect: lockAspect.value,
        });
        const canvas = drawToCanvas(img, dims.width, dims.height, bg);
        const blob = await canvasToBlob(canvas, mimeForFormat(fmt), q);
        if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
        item.outputUrl = URL.createObjectURL(blob);
        item.outputSizeBytes = blob.size;
        item.outWidth = dims.width;
        item.outHeight = dims.height;
        item.blob = blob;
        item.error = null;
      } catch (err) {
        item.error = err instanceof Error ? err.message : 'Resize failed.';
      }
    }
    isResizing.value = false;
  }

  function downloadItem(id: number): void {
    const item = items.value.find((i) => i.id === id);
    if (!item?.blob) return;
    const ext = extensionForFormat(format.value);
    downloadBlob(item.blob, outputName(stripExtension(item.name), ext, `-${item.outWidth}x${item.outHeight}`));
  }

  function downloadAll(): void {
    for (const item of items.value) {
      if (item.blob) downloadItem(item.id);
    }
  }

  function reset(): void {
    for (const item of items.value) {
      URL.revokeObjectURL(item.sourceUrl);
      if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
    }
    for (const img of images.values()) URL.revokeObjectURL(img.src);
    images.clear();
    items.value = [];
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.mode === 'pixels' || p.mode === 'percent') mode.value = p.mode;
      if (typeof p.percent === 'number') percent.value = Math.max(1, p.percent);
      if (typeof p.width === 'number') width.value = Math.max(1, Math.round(p.width));
      if (typeof p.height === 'number') height.value = Math.max(1, Math.round(p.height));
      if (typeof p.lockAspect === 'boolean') lockAspect.value = p.lockAspect;
      if (typeof p.format === 'string' && ['png', 'jpeg', 'webp', 'avif'].includes(p.format)) {
        format.value = p.format as RasterFormat;
      }
      if (p.action === 'resize') void resizeAll();
      if (p.action === 'reset') reset();
    },
  });

  watch(
    [items, isResizing, mode, percent, width, height, lockAspect, format, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        count: items.value.length,
        resized: items.value.filter((i) => i.blob !== null).length,
        mode: mode.value,
        percent: percent.value,
        width: width.value,
        height: height.value,
        lockAspect: lockAspect.value,
        format: format.value,
        isResizing: isResizing.value,
        error: error.value ?? undefined,
      });
    },
    { deep: true },
  );

  onBeforeUnmount(reset);

  return {
    items,
    mode,
    percent,
    width,
    height,
    lockAspect,
    format,
    quality,
    background,
    encodableFormats,
    isResizing,
    error,
    isEmbed,
    embedInput,
    addFiles,
    removeItem,
    resizeAll,
    downloadItem,
    downloadAll,
    reset,
  };
}
