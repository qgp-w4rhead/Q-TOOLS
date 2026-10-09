/**
 * useFileChecksumVerifier - composable + pure logic for the file checksum
 * verifier tool.
 *
 * Hashes a local file and compares the digest against a published checksum to
 * verify a download's integrity. Supports SHA-256/384/512 via Web Crypto and
 * MD5/SHA-1 via lazy-loaded `hash-wasm` (Web Crypto dropped those algorithms).
 * The expected checksum can be pasted as a bare hex digest or as a
 * `sha256sum`-style line (`<hash>  <filename>`); the algorithm is auto-detected
 * from the digest length when set to "auto".
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useFileChecksumVerifier()` composable wraps them
 * in reactive state and wires up the embed PostMessage protocol.
 */
import { computed, ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Supported checksum algorithms. `auto` infers from the expected hex length. */
export type ChecksumAlgorithm = 'auto' | 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512';

export const CHECKSUM_ALGORITHMS: ChecksumAlgorithm[] = [
  'auto',
  'md5',
  'sha1',
  'sha256',
  'sha384',
  'sha512',
];

/** Hex digest length (chars) per algorithm. */
export const HEX_LENGTH: Record<Exclude<ChecksumAlgorithm, 'auto'>, number> = {
  md5: 32,
  sha1: 40,
  sha256: 64,
  sha384: 96,
  sha512: 128,
};

/** Maximum file size accepted (256 MiB). */
export const MAX_FILE_SIZE = 256 * 1024 * 1024;

/**
 * Extract the hex digest from a pasted checksum string. Accepts:
 *  - bare hex digest
 *  - `sha256sum` format: `<hash>  <filename>` (also `*<filename>` binary marker)
 *  - `SHA256 (<file>) = <hash>` (BSD / certutil style)
 * Returns the lowercased hex digest, or `null` when none is found.
 */
export function extractHexDigest(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // BSD style: SHA256 (file) = <hash>
  const bsd = /=\s*([0-9a-fA-F]{32,128})\s*$/.exec(trimmed);
  if (bsd) return bsd[1]!.toLowerCase();
  // Take the first whitespace-separated token that is pure hex of a known length.
  for (const tok of trimmed.split(/\s+/)) {
    const clean = tok.replace(/^\*/, '');
    if (/^[0-9a-fA-F]+$/.test(clean)) {
      const len = clean.length;
      if (len === 32 || len === 40 || len === 64 || len === 96 || len === 128) {
        return clean.toLowerCase();
      }
    }
  }
  return null;
}

/** Infer the algorithm from a hex digest's length. Returns null if unknown. */
export function algorithmFromHexLength(
  hex: string,
): Exclude<ChecksumAlgorithm, 'auto'> | null {
  switch (hex.length) {
    case 32:
      return 'md5';
    case 40:
      return 'sha1';
    case 64:
      return 'sha256';
    case 96:
      return 'sha384';
    case 128:
      return 'sha512';
    default:
      return null;
  }
}

/** Convert an ArrayBuffer/Uint8Array digest to a lowercase hex string. */
export function bufferToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Hash `bytes` with the given algorithm and return the lowercase hex digest.
 * SHA-256/384/512 use Web Crypto; MD5/SHA-1 use lazy-loaded `hash-wasm`.
 */
export async function hashBytes(
  bytes: Uint8Array,
  algorithm: Exclude<ChecksumAlgorithm, 'auto'>,
): Promise<string> {
  if (algorithm === 'md5' || algorithm === 'sha1') {
    const wasm = await import('hash-wasm');
    return algorithm === 'md5' ? wasm.md5(bytes) : wasm.sha1(bytes);
  }
  const name = algorithm.toUpperCase().replace('SHA', 'SHA-') as
    | 'SHA-256'
    | 'SHA-384'
    | 'SHA-512';
  const digest = await crypto.subtle.digest(name, bytes as BufferSource);
  return bufferToHex(digest);
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

/** Verification verdict. */
export type Verdict = 'match' | 'mismatch' | 'pending';

export interface ChecksumResult {
  /** The computed hex digest. */
  computed: string;
  /** The algorithm actually used (resolved when `auto`). */
  algorithm: Exclude<ChecksumAlgorithm, 'auto'>;
  /** The expected digest extracted from the pasted input (if any). */
  expected: string | null;
  verdict: Verdict;
  fileName: string;
  fileSize: number;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseFileChecksumVerifierReturn {
  algorithm: Ref<ChecksumAlgorithm>;
  expected: Ref<string>;
  fileName: Ref<string>;
  fileSize: Ref<number>;
  hasFile: Ref<boolean>;
  result: Ref<ChecksumResult | null>;
  busy: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setFile: (f: File) => void;
  clearFile: () => void;
}

export function useFileChecksumVerifier(): UseFileChecksumVerifierReturn {
  const algorithm = ref<ChecksumAlgorithm>('auto');
  const expected = ref<string>('');
  const fileName = ref<string>('');
  const fileSize = ref<number>(0);
  const fileBytes = ref<Uint8Array | null>(null);
  const result = ref<ChecksumResult | null>(null);
  const busy = ref<boolean>(false);
  const error = ref<string>('');

  let token = 0;

  async function recompute(): Promise<void> {
    error.value = '';
    const myToken = ++token;
    if (!fileBytes.value) {
      result.value = null;
      return;
    }
    const expectedHex = extractHexDigest(expected.value);
    let algo = algorithm.value;
    if (algo === 'auto') {
      if (expectedHex) {
        const inferred = algorithmFromHexLength(expectedHex);
        if (!inferred) {
          error.value = 'Could not infer algorithm from the pasted checksum length.';
          result.value = null;
          return;
        }
        algo = inferred;
      } else {
        algo = 'sha256'; // sensible default when nothing to compare yet
      }
    }
    busy.value = true;
    try {
      const computed = await hashBytes(fileBytes.value, algo);
      if (myToken !== token) return;
      const verdict: Verdict = expectedHex
        ? computed === expectedHex
          ? 'match'
          : 'mismatch'
        : 'pending';
      result.value = {
        computed,
        algorithm: algo,
        expected: expectedHex,
        verdict,
        fileName: fileName.value,
        fileSize: fileSize.value,
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

  watch([fileBytes, expected, algorithm], () => void recompute(), {
    immediate: true,
  });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.expected === 'string') expected.value = p.expected;
      if (typeof p.checksum === 'string') expected.value = p.checksum;
      if (
        typeof p.algorithm === 'string' &&
        (CHECKSUM_ALGORITHMS as string[]).includes(p.algorithm)
      ) {
        algorithm.value = p.algorithm as ChecksumAlgorithm;
      }
    },
    output: result,
    toOutput: () => {
      const r = result.value;
      return r
        ? {
            computed: r.computed,
            algorithm: r.algorithm,
            expected: r.expected,
            verdict: r.verdict,
            fileName: r.fileName,
            fileSize: r.fileSize,
          }
        : {};
    },
  });

  const hasFile = computed(() => fileBytes.value !== null);

  return {
    algorithm,
    expected,
    fileName,
    fileSize,
    hasFile,
    result,
    busy,
    error,
    isEmbed,
    embedInput,
    setFile,
    clearFile,
  };
}
