/**
 * useBase64File - composable + pure logic for the Base64 file converter.
 *
 * Bidirectional conversion between binary files and Base64:
 *  - **Encode**: drop/pick a file → Base64 string (raw or as a Data URI).
 *  - **Decode**: paste a Base64 string or Data URI → recover the original
 *    bytes and offer a download.
 *
 * The byte↔Base64 mapping reuses the hand-rolled, UTF-8-safe helpers from
 * the Base64String tool (`bytesToBase64` / `base64ToBytes`) so there is a
 * single source of truth for the encoding and no external dependency. The
 * file-specific helpers (`readFileAsBytes`, `parseDataUri`, `buildDataUri`,
 * `downloadBytes`, `formatFileSize`, `guessExtension`) are pure / DOM-only
 * and have no Vue dependency, so they can be imported standalone for tests
 * or reuse.
 *
 * The `useBase64File()` composable wraps the helpers in reactive state and
 * wires up the embed PostMessage protocol:
 *  - input  → `{ mode, base64, dataUri, fileName, mimeType, urlSafe, asDataUri }`
 *  - output → `{ base64, dataUri, fileName, mimeType, size }`
 *
 * No external dependencies (FileReader / Blob / URL APIs only).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import {
  bytesToBase64,
  base64ToBytes,
} from '@/tools/Base64String/useBase64String';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type Base64FileMode = 'encode' | 'decode';

/** Maximum file size we accept for encoding (32 MiB - keeps the tab responsive). */
export const MAX_FILE_SIZE = 32 * 1024 * 1024;

/** Default download filename when none can be inferred. */
export const DEFAULT_DOWNLOAD_NAME = 'download.bin';

/**
 * Read a `File` (or `Blob`) into a `Uint8Array` via the FileReader API.
 *
 * Returns a promise so the caller can `await` the read. Rejects on read
 * errors (rare, but e.g. for files that disappear mid-read).
 */
export function readFileAsBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result));
      } else {
        reject(new Error('FileReader returned an unexpected result type.'));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('File read failed.'));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read a `File` (or `Blob`) as a data URL via the FileReader API.
 *
 * Used as a fallback path and for tests; the primary encode path uses
 * `readFileAsBytes` + `bytesToBase64` so we can apply the URL-safe alphabet.
 */
export function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader returned a non-string result.'));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('File read failed.'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Parse a Data URI into its components.
 *
 * Accepts `data:[<mediatype>][;base64],<data>` (base64 only - the
 * URL-encoded form is rare for binary data and not supported). Returns
 * `null` when the input is not a Data URI.
 */
export interface ParsedDataUri {
  /** MIME type (e.g. `image/png`), or `application/octet-stream` if absent. */
  mimeType: string;
  /** The raw base64 payload (whitespace-trimmed). */
  base64: string;
  /** Whether the Data URI declared `;base64` (always true for binary). */
  isBase64: boolean;
}

export function parseDataUri(input: string): ParsedDataUri | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed.startsWith('data:')) return null;
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx < 0) return null;
  const header = trimmed.slice(5, commaIdx); // strip `data:`
  const payload = trimmed.slice(commaIdx + 1);
  const parts = header.split(';');
  const isBase64 = parts.includes('base64');
  // The first part (if not empty and not `base64`) is the media type.
  const mimeType =
    parts.length > 0 && parts[0] !== '' && parts[0] !== 'base64'
      ? parts[0]!
      : 'application/octet-stream';
  return {
    mimeType,
    base64: payload.replace(/\s+/g, ''),
    isBase64,
  };
}

/**
 * Build a Data URI from a Base64 string and a MIME type.
 *
 * `data:<mime>;base64,<payload>` - the canonical form for binary data.
 */
export function buildDataUri(base64: string, mimeType: string): string {
  const mime = mimeType || 'application/octet-stream';
  return `data:${mime};base64,${base64}`;
}

/**
 * Trigger a browser download of the given bytes.
 *
 * Creates a temporary object URL, clicks an `<a download>` element, and
 * revokes the URL on the next tick. No-op outside a browser environment.
 */
export function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  if (typeof document === 'undefined') return;
  // Copy into a fresh ArrayBuffer-backed view so the strict TS lib accepts
  // it as a BlobPart (Uint8Array<ArrayBufferLike> can be backed by a
  // SharedArrayBuffer, which Blob rejects).
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || DEFAULT_DOWNLOAD_NAME;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next microtask so the click has a chance to register.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Format a byte count as a human-readable string (B / KiB / MiB / GiB).
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

