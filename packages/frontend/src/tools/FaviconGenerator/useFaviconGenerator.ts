/**
 * useFaviconGenerator - composable + pure logic for the favicon generator.
 *
 * Takes one PNG (or any decodable image) and produces a full favicon set:
 *   - PNGs at 16/32/48/180/192/512 px
 *   - `favicon.ico` (PNG-in-ICO container, hand-rolled writer - valid for
 *     all modern browsers)
 *   - `site.webmanifest` JSON snippet
 *   - `<link>`/`<meta>` HTML snippet
 *
 * No external dependencies - everything runs locally in the browser.
 * Pure helpers (`buildIco`, `buildManifest`, `buildHtmlSnippet`) have no
 * Vue dependency and can be imported standalone.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import { canvasToBlob, drawToCanvas, loadImageFromBlob } from '@/utils/image';
import { downloadBlob, downloadBytes, stripExtension } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

export interface FaviconSize {
  /** Pixel size (square). */
  size: number;
  /** Output filename, e.g. `favicon-32x32.png` / `apple-touch-icon.png`. */
  fileName: string;
  /** Purpose label shown in the UI. */
  label: string;
  /** Include in the ICO container. */
  inIco: boolean;
  /** Include in the web manifest. */
  inManifest: boolean;
}

export const FAVICON_SIZES: readonly FaviconSize[] = [
  { size: 16, fileName: 'favicon-16x16.png', label: 'Browser tab', inIco: true, inManifest: false },
  { size: 32, fileName: 'favicon-32x32.png', label: 'Browser tab (retina)', inIco: true, inManifest: false },
  { size: 48, fileName: 'favicon-48x48.png', label: 'ICO fallback', inIco: true, inManifest: false },
  { size: 180, fileName: 'apple-touch-icon.png', label: 'Apple touch icon', inIco: false, inManifest: false },
  { size: 192, fileName: 'android-chrome-192x192.png', label: 'Android / PWA', inIco: false, inManifest: true },
  { size: 512, fileName: 'android-chrome-512x512.png', label: 'Android / PWA splash', inIco: false, inManifest: true },
] as const;

