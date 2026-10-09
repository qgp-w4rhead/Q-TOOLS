/**
 * useSriHashGenerator - composable + pure logic for the Subresource Integrity
 * (SRI) hash generator tool.
 *
 * Hashes a local file or pasted text with SHA-256/384/512 via the Web Crypto
 * API and produces the `integrity` attribute value (`sha384-<base64>`) plus a
 * ready-to-paste `<script>` / `<link>` tag.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useSriHashGenerator()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies - Web Crypto (`crypto.subtle.digest`) only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Supported SRI hash algorithms (Web Crypto names). */
export type SriAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

export const SRI_ALGORITHMS: SriAlgorithm[] = ['SHA-256', 'SHA-384', 'SHA-512'];

/** The `integrity` attribute prefix for each algorithm. */
export const SRI_PREFIX: Record<SriAlgorithm, string> = {
  'SHA-256': 'sha256',
  'SHA-384': 'sha384',
  'SHA-512': 'sha512',
};

/** Maximum file size accepted (64 MiB - hashing is fast but keep it sane). */
export const MAX_FILE_SIZE = 64 * 1024 * 1024;

/** Encode a digest `ArrayBuffer` to standard base64. */
export function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(binary);
}

/**
 * Hash `data` with `algorithm` and return the SRI integrity token
 * (`sha384-<base64>`). `data` may be a string (UTF-8 encoded) or bytes.
 */
export async function sriHash(
  data: string | Uint8Array | ArrayBuffer,
  algorithm: SriAlgorithm,
): Promise<string> {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  const digest = await crypto.subtle.digest(algorithm, bytes as BufferSource);
  return `${SRI_PREFIX[algorithm]}-${bufferToBase64(digest)}`;
}

/** Compute all three SRI hashes for `data` at once. */
export async function sriHashAll(
  data: string | Uint8Array | ArrayBuffer,
): Promise<Record<SriAlgorithm, string>> {
  const [h256, h384, h512] = await Promise.all([
    sriHash(data, 'SHA-256'),
    sriHash(data, 'SHA-384'),
    sriHash(data, 'SHA-512'),
  ]);
  return { 'SHA-256': h256, 'SHA-384': h384, 'SHA-512': h512 };
}

/** Kind of HTML tag to emit. */
export type SriTagKind = 'script' | 'link' | 'none';

/**
 * Build a ready-to-paste `<script>` or `<link>` tag carrying the integrity
 * attribute. `url` is the resource URL; when empty a placeholder is used.
 */
export function buildTag(
  kind: SriTagKind,
  url: string,
  integrity: string,
): string {
  const src = url.trim() || 'https://example.com/resource.js';
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  if (kind === 'script') {
    return `<script src="${esc(src)}" integrity="${esc(integrity)}" crossorigin="anonymous"></script>`;
  }
  if (kind === 'link') {
    return `<link rel="stylesheet" href="${esc(src)}" integrity="${esc(integrity)}" crossorigin="anonymous">`;
  }
  return integrity;
}

/** Read a File/Blob into a Uint8Array. */
export function readFileBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('FileReader returned an unexpected result type.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
    reader.readAsArrayBuffer(file);
  });
}

/** Human-readable byte size. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export type SriInputMode = 'file' | 'text';

export interface SriResult {
  hashes: Record<SriAlgorithm, string>;
  /** The currently selected algorithm's integrity token. */
  integrity: string;
  /** Ready-to-paste tag for the selected algorithm + tag kind. */
  tag: string;
  /** Source description (file name or "pasted text"). */
  sourceLabel: string;
  /** Byte size of the hashed content. */
  byteSize: number;
}

export interface UseSriHashGeneratorReturn {
  mode: Ref<SriInputMode>;
  text: Ref<string>;
  url: Ref<string>;
  tagKind: Ref<SriTagKind>;
  algorithm: Ref<SriAlgorithm>;
  fileName: Ref<string>;
  fileSize: Ref<number>;
  result: Ref<SriResult | null>;
  busy: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setMode: (m: SriInputMode) => void;
  setFile: (f: File) => void;
  clearFile: () => void;
}