/**
 * Guess a file extension from a MIME type.
 *
 * Covers the common cases; falls back to `bin` for unknown types. Used
 * when reconstructing a download filename from a Data URI that has no
 * filename hint.
 */
export function guessExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/json': 'json',
    'application/xml': 'xml',
    'application/zip': 'zip',
    'application/gzip': 'gz',
    'application/x-tar': 'tar',
    'application/wasm': 'wasm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  return map[mimeType] ?? 'bin';
}

/**
 * Strip a Data URI prefix from an input string if present, returning the
 * raw base64 payload. Also tolerates the standard → URL-safe alphabet
 * swap (and vice versa) so users can paste either form.
 */
export function stripDataUri(input: string): string {
  const parsed = parseDataUri(input);
  if (parsed) return parsed.base64;
  return input.trim();
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Reactive encode-mode state (the picked file). */
export interface EncodeFileState {
  /** Original file name (may be empty for programmatically created blobs). */
  name: string;
  /** File size in bytes. */
  size: number;
  /** MIME type from the `File.type` property (may be empty). */
  mimeType: string;
}

/** Reactive decode-mode state (the recovered file). */
export interface DecodeFileState {
  /** Best-effort download filename. */
  name: string;
  /** Decoded byte length. */
  size: number;
  /** MIME type recovered from a Data URI, or `application/octet-stream`. */
  mimeType: string;
}

export interface UseBase64FileReturn {
  mode: Ref<Base64FileMode>;
  /** Encode-mode: the picked file metadata (or null). */
  file: Ref<EncodeFileState | null>;
  /** Decode-mode: textarea input (base64 or Data URI). */
  input: Ref<string>;
  /** URL-safe alphabet toggle. */
  urlSafe: Ref<boolean>;
  /** Encode output as a Data URI instead of raw base64. */
  asDataUri: Ref<boolean>;
  /** The computed base64 string (encode mode) or null. */
  base64: Ref<string>;
  /** The computed Data URI (encode mode) or null. */
  dataUri: Ref<string>;
  /** The recovered download metadata (decode mode) or null. */
  decoded: Ref<DecodeFileState | null>;
  /** The recovered bytes (decode mode) - kept for the download button. */
  decodedBytes: Ref<Uint8Array | null>;
  /** Error message (empty string when none). */
  error: Ref<string>;
  /** Whether the encode/decode operation is in progress. */
  busy: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  /** Handle a dropped/picked file (encode mode). */
  onFile: (file: File) => Promise<void>;
  /** Re-run the decode computation (decode mode). */
  decode: () => void;
  /** Trigger a download of the recovered bytes (decode mode). */
  download: () => void;
  /** Clear all state. */
  clear: () => void;
  /** Switch mode. */
  setMode: (m: Base64FileMode) => void;
}

const DEBOUNCE_MS = 120;

export function useBase64File(): UseBase64FileReturn {
  const mode = ref<Base64FileMode>('encode');
  const file = ref<EncodeFileState | null>(null);
  const input = ref<string>('');
  const urlSafe = ref<boolean>(false);
  const asDataUri = ref<boolean>(false);
  const base64 = ref<string>('');
  const dataUri = ref<string>('');
  const decoded = ref<DecodeFileState | null>(null);
  const decodedBytes = ref<Uint8Array | null>(null);
  const error = ref<string>('');
  const busy = ref<boolean>(false);

  /** Raw bytes from the last encode - kept so we can re-render on toggle changes. */
  let encodeBytes: Uint8Array | null = null;

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function recomputeEncode(): void {
    if (!encodeBytes || !file.value) {
      base64.value = '';
      dataUri.value = '';
      return;
    }
    const b64 = bytesToBase64(encodeBytes, urlSafe.value);
    base64.value = b64;
    dataUri.value = buildDataUri(b64, file.value.mimeType || 'application/octet-stream');
  }

  async function onFile(f: File): Promise<void> {
    if (f.size > MAX_FILE_SIZE) {
      error.value = `File is too large (max ${formatFileSize(MAX_FILE_SIZE)}).`;
      return;
    }
    busy.value = true;
    error.value = '';
    try {
      const bytes = await readFileAsBytes(f);
      encodeBytes = bytes;
      file.value = {
        name: f.name || '',
        size: f.size,
        mimeType: f.type || '',
      };
      recomputeEncode();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to read file.';
      encodeBytes = null;
      file.value = null;
      base64.value = '';
      dataUri.value = '';
    } finally {
      busy.value = false;
    }
  }

  function runDecode(): void {
    const raw = input.value;
    if (raw.trim().length === 0) {
      decoded.value = null;
      decodedBytes.value = null;
      error.value = '';
      return;
    }
    const parsed = parseDataUri(raw);
    let mimeType = 'application/octet-stream';
    let payload = raw.trim();
    if (parsed) {
      mimeType = parsed.mimeType;
      payload = parsed.base64;
    }
    // Tolerate either alphabet regardless of the toggle - many Data URIs
    // use the standard alphabet even when the user has URL-safe selected.
    const bytes = base64ToBytes(payload, urlSafe.value);
    if (bytes === null) {
      // Try the alternate alphabet before giving up.
      const altBytes = base64ToBytes(payload, !urlSafe.value);
      if (altBytes === null) {
        decoded.value = null;
        decodedBytes.value = null;
        error.value = urlSafe.value
          ? 'Invalid Base64 (URL-safe). Check the alphabet and padding.'
          : 'Invalid Base64. Only A-Z, a-z, 0-9, +, / and = padding are allowed.';
        return;
      }
      decodedBytes.value = altBytes;
    } else {
      decodedBytes.value = bytes;
    }
    const b = decodedBytes.value!;
    decoded.value = {
      name: parsed
        ? `download.${guessExtension(mimeType)}`
        : DEFAULT_DOWNLOAD_NAME,
      size: b.length,
      mimeType,
    };
    error.value = '';
  }

  function scheduleDecode(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      runDecode();
    }, DEBOUNCE_MS);
  }

  function decode(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    runDecode();
  }

  function download(): void {
    if (!decodedBytes.value || !decoded.value) return;
    downloadBytes(decodedBytes.value, decoded.value.name, decoded.value.mimeType);
  }

  function clear(): void {
    file.value = null;
    encodeBytes = null;
    input.value = '';
    base64.value = '';
    dataUri.value = '';
    decoded.value = null;
    decodedBytes.value = null;
    error.value = '';
  }

  function setMode(m: Base64FileMode): void {
    mode.value = m;
  }

  // Re-render encode output when the alphabet / Data-URI toggles change.
  watch(urlSafe, recomputeEncode);

  watch(input, scheduleDecode);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mode === 'string' && (p.mode === 'encode' || p.mode === 'decode')) {
        mode.value = p.mode;
      }
      if (typeof p.urlSafe === 'boolean') urlSafe.value = p.urlSafe;
      if (typeof p.asDataUri === 'boolean') asDataUri.value = p.asDataUri;
      // Decode-mode inputs.
      if (typeof p.base64 === 'string') input.value = p.base64;
      else if (typeof p.dataUri === 'string') input.value = p.dataUri;
      // Encode-mode input via a URL - fetch + decode as if the user dropped it.
      const url = p.url;
      const fileNameHint = p.fileName;
      const mimeTypeHint = p.mimeType;
      if (typeof url === 'string' && url.length > 0) {
        void (async () => {
          try {
            const res = await fetch(url);
            if (!res.ok) {
              error.value = `Failed to fetch URL (${res.status}).`;
              return;
            }
            const blob = await res.blob();
            const f = new File([blob], fileNameHint ? String(fileNameHint) : 'file', {
              type: blob.type || (typeof mimeTypeHint === 'string' ? mimeTypeHint : ''),
            });
            await onFile(f);
          } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to fetch URL.';
          }
        })();
      }
    },
  });

  // Relay outputs to the parent in embed mode.
  watch(
    [mode, base64, dataUri, file, decoded],
    () => {
      if (!isEmbed.value) return;
      if (mode.value === 'encode') {
        sendOutput({
          base64: base64.value,
          dataUri: dataUri.value,
          fileName: file.value?.name ?? '',
          mimeType: file.value?.mimeType ?? '',
          size: file.value?.size ?? 0,
        });
      } else {
        sendOutput({
          base64: input.value,
          dataUri: '',
          fileName: decoded.value?.name ?? '',
          mimeType: decoded.value?.mimeType ?? '',
          size: decoded.value?.size ?? 0,
        });
      }
    },
    { deep: true },
  );

  return {
    mode,
    file,
    input,
    urlSafe,
    asDataUri,
    base64,
    dataUri,
    decoded,
    decodedBytes,
    error,
    busy,
    isEmbed,
    embedInput,
    onFile,
    decode,
    download,
    clear,
    setMode,
  };
}
