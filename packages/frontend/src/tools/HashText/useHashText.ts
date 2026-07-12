/**
 * useHashText — composable + pure logic for the Hash text tool.
 *
 * Computes hex digests of an input string across multiple algorithms:
 *   - MD5, SHA3-256, SHA3-512, Blake3 → `hash-wasm` (lazy-loaded)
 *   - SHA-1, SHA-256, SHA-384, SHA-512 → Web Crypto API (`crypto.subtle.digest`)
 *
 * The pure helpers (`toHex`, `hashWithWebCrypto`, `hashWithWasm`,
 * `computeHashes`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useHashText()` composable wraps them in reactive
 * state, debounces recomputation for large inputs, and wires up the embed
 * PostMessage protocol.
 *
 * `hash-wasm` is dynamically imported inside `hashWithWasm()` so Vite emits a
 * separate chunk for it (code-splitting / offline caching).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Algorithm identifiers supported by the tool. */
export type HashAlgorithm =
  | 'md5'
  | 'sha-1'
  | 'sha-256'
  | 'sha-384'
  | 'sha-512'
  | 'sha3-256'
  | 'sha3-512'
  | 'blake3';

/** Display metadata for each algorithm. */
export interface AlgorithmInfo {
  id: HashAlgorithm;
  label: string;
  /** Web Crypto algorithm name, or `null` when handled by hash-wasm. */
  webCrypto: string | null;
  /** hash-wasm function name, or `null` when handled by Web Crypto. */
  wasm: 'md5' | 'sha3' | 'blake3' | null;
  /** Output length in bits (Blake3 default 256). */
  bits: number;
}

export const ALGORITHMS: AlgorithmInfo[] = [
  { id: 'md5', label: 'MD5', webCrypto: null, wasm: 'md5', bits: 128 },
  { id: 'sha-1', label: 'SHA-1', webCrypto: 'SHA-1', wasm: null, bits: 160 },
  { id: 'sha-256', label: 'SHA-256', webCrypto: 'SHA-256', wasm: null, bits: 256 },
  { id: 'sha-384', label: 'SHA-384', webCrypto: 'SHA-384', wasm: null, bits: 384 },
  { id: 'sha-512', label: 'SHA-512', webCrypto: 'SHA-512', wasm: null, bits: 512 },
  { id: 'sha3-256', label: 'SHA3-256', webCrypto: null, wasm: 'sha3', bits: 256 },
  { id: 'sha3-512', label: 'SHA3-512', webCrypto: null, wasm: 'sha3', bits: 512 },
  { id: 'blake3', label: 'Blake3', webCrypto: null, wasm: 'blake3', bits: 256 },
];

/** Map id → info for O(1) lookup. */
export const ALGORITHM_MAP: Record<HashAlgorithm, AlgorithmInfo> = Object.fromEntries(
  ALGORITHMS.map((a) => [a.id, a]),
) as Record<HashAlgorithm, AlgorithmInfo>;

/** Algorithms selected by default. */
export const DEFAULT_ALGORITHMS: HashAlgorithm[] = ['sha-256'];

/** Convert an ArrayBuffer to a lowercase hex string. */
export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  // Build hex in chunks for speed (vs. per-byte string concat).
  const hex = '0123456789abcdef';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    out += hex[(b >> 4) & 0xf]! + hex[b & 0xf]!;
  }
  return out;
}

/** Encode a JS string as UTF-8 bytes. */
export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Hash `data` using the Web Crypto API. Returns a hex string. */
export async function hashWithWebCrypto(
  algorithm: string,
  data: string,
): Promise<string> {
  // Copy the UTF-8 bytes into a fresh ArrayBuffer-backed Uint8Array so the
  // strict TS lib defs accept it as a BufferSource (TextEncoder.encode returns
  // a Uint8Array<ArrayBufferLike> which may be SharedArrayBuffer-backed).
  const bytes = encodeUtf8(data);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest(algorithm, copy);
  return toHex(buf);
}

/**
 * Hash `data` using `hash-wasm`. The library is dynamically imported so it
 * lands in its own Vite chunk. Returns a hex string.
 */
export async function hashWithWasm(
  fn: 'md5' | 'sha3' | 'blake3',
  data: string,
  bits?: number,
): Promise<string> {
  // Dynamic import → separate chunk for hash-wasm (offline-cached later).
  const wasm = await import('hash-wasm');
  if (fn === 'md5') return wasm.md5(data);
  if (fn === 'sha3') return wasm.sha3(data, bits as 224 | 256 | 384 | 512);
  return wasm.blake3(data, bits);
}

