/**
 * useImageRedactor - composable + pure logic for the image redactor tool.
 *
 * Draw rectangles over an image to blur, pixelate, or black-out regions -
 * doubles as a privacy tool (faces, license plates, text). Regions are
 * stored in image pixel coordinates; the component owns the display canvas
 * and pointer events, translating screen → image coords via the rendered
 * scale. Everything runs locally in the browser.
 *
 * Pure helpers (`normalizeRect`, `clampRect`, `applyRedaction`) have no Vue
 * dependency and can be imported standalone.
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

/** A redaction region in image pixel coordinates. */
export interface RedactRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RedactMode = 'blur' | 'pixelate' | 'solid';

export const REDACT_MODES: readonly RedactMode[] = ['blur', 'pixelate', 'solid'] as const;
export const DEFAULT_MODE: RedactMode = 'pixelate';
export const DEFAULT_STRENGTH = 12; // pixel block size / blur radius
export const MIN_STRENGTH = 2;
export const MAX_STRENGTH = 64;

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** Normalise a rect so width/height are positive (drag direction agnostic). */
export function normalizeRect(r: RedactRect): RedactRect {
  return {
    x: r.width < 0 ? r.x + r.width : r.x,
    y: r.height < 0 ? r.y + r.height : r.y,
    width: Math.abs(r.width),
    height: Math.abs(r.height),
  };
}

