/**
 * useQrCodeReader - composable + pure logic for the QR/barcode reader tool.
 *
 * Decodes QR codes and barcodes from an uploaded image via the native
 * `BarcodeDetector` API (zero dependencies). Supported in Chromium-based
 * browsers and recent Safari/Firefox; the tool feature-detects and shows a
 * descriptive unsupported message when the API is absent.
 *
 * Pure helpers have no Vue dependency and can be imported standalone.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import { loadImageFromBlob } from '@/utils/image';
import { formatBytes } from '@/utils/media';

/* -------------------------------------------------------------------------- */
/* Types + constants                                                           */
/* -------------------------------------------------------------------------- */

/** Minimal shape of the native BarcodeDetector API (not yet in lib.dom). */
export interface DetectedBarcode {
  rawValue: string;
  format: string;
  cornerPoints?: { x: number; y: number }[];
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
}

export interface DecodedCode {
  value: string;
  format: string;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** `true` when the native BarcodeDetector API is available. */
export function isBarcodeDetectorAvailable(): boolean {
  return typeof (globalThis as Record<string, unknown>).BarcodeDetector === 'function';
}

function detectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as Record<string, unknown>).BarcodeDetector;
  return typeof ctor === 'function' ? (ctor as BarcodeDetectorCtor) : null;
}

/** List the formats the browser's BarcodeDetector supports. */
export async function listSupportedFormats(): Promise<string[]> {
  const ctor = detectorCtor();
  if (!ctor?.getSupportedFormats) return [];
  try {
    return await ctor.getSupportedFormats();
  } catch {
    return [];
  }
}

/** Human label for a barcode format id. */
export function formatName(format: string): string {
  const map: Record<string, string> = {
    qr_code: 'QR code',
    aztec: 'Aztec',
    data_matrix: 'Data Matrix',
    pdf417: 'PDF417',
    code_128: 'Code 128',
    code_39: 'Code 39',
    code_93: 'Code 93',
    codabar: 'Codabar',
    ean_13: 'EAN-13',
    ean_8: 'EAN-8',
    itf: 'ITF',
    upc_a: 'UPC-A',
    upc_e: 'UPC-E',
  };
  return map[format] ?? format;
}

/** `true` when a decoded value looks like a URL (for the "open" affordance). */
export function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseQrCodeReaderReturn {
  fileName: Ref<string>;
  fileSizeBytes: Ref<number>;
  previewUrl: Ref<string | null>;
  hasFile: Ref<boolean>;
  codes: Ref<DecodedCode[]>;
  supported: Ref<boolean>;
  supportedFormats: Ref<string[]>;
  isDecoding: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (file: File) => Promise<void>;
  reset: () => void;
}

export function useQrCodeReader(): UseQrCodeReaderReturn {
  const fileName = ref<string>('');
  const fileSizeBytes = ref<number>(0);
  const previewUrl = ref<string | null>(null);
  const hasFile = ref<boolean>(false);
  const codes = ref<DecodedCode[]>([]);
  const supported = ref<boolean>(isBarcodeDetectorAvailable());
  const supportedFormats = ref<string[]>([]);
  const isDecoding = ref<boolean>(false);
  const error = ref<string | null>(null);

  void listSupportedFormats().then((f) => {
    supportedFormats.value = f;
  });

  function clear(): void {
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
    hasFile.value = false;
    codes.value = [];
  }

  async function setFile(file: File): Promise<void> {
    error.value = null;
    clear();
    if (!supported.value) {
      error.value =
        'BarcodeDetector is not available in this browser. ' +
        'Try Chrome, Edge, or a recent Safari/Firefox.';
      return;
    }
    isDecoding.value = true;
    try {
      const { img, url } = await loadImageFromBlob(file);
      fileName.value = file.name || 'image';
      fileSizeBytes.value = file.size;
      previewUrl.value = url;
      hasFile.value = true;
      const ctor = detectorCtor()!;
      const detector = new ctor();
      const found = await detector.detect(img);
      URL.revokeObjectURL(img.src);
      codes.value = found.map((b) => ({ value: b.rawValue, format: b.format }));
      if (codes.value.length === 0) {
        error.value = 'No QR code or barcode detected in this image.';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Decoding failed.';
    } finally {
      isDecoding.value = false;
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
      if (p.action === 'reset') reset();
    },
  });

  watch([hasFile, codes, isDecoding, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      hasFile: hasFile.value,
      fileName: fileName.value,
      count: codes.value.length,
      codes: codes.value,
      isDecoding: isDecoding.value,
      error: error.value ?? undefined,
    });
  });

  onBeforeUnmount(reset);

  return {
    fileName,
    fileSizeBytes,
    previewUrl,
    hasFile,
    codes,
    supported,
    supportedFormats,
    isDecoding,
    error,
    isEmbed,
    embedInput,
    setFile,
    reset,
  };
}

export { formatBytes };