export interface GeneratedIcon {
  size: number;
  fileName: string;
  label: string;
  blob: Blob;
  objectUrl: string;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build an ICO container from PNG-encoded images.
 *
 * Layout: ICONDIR (6 bytes) + ICONDIRENTRY[] (16 bytes each) + PNG payloads.
 * PNG-in-ICO is valid for Vista+ and all modern browsers.
 */
export function buildIco(pngs: { size: number; bytes: Uint8Array }[]): Uint8Array {
  const count = pngs.length;
  const headerSize = 6 + count * 16;
  const out = new Uint8Array(headerSize + pngs.reduce((s, p) => s + p.bytes.byteLength, 0));
  const view = new DataView(out.buffer);
  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: 1 = icon
  view.setUint16(4, count, true);
  let offset = headerSize;
  pngs.forEach((p, i) => {
    const e = 6 + i * 16;
    const dim = p.size >= 256 ? 0 : p.size; // 0 encodes 256
    out[e] = dim; // width
    out[e + 1] = dim; // height
    out[e + 2] = 0; // palette colors
    out[e + 3] = 0; // reserved
    view.setUint16(e + 4, 1, true); // color planes
    view.setUint16(e + 6, 32, true); // bits per pixel
    view.setUint32(e + 8, p.bytes.byteLength, true);
    view.setUint32(e + 12, offset, true);
    out.set(p.bytes, offset);
    offset += p.bytes.byteLength;
  });
  return out;
}

/** Build the `site.webmanifest` JSON for the manifest-sized icons. */
export function buildManifest(appName: string, sizes: FaviconSize[]): string {
  const icons = sizes
    .filter((s) => s.inManifest)
    .map((s) => ({
      src: `/${s.fileName}`,
      sizes: `${s.size}x${s.size}`,
      type: 'image/png',
    }));
  return JSON.stringify(
    {
      name: appName || 'My App',
      short_name: appName || 'My App',
      icons,
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
    },
    null,
    2,
  );
}

/** Build the `<head>` HTML snippet referencing the generated files. */
export function buildHtmlSnippet(sizes: FaviconSize[]): string {
  const lines: string[] = ['<link rel="icon" href="/favicon.ico" sizes="any">'];
  for (const s of sizes) {
    if (s.inIco) {
      lines.push(
        `<link rel="icon" type="image/png" sizes="${s.size}x${s.size}" href="/${s.fileName}">`,
      );
    } else if (s.fileName === 'apple-touch-icon.png') {
      lines.push(`<link rel="apple-touch-icon" href="/${s.fileName}">`);
    }
  }
  lines.push('<link rel="manifest" href="/site.webmanifest">');
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseFaviconGeneratorReturn {
  fileName: Ref<string>;
  sourceUrl: Ref<string | null>;
  hasFile: Ref<boolean>;
  imageWidth: Ref<number>;
  imageHeight: Ref<number>;
  appName: Ref<string>;
  icons: Ref<GeneratedIcon[]>;
  icoBlob: Ref<Blob | null>;
  manifestText: Ref<string>;
  htmlSnippet: Ref<string>;
  isGenerating: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  generate: () => Promise<void>;
  downloadIcon: (icon: GeneratedIcon) => void;
  downloadIco: () => void;
  downloadManifest: () => void;
  reset: () => void;
}

export function useFaviconGenerator(): UseFaviconGeneratorReturn {
  const fileName = ref<string>('');
  const sourceUrl = ref<string | null>(null);
  const hasFile = ref<boolean>(false);
  const imageWidth = ref<number>(0);
  const imageHeight = ref<number>(0);
  const appName = ref<string>('My App');
  const icons = ref<GeneratedIcon[]>([]);
  const icoBlob = ref<Blob | null>(null);
  const manifestText = ref<string>('');
  const htmlSnippet = ref<string>('');
  const isGenerating = ref<boolean>(false);
  const error = ref<string | null>(null);

  let sourceImg: HTMLImageElement | null = null;

  function clearGenerated(): void {
    for (const icon of icons.value) URL.revokeObjectURL(icon.objectUrl);
    icons.value = [];
    icoBlob.value = null;
    manifestText.value = '';
    htmlSnippet.value = '';
  }

  function clearSource(): void {
    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
    if (sourceImg) URL.revokeObjectURL(sourceImg.src);
    sourceUrl.value = null;
    sourceImg = null;
    hasFile.value = false;
  }

  async function setFile(file: File): Promise<void> {
    error.value = null;
    clearGenerated();
    clearSource();
    try {
      const { img, url } = await loadImageFromBlob(file);
      sourceImg = img;
      sourceUrl.value = url;
      fileName.value = file.name || 'image';
      imageWidth.value = img.naturalWidth;
      imageHeight.value = img.naturalHeight;
      hasFile.value = true;
      const base = stripExtension(file.name || '');
      if (base) appName.value = base;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load the image.';
    }
  }

  async function generate(): Promise<void> {
    error.value = null;
    const img = sourceImg;
    if (!img || !hasFile.value) {
      error.value = 'Load an image first.';
      return;
    }
    isGenerating.value = true;
    clearGenerated();
    try {
      const generated: GeneratedIcon[] = [];
      const icoParts: { size: number; bytes: Uint8Array }[] = [];
      for (const spec of FAVICON_SIZES) {
        const canvas = drawToCanvas(img, spec.size, spec.size);
        const blob = await canvasToBlob(canvas, 'image/png');
        generated.push({
          size: spec.size,
          fileName: spec.fileName,
          label: spec.label,
          blob,
          objectUrl: URL.createObjectURL(blob),
        });
        if (spec.inIco) {
          icoParts.push({ size: spec.size, bytes: new Uint8Array(await blob.arrayBuffer()) });
        }
      }
      icons.value = generated;
      icoBlob.value = new Blob([buildIco(icoParts).slice().buffer as ArrayBuffer], {
        type: 'image/x-icon',
      });
      manifestText.value = buildManifest(appName.value, [...FAVICON_SIZES]);
      htmlSnippet.value = buildHtmlSnippet([...FAVICON_SIZES]);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Generation failed.';
    } finally {
      isGenerating.value = false;
    }
  }

  function downloadIcon(icon: GeneratedIcon): void {
    downloadBlob(icon.blob, icon.fileName);
  }

  function downloadIco(): void {
    if (icoBlob.value) downloadBlob(icoBlob.value, 'favicon.ico');
  }

  function downloadManifest(): void {
    if (!manifestText.value) return;
    downloadBytes(new TextEncoder().encode(manifestText.value), 'site.webmanifest', 'application/manifest+json');
  }

  function reset(): void {
    clearGenerated();
    clearSource();
    error.value = null;
  }

  /* ----------------------------- embed I/O ------------------------------ */

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.appName === 'string') appName.value = p.appName;
      if (p.action === 'generate') void generate();
      if (p.action === 'reset') reset();
    },
  });

  watch([hasFile, icons, isGenerating, appName, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      hasFile: hasFile.value,
      fileName: fileName.value,
      appName: appName.value,
      iconCount: icons.value.length,
      manifest: manifestText.value || undefined,
      htmlSnippet: htmlSnippet.value || undefined,
      isGenerating: isGenerating.value,
      error: error.value ?? undefined,
    });
  });

  onBeforeUnmount(reset);

  return {
    fileName,
    sourceUrl,
    hasFile,
    imageWidth,
    imageHeight,
    appName,
    icons,
    icoBlob,
    manifestText,
    htmlSnippet,
    isGenerating,
    error,
    isEmbed,
    embedInput,
    setFile,
    generate,
    downloadIcon,
    downloadIco,
    downloadManifest,
    reset,
  };
}