export function useSriHashGenerator(): UseSriHashGeneratorReturn {
  const mode = ref<SriInputMode>('text');
  const text = ref<string>('');
  const url = ref<string>('');
  const tagKind = ref<SriTagKind>('script');
  const algorithm = ref<SriAlgorithm>('SHA-384');
  const fileName = ref<string>('');
  const fileSize = ref<number>(0);
  const fileBytes = ref<Uint8Array | null>(null);
  const result = ref<SriResult | null>(null);
  const busy = ref<boolean>(false);
  const error = ref<string>('');

  let token = 0;

  async function recompute(): Promise<void> {
    error.value = '';
    const myToken = ++token;
    let data: string | Uint8Array | null = null;
    let sourceLabel = '';
    if (mode.value === 'file') {
      if (!fileBytes.value) {
        result.value = null;
        return;
      }
      data = fileBytes.value;
      sourceLabel = fileName.value || 'file';
    } else {
      if (text.value.length === 0) {
        result.value = null;
        return;
      }
      data = text.value;
      sourceLabel = 'pasted text';
    }
    busy.value = true;
    try {
      const hashes = await sriHashAll(data);
      if (myToken !== token) return;
      const integrity = hashes[algorithm.value];
      const byteSize =
        typeof data === 'string'
          ? new TextEncoder().encode(data).length
          : data.length;
      result.value = {
        hashes,
        integrity,
        tag: buildTag(tagKind.value, url.value, integrity),
        sourceLabel,
        byteSize,
      };
    } catch (e) {
      if (myToken === token) {
        error.value = e instanceof Error ? e.message : String(e);
        result.value = null;
      }
    } finally {
      if (myToken === token) busy.value = false;
    }
  }

  function setMode(m: SriInputMode): void {
    if (m === mode.value) return;
    mode.value = m;
  }

  function setFile(f: File): void {
    if (f.size > MAX_FILE_SIZE) {
      error.value = `File too large (${formatSize(f.size)}). Max ${formatSize(MAX_FILE_SIZE)}.`;
      return;
    }
    error.value = '';
    fileName.value = f.name;
    fileSize.value = f.size;
    busy.value = true;
    readFileBytes(f)
      .then((bytes) => {
        fileBytes.value = bytes;
      })
      .catch((e) => {
        error.value = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        busy.value = false;
      });
  }

  function clearFile(): void {
    fileBytes.value = null;
    fileName.value = '';
    fileSize.value = 0;
    result.value = null;
  }

  watch(
    [mode, text, url, tagKind, algorithm, fileBytes],
    () => {
      void recompute();
    },
    { immediate: true },
  );

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') {
        mode.value = 'text';
        text.value = p.text;
      } else if (typeof p.input === 'string') {
        mode.value = 'text';
        text.value = p.input;
      }
      if (typeof p.url === 'string') url.value = p.url;
      if (p.tag === 'script' || p.tag === 'link' || p.tag === 'none') {
        tagKind.value = p.tag;
      }
      if (
        typeof p.algorithm === 'string' &&
        (SRI_ALGORITHMS as string[]).includes(p.algorithm)
      ) {
        algorithm.value = p.algorithm as SriAlgorithm;
      }
    },
    output: result,
    toOutput: () => {
      const r = result.value;
      return r
        ? {
            integrity: r.integrity,
            tag: r.tag,
            sha256: r.hashes['SHA-256'],
            sha384: r.hashes['SHA-384'],
            sha512: r.hashes['SHA-512'],
          }
        : {};
    },
  });

  return {
    mode,
    text,
    url,
    tagKind,
    algorithm,
    fileName,
    fileSize,
    result,
    busy,
    error,
    isEmbed,
    embedInput,
    setMode,
    setFile,
    clearFile,
  };
}
