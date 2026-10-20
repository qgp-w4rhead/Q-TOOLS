/**
 * useImageToSvg - composable + pure logic for the image-to-SVG vectorizer.
 *
 * Traces a raster image into stacked vector paths (one color layer per palette
 * entry) using imagetracerjs (Unlicense). The result is a real SVG: it scales
 * to any size without pixelation, and can also be re-rasterised to PNG at an
 * arbitrary multiplier to demonstrate "infinite" upscaling.
 *
 * Everything runs locally in the browser - the file never leaves the device.
 * Pure helpers have no Vue dependency and can be imported standalone.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import ImageTracer, {
  type TraceOptions,
  type TracedData,
} from 'imagetracerjs';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  canvasToBlob,
  drawToCanvas,
  loadImageFromBlob,
} from '@/utils/image';
import { downloadBlob, outputName, stripExtension } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** Curated imagetracerjs option presets exposed in the UI. */
export const TRACE_PRESETS = [
  'default',
  'detailed',
  'smoothed',
  'curvy',
  'sharp',
  'posterized3',
  'grayscale',
] as const;
export type TracePreset = (typeof TRACE_PRESETS)[number];

/** Max trace dimensions (px). `0` = trace at full source resolution. */
export const TRACE_SIZES: readonly number[] = [128, 256, 512, 1024, 2048, 0];
/** Multipliers applied to the SVG coordinate space. */
export const OUTPUT_SCALES: readonly number[] = [1, 2, 4, 8];
/** Multipliers offered for the raster PNG re-export. */
export const PNG_SCALES: readonly number[] = [1, 2, 4, 8, 16];

export const DEFAULT_PRESET: TracePreset = 'default';
export const DEFAULT_COLORS = 16;
export const MIN_COLORS = 2;
export const MAX_COLORS = 32;
export const DEFAULT_DETAIL = 3;
export const MIN_DETAIL = 1;
export const MAX_DETAIL = 5;
export const DEFAULT_NOISE = 8;
export const MAX_NOISE = 64;
export const DEFAULT_SMOOTHING = 0;
export const MAX_SMOOTHING = 5;
export const DEFAULT_TRACE_SIZE = 512;
export const DEFAULT_OUTPUT_SCALE = 1;
export const DEFAULT_PNG_SCALE = 4;

/** Curve-fitting error threshold (ltres/qtres) per detail level 1-5. */
const DETAIL_THRESHOLDS: readonly number[] = [8, 3, 1, 0.4, 0.1];

export interface TraceControls {
  preset: TracePreset;
  /** Palette size passed to the color quantizer. */
  colors: number;
  /** Curve-fitting detail 1-5 (higher = tighter fit = more segments). */
  detail: number;
  /** Paths shorter than this many edge points are discarded. */
  noise: number;
  /** Pre-trace Gaussian-ish blur radius in px (smooths jagged input). */
  smoothing: number;
  /** Cap on the traced raster size; `0` traces the full source. */
  traceSize: number;
  /** Multiplies every emitted coordinate (SVG output units). */
  scale: number;
  /** imagetracerjs `linefilter` noise reduction toggle. */
  lineFilter: boolean;
}

export interface VectorizedInfo {
  svg: string;
  blob: Blob;
  objectUrl: string;
  sizeBytes: number;
  pathCount: number;
  paletteColors: number;
  /** Raster dimensions that were traced (before `scale`). */
  traceWidth: number;
  traceHeight: number;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Map a 1-5 detail level to an ltres/qtres error threshold. */
export function detailToError(detail: number): number {
  const idx = clampInt(detail, MIN_DETAIL, MAX_DETAIL) - 1;
  return DETAIL_THRESHOLDS[idx] ?? 1;
}

/** Fit `w×h` inside `maxDim` while preserving aspect ratio (`0` = no cap). */
export function fitWithin(
  w: number,
  h: number,
  maxDim: number,
): { width: number; height: number } {
  if (maxDim <= 0) return { width: Math.max(1, w), height: Math.max(1, h) };
  const s = Math.min(1, maxDim / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * s)),
    height: Math.max(1, Math.round(h * s)),
  };
}

/**
 * Merge a named imagetracerjs preset with the tool's explicit controls.
 * `pal` is stripped: presets like `posterized3` pin a fixed palette which
 * would silently override the user's Colors slider.
 */