/** Compute the hex digest of `data` for a single algorithm. */
export async function computeHash(
  algo: HashAlgorithm,
  data: string,
): Promise<string> {
  const info = ALGORITHM_MAP[algo];
  if (!info) throw new Error(`Unknown algorithm: ${algo}`);
  if (data.length === 0) return '';
  if (info.webCrypto) return hashWithWebCrypto(info.webCrypto, data);
  if (info.wasm) return hashWithWasm(info.wasm, data, info.bits);
  throw new Error(`Algorithm ${algo} has no backend configured`);
}

/** A computed hash result row. */
export interface HashResult {
  algorithm: HashAlgorithm;
  label: string;
  hex: string;
  bits: number;
}

/**
 * Compute hex digests for `data` across every algorithm in `selected`.
 * Returns an array of `HashResult` in the same order as `ALGORITHMS`.
 */
export async function computeHashes(
  selected: HashAlgorithm[],
  data: string,
): Promise<HashResult[]> {
  if (data.length === 0 || selected.length === 0) return [];
  // Preserve the canonical ALGORITHMS order in the output.
  const ordered = ALGORITHMS.filter((a) => selected.includes(a.id));
  const results = await Promise.all(
    ordered.map(async (info) => ({
      algorithm: info.id,
      label: info.label,
      hex: await computeHash(info.id, data),
      bits: info.bits,
    })),
  );
  return results;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface HashTextConfig {
  /** Input text to hash. */
  text: string;
  /** Algorithms to compute (subset of ALGORITHMS). */
  algorithms: HashAlgorithm[];
}

export const DEFAULT_CONFIG: HashTextConfig = {
  text: '',
  algorithms: [...DEFAULT_ALGORITHMS],
};

/** Debounce window (ms) for recomputing hashes on input changes. */
const DEBOUNCE_MS = 150;
/** Skip recomputation for inputs larger than this many chars (manual button). */
const LARGE_INPUT_THRESHOLD = 1_000_000;

export interface UseHashTextReturn {
  text: Ref<string>;
  algorithms: Ref<HashAlgorithm[]>;
  results: Ref<HashResult[]>;
  computing: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  toggleAlgorithm: (algo: HashAlgorithm) => void;
}

export function useHashText(): UseHashTextReturn {
  const text = ref<string>('');
  const algorithms = ref<HashAlgorithm[]>([...DEFAULT_ALGORITHMS]);
  const results = ref<HashResult[]>([]);
  const computing = ref<boolean>(false);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let runToken = 0;

  async function run(): Promise<void> {
    const value = text.value;
    const selected = algorithms.value;
    if (value.length === 0 || selected.length === 0) {
      results.value = [];
      error.value = '';
      computing.value = false;
      return;
    }
    if (value.length > LARGE_INPUT_THRESHOLD) {
      error.value = 'Input is very large — click "Hash" to compute manually.';
      return;
    }
    const token = ++runToken;
    computing.value = true;
    error.value = '';
    try {
      const out = await computeHashes(selected, value);
      // Ignore stale results from a superseded run.
      if (token === runToken) results.value = out;
    } catch (e) {
      if (token === runToken) {
        error.value = e instanceof Error ? e.message : String(e);
        results.value = [];
      }
    } finally {
      if (token === runToken) computing.value = false;
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    error.value = '';
    void run();
  }

  function toggleAlgorithm(algo: HashAlgorithm): void {
    const idx = algorithms.value.indexOf(algo);
    if (idx === -1) {
      algorithms.value = [...algorithms.value, algo];
    } else {
      algorithms.value = algorithms.value.filter((a) => a !== algo);
    }
  }

  // Recompute (debounced) whenever inputs change.
  watch(text, scheduleRun);
  watch(algorithms, scheduleRun, { deep: true });

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') text.value = p.text;
      if (Array.isArray(p.algorithms)) {
        const valid = (p.algorithms as unknown[]).filter(
          (a): a is HashAlgorithm =>
            typeof a === 'string' && a in ALGORITHM_MAP,
        );
        if (valid.length > 0) algorithms.value = valid;
      }
    },
  });

  // Relay output to the parent whenever results change (embed mode only).
  watch(results, (r) => {
    if (isEmbed.value) {
      sendOutput({
        hashes: r.map((row) => ({ algorithm: row.algorithm, hex: row.hex })),
      });
    }
  });

  return {
    text,
    algorithms,
    results,
    computing,
    error,
    isEmbed,
    input,
    recompute,
    toggleAlgorithm,
  };
}
