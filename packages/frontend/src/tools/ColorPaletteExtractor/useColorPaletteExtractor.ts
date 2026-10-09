/**
 * useColorPaletteExtractor - composable + pure logic for the color palette
 * extractor tool.
 *
 * Extracts the dominant colors from an uploaded image via median-cut
 * quantization over the image's (downscaled) pixel data. Exports the
 * palette as HEX, RGB, CSS variables, Tailwind config, or JSON.
 *
 * No external dependencies - everything runs locally in the browser.
 * Pure helpers (`medianCut`, `rgbToHex`, `buildExport`, …) have no Vue
 * dependency and can be imported standalone.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import { getPixelData, loadImageFromBlob } from '@/utils/image';
import { formatBytes } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface PaletteColor extends Rgb {
  /** Share of sampled pixels in this bucket (0-1). */
  weight: number;
}

export type ExportFormat = 'hex' | 'rgb' | 'css' | 'tailwind' | 'json';

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  'hex',
  'rgb',
  'css',
  'tailwind',
  'json',
] as const;

export const DEFAULT_COLOR_COUNT = 6;
export const MAX_COLOR_COUNT = 12;
export const MIN_COLOR_COUNT = 2;

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** Convert an RGB triplet to `#rrggbb`. */
export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Convert an RGB triplet to `rgb(r, g, b)`. */
export function rgbToCss({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Convert an RGB triplet to `hsl(h, s%, l%)`. */
export function rgbToHsl({ r, g, b }: Rgb): string {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return `hsl(0, 0%, ${Math.round(l * 100)}%)`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

/** Relative luminance (WCAG) - used to pick readable text on swatches. */
export function luminance({ r, g, b }: Rgb): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Pick `#000`/`#fff` text for a swatch background. */
export function textOn(color: Rgb): string {
  return luminance(color) > 0.35 ? '#000000' : '#ffffff';
}

interface Bucket {
  pixels: Rgb[];
  weight: number;
}

function averageColor(bucket: Bucket): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of bucket.pixels) {
    r += p.r;
    g += p.g;
    b += p.b;
  }
  const n = Math.max(1, bucket.pixels.length);
  return { r: r / n, g: g / n, b: b / n };
}

function channelRange(bucket: Bucket, ch: 'r' | 'g' | 'b'): number {
  let min = 255;
  let max = 0;
  for (const p of bucket.pixels) {
    const v = p[ch];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

/**
 * Median-cut quantization: repeatedly split the bucket with the widest
 * channel range at its median until `count` buckets remain, then average
 * each bucket. Returns colors sorted by descending weight.
 */
export function medianCut(pixels: Rgb[], count: number): PaletteColor[] {
  if (pixels.length === 0) return [];
  const total = pixels.length;
  let buckets: Bucket[] = [{ pixels, weight: 1 }];
  while (buckets.length < count) {
    // Split the bucket with the largest channel range.
    let bestIdx = -1;
    let bestRange = -1;
    let bestCh: 'r' | 'g' | 'b' = 'r';
    buckets.forEach((b, i) => {
      if (b.pixels.length < 2) return;
      for (const ch of ['r', 'g', 'b'] as const) {
        const range = channelRange(b, ch);
        if (range > bestRange) {
          bestRange = range;
          bestIdx = i;
          bestCh = ch;
        }
      }
    });
    if (bestIdx === -1) break; // nothing left to split
    const bucket = buckets[bestIdx];
    if (!bucket) break;
    const sorted = [...bucket.pixels].sort((a, b2) => a[bestCh] - b2[bestCh]);
    const mid = Math.floor(sorted.length / 2);
    const a: Bucket = { pixels: sorted.slice(0, mid), weight: 0 };
    const b: Bucket = { pixels: sorted.slice(mid), weight: 0 };
    buckets.splice(bestIdx, 1, a, b);
  }
  buckets = buckets.filter((b) => b.pixels.length > 0);
  return buckets
    .map((b) => ({ ...averageColor(b), weight: b.pixels.length / total }))
    .sort((x, y) => y.weight - x.weight);
}

/** Build the export text for a palette in the requested format. */
export function buildExport(colors: PaletteColor[], format: ExportFormat): string {
  switch (format) {
    case 'hex':
      return colors.map((c) => rgbToHex(c)).join('\n');
    case 'rgb':
      return colors.map((c) => rgbToCss(c)).join('\n');
    case 'css':
      return [
        ':root {',
        ...colors.map((c, i) => `  --color-${i + 1}: ${rgbToHex(c)};`),
        '}',
      ].join('\n');
    case 'tailwind':
      return [
        '// tailwind.config.js',
        'module.exports = {',
        '  theme: {',
        '    extend: {',
        '      colors: {',
        ...colors.map(
          (c, i) => `        'palette-${i + 1}': '${rgbToHex(c)}',`,
        ),
        '      },',
        '    },',
        '  },',
        '};',
      ].join('\n');
    case 'json':
      return JSON.stringify(
        colors.map((c) => ({
          hex: rgbToHex(c),
          rgb: { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) },
          weight: Math.round(c.weight * 1000) / 1000,
        })),
        null,
        2,
      );
    default:
      return '';
  }
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseColorPaletteExtractorReturn {
  fileName: Ref<string>;
  fileSizeBytes: Ref<number>;
  previewUrl: Ref<string | null>;
  hasFile: Ref<boolean>;
  colorCount: Ref<number>;
  colors: Ref<PaletteColor[]>;
  exportFormat: Ref<ExportFormat>;
  isExtracting: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  extract: () => Promise<void>;
  reset: () => void;
}

export function useColorPaletteExtractor(): UseColorPaletteExtractorReturn {
  const fileName = ref<string>('');
  const fileSizeBytes = ref<number>(0);
  const previewUrl = ref<string | null>(null);
  const hasFile = ref<boolean>(false);
  const colorCount = ref<number>(DEFAULT_COLOR_COUNT);
  const colors = ref<PaletteColor[]>([]);
  const exportFormat = ref<ExportFormat>('hex');
  const isExtracting = ref<boolean>(false);
  const error = ref<string | null>(null);

  let sourceImg: HTMLImageElement | null = null;

  function clear(): void {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    if (sourceImg) URL.revokeObjectURL(sourceImg.src);
    previewUrl.value = null;
    sourceImg = null;
    hasFile.value = false;
    colors.value = [];
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
      await extract();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  async function extract(): Promise<void> {
    error.value = null;
    const img = sourceImg;
    if (!img || !hasFile.value) {
      error.value = 'Load an image first.';
      return;
    }
    isExtracting.value = true;
    try {
      const px = getPixelData(img, img.naturalWidth, img.naturalHeight, 256);
      if (!px) throw new Error('Could not read pixel data.');
      const pixels: Rgb[] = [];
      for (let i = 0; i < px.data.length; i += 4) {
        const a = px.data[i + 3] ?? 255;
        if (a < 128) continue; // skip transparent pixels
        pixels.push({
          r: px.data[i] ?? 0,
          g: px.data[i + 1] ?? 0,
          b: px.data[i + 2] ?? 0,
        });
      }
      const n = Math.min(MAX_COLOR_COUNT, Math.max(MIN_COLOR_COUNT, Math.round(colorCount.value)));
      colors.value = medianCut(pixels, n);
      if (colors.value.length === 0) error.value = 'No opaque pixels found in the image.';
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Extraction failed.';
    } finally {
      isExtracting.value = false;
    }
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
      if (typeof p.colorCount === 'number') {
        colorCount.value = Math.min(MAX_COLOR_COUNT, Math.max(MIN_COLOR_COUNT, p.colorCount));
      }
      if (typeof p.exportFormat === 'string' && (EXPORT_FORMATS as readonly string[]).includes(p.exportFormat)) {
        exportFormat.value = p.exportFormat as ExportFormat;
      }
      if (p.action === 'extract') void extract();
      if (p.action === 'reset') reset();
    },
  });

  watch([hasFile, colors, colorCount, exportFormat, isExtracting, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      hasFile: hasFile.value,
      fileName: fileName.value,
      colorCount: colorCount.value,
      colors: colors.value.map((c) => rgbToHex(c)),
      exportFormat: exportFormat.value,
      export: buildExport(colors.value, exportFormat.value) || undefined,
      isExtracting: isExtracting.value,
      error: error.value ?? undefined,
    });
  });

  onBeforeUnmount(reset);

  return {
    fileName,
    fileSizeBytes,
    previewUrl,
    hasFile,
    colorCount,
    colors,
    exportFormat,
    isExtracting,
    error,
    isEmbed,
    embedInput,
    setFile,
    extract,
    reset,
  };
}

export { formatBytes };