export function buildTraceOptions(c: TraceControls): TraceOptions {
  const base: TraceOptions = {
    ...(ImageTracer.optionpresets[c.preset] ?? {}),
  };
  delete base.pal;
  const err = detailToError(c.detail);
  return {
    ...base,
    ltres: err,
    qtres: err,
    pathomit: clampInt(c.noise, 0, 256),
    numberofcolors: clampInt(c.colors, MIN_COLORS, 256),
    blurradius: clampInt(c.smoothing, 0, 10),
    linefilter: c.lineFilter,
    scale: c.scale > 0 ? c.scale : 1,
    roundcoords: 1,
    viewbox: false,
    desc: false,
  };
}

/** Count renderable (non-hole) paths across all traced color layers. */
export function countTracedPaths(td: TracedData): number {
  return td.layers.reduce(
    (n, layer) => n + layer.filter((p) => !p.isholepath).length,
    0,
  );
}

/**
 * imagetracerjs emits `viewBox` XOR `width/height` (we request width/height so
 * the SVG keeps an intrinsic size for raster re-export). Inject a matching
 * viewBox so the markup also scales cleanly when embedded.
 */
export function injectViewBox(svg: string, width: number, height: number): string {
  return svg.replace(
    '<svg ',
    `<svg viewBox="0 0 ${round1(width)} ${round1(height)}" `,
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Trace an already-decoded image to SVG markup. Returns the SVG string plus
 * the tracedata (for stats) and the raster dims that were actually traced.
 */
export function traceImage(
  img: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  controls: TraceControls,
): { svg: string; tracedata: TracedData; width: number; height: number } {
  const { width, height } = fitWithin(srcWidth, srcHeight, controls.traceSize);
  const canvas = drawToCanvas(img, width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available.');
  const imgd = ctx.getImageData(0, 0, width, height);
  const options = buildTraceOptions(controls);
  const tracedata = ImageTracer.imagedataToTracedata(imgd, options);
  const scale = options.scale ?? 1;
  const svg = injectViewBox(
    ImageTracer.getsvgstring(tracedata, options),
    width * scale,
    height * scale,
  );
  return { svg, tracedata, width, height };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseImageToSvgReturn {
  sourceName: Ref<string>;
  sourceSizeBytes: Ref<number>;
  sourceWidth: Ref<number>;
  sourceHeight: Ref<number>;
  sourceUrl: Ref<string | null>;
  hasSource: Ref<boolean>;
  preset: Ref<TracePreset>;
  colors: Ref<number>;
  detail: Ref<number>;
  noise: Ref<number>;
  smoothing: Ref<number>;
  traceSize: Ref<number>;
  scale: Ref<number>;
  lineFilter: Ref<boolean>;
  pngScale: Ref<number>;
  traced: Ref<VectorizedInfo | null>;
  isTracing: Ref<boolean>;
  isExporting: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  vectorize: () => Promise<void>;
  downloadSvg: () => void;
  exportPng: () => Promise<void>;
  reset: () => void;
}

export function useImageToSvg(): UseImageToSvgReturn {
  const sourceName = ref<string>('');
  const sourceSizeBytes = ref<number>(0);
  const sourceWidth = ref<number>(0);
  const sourceHeight = ref<number>(0);
  const sourceUrl = ref<string | null>(null);
  const hasSource = ref<boolean>(false);

  const preset = ref<TracePreset>(DEFAULT_PRESET);
  const colors = ref<number>(DEFAULT_COLORS);
  const detail = ref<number>(DEFAULT_DETAIL);
  const noise = ref<number>(DEFAULT_NOISE);
  const smoothing = ref<number>(DEFAULT_SMOOTHING);
  const traceSize = ref<number>(DEFAULT_TRACE_SIZE);
  const scale = ref<number>(DEFAULT_OUTPUT_SCALE);
  const lineFilter = ref<boolean>(false);
  const pngScale = ref<number>(DEFAULT_PNG_SCALE);

  const traced = ref<VectorizedInfo | null>(null);
  const isTracing = ref<boolean>(false);
  const isExporting = ref<boolean>(false);
  const error = ref<string | null>(null);

  let sourceImg: HTMLImageElement | null = null;

  function clearTraced(): void {
    if (traced.value) {
      URL.revokeObjectURL(traced.value.objectUrl);
      traced.value = null;
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
    clearTraced();
    clearSource();
    try {
      const { img, url } = await loadImageFromBlob(file);
      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(url);
        error.value = 'This image has no intrinsic size to trace.';
        return;
      }
      sourceImg = img;
      sourceUrl.value = url;
      sourceName.value = file.name || 'image';
      sourceSizeBytes.value = file.size;
      sourceWidth.value = img.naturalWidth;
      sourceHeight.value = img.naturalHeight;
      hasSource.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  function controlsSnapshot(): TraceControls {
    return {
      preset: preset.value,
      colors: colors.value,
      detail: detail.value,
      noise: noise.value,
      smoothing: smoothing.value,
      traceSize: traceSize.value,
      scale: scale.value,
      lineFilter: lineFilter.value,
    };
  }

  async function vectorize(): Promise<void> {
    error.value = null;
    const img = sourceImg;
    if (!img || !hasSource.value) {
      error.value = 'Load an image first.';
      return;
    }
    isTracing.value = true;
    clearTraced();
    try {
      // Let the UI paint the busy state before the synchronous trace blocks.
      await new Promise((r) => setTimeout(r, 20));
      const { svg, tracedata, width, height } = traceImage(
        img,
        img.naturalWidth,
        img.naturalHeight,
        controlsSnapshot(),
      );
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      traced.value = {
        svg,
        blob,
        objectUrl: URL.createObjectURL(blob),
        sizeBytes: blob.size,
        pathCount: countTracedPaths(tracedata),
        paletteColors: tracedata.palette.length,
        traceWidth: width,
        traceHeight: height,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Vectorization failed.';
    } finally {
      isTracing.value = false;
    }
  }

  function downloadSvg(): void {
    const out = traced.value;
    if (!out) return;
    downloadBlob(out.blob, outputName(stripExtension(sourceName.value), 'svg', '-vector'));
  }

  /** Re-rasterise the traced SVG to PNG at `pngScale` - proves infinite scaling. */
  async function exportPng(): Promise<void> {
    error.value = null;
    const out = traced.value;
    if (!out) {
      error.value = 'Vectorize an image first.';
      return;
    }
    isExporting.value = true;
    try {
      const s = pngScale.value > 0 ? pngScale.value : 1;
      const { img, url } = await loadImageFromBlob(out.blob);
      try {
        const canvas = drawToCanvas(
          img,
          img.naturalWidth * s,
          img.naturalHeight * s,
        );
        const blob = await canvasToBlob(canvas, 'image/png');
        downloadBlob(
          blob,
          outputName(stripExtension(sourceName.value), 'png', `-vector@${s}x`),
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'PNG export failed.';
    } finally {
      isExporting.value = false;
    }
  }

  function reset(): void {
    clearTraced();
    clearSource();
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.preset === 'string' && (TRACE_PRESETS as readonly string[]).includes(p.preset)) {
        preset.value = p.preset as TracePreset;
      }
      if (typeof p.colors === 'number') colors.value = p.colors;
      if (typeof p.detail === 'number') detail.value = p.detail;
      if (typeof p.noise === 'number') noise.value = p.noise;
      if (typeof p.smoothing === 'number') smoothing.value = p.smoothing;
      if (typeof p.traceSize === 'number') traceSize.value = p.traceSize;
      if (typeof p.scale === 'number') scale.value = p.scale;
      if (typeof p.lineFilter === 'boolean') lineFilter.value = p.lineFilter;
      if (typeof p.pngScale === 'number') pngScale.value = p.pngScale;
      if (p.action === 'vectorize') void vectorize();
      if (p.action === 'reset') reset();
    },
  });

  watch(
    [hasSource, traced, isTracing, preset, colors, detail, error],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        hasSource: hasSource.value,
        sourceName: sourceName.value,
        sourceSizeBytes: sourceSizeBytes.value,
        preset: preset.value,
        colors: colors.value,
        detail: detail.value,
        vectorized: Boolean(traced.value),
        svgSizeBytes: traced.value?.sizeBytes,
        pathCount: traced.value?.pathCount,
        paletteColors: traced.value?.paletteColors,
        isTracing: isTracing.value,
        error: error.value ?? undefined,
      });
    },
  );

  onBeforeUnmount(() => {
    clearTraced();
    clearSource();
  });

  return {
    sourceName,
    sourceSizeBytes,
    sourceWidth,
    sourceHeight,
    sourceUrl,
    hasSource,
    preset,
    colors,
    detail,
    noise,
    smoothing,
    traceSize,
    scale,
    lineFilter,
    pngScale,
    traced,
    isTracing,
    isExporting,
    error,
    isEmbed,
    embedInput,
    setFile,
    vectorize,
    downloadSvg,
    exportPng,
    reset,
  };
}