/** Clamp a rect to lie fully inside `bounds` (an image's w×h). */
export function clampRect(r: RedactRect, boundsW: number, boundsH: number): RedactRect {
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

/** `true` when a rect is large enough to redact (>= 2×2 px). */
export function isUsableRect(r: RedactRect | null): boolean {
  return !!r && r.width >= 2 && r.height >= 2;
}

/**
 * Apply a redaction to a canvas region.
 * - `pixelate`: downscale the region to `strength`-sized blocks and draw it
 *   back with smoothing off.
 * - `blur`: redraw the region through a `ctx.filter = blur(Npx)` pass.
 * - `solid`: fill the region with black.
 */
export function applyRedaction(
  canvas: HTMLCanvasElement,
  rect: RedactRect,
  mode: RedactMode,
  strength: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const r = clampRect(rect, canvas.width, canvas.height);
  if (!isUsableRect(r)) return;
  const s = Math.max(MIN_STRENGTH, Math.min(MAX_STRENGTH, Math.round(strength)));

  if (mode === 'solid') {
    ctx.fillStyle = '#000';
    ctx.fillRect(r.x, r.y, r.width, r.height);
    return;
  }

  if (mode === 'blur') {
    // Draw the region onto a temp canvas, then back through a blur filter.
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(r.width);
    tmp.height = Math.round(r.height);
    const tctx = tmp.getContext('2d');
    if (!tctx) return;
    tctx.drawImage(canvas, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
    ctx.save();
    ctx.filter = `blur(${s}px)`;
    ctx.drawImage(tmp, r.x, r.y, r.width, r.height);
    ctx.restore();
    return;
  }

  // pixelate: shrink to blocks then upscale with smoothing off.
  const bw = Math.max(1, Math.round(r.width / s));
  const bh = Math.max(1, Math.round(r.height / s));
  const tmp = document.createElement('canvas');
  tmp.width = bw;
  tmp.height = bh;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  tctx.drawImage(canvas, r.x, r.y, r.width, r.height, 0, 0, bw, bh);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, bw, bh, r.x, r.y, r.width, r.height);
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseImageRedactorReturn {
  hasImage: Ref<boolean>;
  imageUrl: Ref<string | null>;
  imageName: Ref<string>;
  imageWidth: Ref<number>;
  imageHeight: Ref<number>;
  mode: Ref<RedactMode>;
  strength: Ref<number>;
  regions: Ref<RedactRect[]>;
  /** In-progress drag rect (not yet committed). */
  draftRect: Ref<RedactRect | null>;
  format: Ref<RasterFormat>;
  quality: Ref<number>;
  background: Ref<string>;
  encodableFormats: Ref<RasterFormat[]>;
  outputUrl: Ref<string | null>;
  outputSizeBytes: Ref<number>;
  isApplying: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  setDraft: (rect: RedactRect | null) => void;
  commitDraft: () => void;
  undoLast: () => void;
  clearRegions: () => void;
  apply: () => Promise<void>;
  download: () => void;
  reset: () => void;
}

export function useImageRedactor(): UseImageRedactorReturn {
  const hasImage = ref<boolean>(false);
  const imageUrl = ref<string | null>(null);
  const imageName = ref<string>('');
  const imageWidth = ref<number>(0);
  const imageHeight = ref<number>(0);
  const mode = ref<RedactMode>(DEFAULT_MODE);
  const strength = ref<number>(DEFAULT_STRENGTH);
  const regions = ref<RedactRect[]>([]);
  const draftRect = ref<RedactRect | null>(null);
  const format = ref<RasterFormat>('png');
  const quality = ref<number>(0.92);
  const background = ref<string>('#ffffff');
  const encodableFormats = ref<RasterFormat[]>(['png', 'jpeg', 'webp']);
  const outputUrl = ref<string | null>(null);
  const outputSizeBytes = ref<number>(0);
  const isApplying = ref<boolean>(false);
  const error = ref<string | null>(null);

  let sourceImg: HTMLImageElement | null = null;
  let outputBlob: Blob | null = null;

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
    outputBlob = null;
  }

  function clearImage(): void {
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
    if (sourceImg) URL.revokeObjectURL(sourceImg.src);
    imageUrl.value = null;
    sourceImg = null;
    hasImage.value = false;
    regions.value = [];
    draftRect.value = null;
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
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  function setDraft(rect: RedactRect | null): void {
    if (!rect) {
      draftRect.value = null;
      return;
    }
    draftRect.value = clampRect(rect, imageWidth.value, imageHeight.value);
  }

  function commitDraft(): void {
    const d = draftRect.value;
    if (isUsableRect(d)) {
      regions.value = [...regions.value, normalizeRect(d!)];
    }
    draftRect.value = null;
  }

  function undoLast(): void {
    regions.value = regions.value.slice(0, -1);
  }

  function clearRegions(): void {
    regions.value = [];
    draftRect.value = null;
  }

  async function apply(): Promise<void> {
    error.value = null;
    const img = sourceImg;
    if (!img || !hasImage.value) {
      error.value = 'Load an image first.';
      return;
    }
    if (regions.value.length === 0) {
      error.value = 'Draw at least one region to redact.';
      return;
    }
    const fmt = format.value;
    if (!encodableFormats.value.includes(fmt)) {
      error.value = `${fmt.toUpperCase()} encoding is not supported by this browser.`;
      return;
    }
    isApplying.value = true;
    clearOutput();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context is not available.');
      if (!formatSupportsAlpha(fmt)) {
        ctx.fillStyle = background.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      for (const r of regions.value) {
        applyRedaction(canvas, r, mode.value, strength.value);
      }
      const q = formatSupportsQuality(fmt)
        ? Math.min(1, Math.max(0.01, quality.value))
        : undefined;
      const blob = await canvasToBlob(canvas, mimeForFormat(fmt), q);
      outputBlob = blob;
      outputUrl.value = URL.createObjectURL(blob);
      outputSizeBytes.value = blob.size;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Redaction failed.';
    } finally {
      isApplying.value = false;
    }
  }

  function download(): void {
    if (!outputBlob) return;
    const ext = extensionForFormat(format.value);
    downloadBlob(outputBlob, outputName(stripExtension(imageName.value), ext, '-redacted'));
  }

  function reset(): void {
    clearOutput();
    clearImage();
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mode === 'string' && (REDACT_MODES as readonly string[]).includes(p.mode)) {
        mode.value = p.mode as RedactMode;
      }
      if (typeof p.strength === 'number') {
        strength.value = Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, Math.round(p.strength)));
      }
      if (typeof p.format === 'string' && ['png', 'jpeg', 'webp', 'avif'].includes(p.format)) {
        format.value = p.format as RasterFormat;
      }
      if (p.action === 'apply') void apply();
      if (p.action === 'undo') undoLast();
      if (p.action === 'clear-regions') clearRegions();
      if (p.action === 'reset') reset();
    },
  });

  watch(
    [hasImage, regions, outputUrl, isApplying, mode, strength, format, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        hasImage: hasImage.value,
        imageName: imageName.value,
        imageWidth: imageWidth.value,
        imageHeight: imageHeight.value,
        mode: mode.value,
        strength: strength.value,
        regionCount: regions.value.length,
        hasOutput: !!outputUrl.value,
        outputSizeBytes: outputSizeBytes.value,
        isApplying: isApplying.value,
        error: error.value ?? undefined,
      });
    },
    { deep: true },
  );

  onBeforeUnmount(reset);

  return {
    hasImage,
    imageUrl,
    imageName,
    imageWidth,
    imageHeight,
    mode,
    strength,
    regions,
    draftRect,
    format,
    quality,
    background,
    encodableFormats,
    outputUrl,
    outputSizeBytes,
    isApplying,
    error,
    isEmbed,
    embedInput,
    setFile,
    setDraft,
    commitDraft,
    undoLast,
    clearRegions,
    apply,
    download,
    reset,
  };
}
