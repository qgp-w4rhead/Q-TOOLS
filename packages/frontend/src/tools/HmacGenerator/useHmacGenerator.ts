/**
 * useHmacGenerator — composable + pure logic for the HMAC generator tool.
 *
 * Computes HMAC signatures of a message under a secret key using the Web
 * Crypto API (`crypto.subtle.importKey` + `crypto.subtle.sign` with the
 * `HMAC` algorithm). Supported hash functions: SHA-1, SHA-256, SHA-384,
 * SHA-512. Output is rendered as both hex and base64.
 *
 * The pure helpers (`encodeUtf8`, `toHex`, `toBase64`, `computeHmac`) have no
 * Vue dependency and can be imported standalone for unit testing or reuse.
 * The `useHmacGenerator()` composable wraps them in reactive state, debounces
 * recomputation for large inputs, and wires up the embed PostMessage protocol.
 *
 * No external dependencies — uses only the Web Crypto API and TextEncoder.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** HMAC hash algorithm identifiers supported by the tool. */
export type HmacAlgorithm = 'sha-1' | 'sha-256' | 'sha-384' | 'sha-512';

/** Display metadata for each algorithm. */
export interface HmacAlgorithmInfo {
  id: HmacAlgorithm;
  /** Human-readable label. */
  label: string;
  /** Web Crypto hash name passed to `importKey`/`sign`. */
  webCrypto: string;
  /** Output length in bits. */
  bits: number;
}

export const ALGORITHMS: HmacAlgorithmInfo[] = [
  { id: 'sha-1', label: 'HMAC-SHA1', webCrypto: 'SHA-1', bits: 160 },
  { id: 'sha-256', label: 'HMAC-SHA256', webCrypto: 'SHA-256', bits: 256 },
  { id: 'sha-384', label: 'HMAC-SHA384', webCrypto: 'SHA-384', bits: 384 },
  { id: 'sha-512', label: 'HMAC-SHA512', webCrypto: 'SHA-512', bits: 512 },
];

/** Map id → info for O(1) lookup. */
export const ALGORITHM_MAP: Record<HmacAlgorithm, HmacAlgorithmInfo> =
  Object.fromEntries(ALGORITHMS.map((a) => [a.id, a])) as Record<
    HmacAlgorithm,
    HmacAlgorithmInfo
  >;

/** Algorithm selected by default. */
export const DEFAULT_ALGORITHM: HmacAlgorithm = 'sha-256';

/** Encode a JS string as UTF-8 bytes. */
export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Convert an ArrayBuffer/Uint8Array to a lowercase hex string. */
export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  const hex = '0123456789abcdef';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    out += hex[(b >> 4) & 0xf]! + hex[b & 0xf]!;
  }
  return out;
}

/**
 * Convert an ArrayBuffer/Uint8Array to a base64 string.
 *
 * Builds the binary string in chunks (32 KiB) before calling `btoa` so that
 * very large buffers don't exceed the JS engine's max string-literal / call-
 * stack limits. HMAC outputs are small, but the helper is reusable.
 */
export function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000; // 32 KiB — safe across engines.
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Compute an HMAC signature of `message` under `secret` using `algorithm`.
 * Returns the raw signature bytes. Uses the Web Crypto API.
 *
 * Both `message` and `secret` are encoded as UTF-8. An empty secret is allowed
 * (Web Crypto accepts a zero-length key for HMAC) — but an empty message
 * returns an empty result upstream.
 */
export async function computeHmacBytes(
  algorithm: HmacAlgorithm,
  message: string,
  secret: string,
): Promise<ArrayBuffer> {
  const info = ALGORITHM_MAP[algorithm];
  if (!info) throw new Error(`Unknown HMAC algorithm: ${algorithm}`);
  const keyBytes = encodeUtf8(secret);
  // Copy into a fresh ArrayBuffer-backed Uint8Array so the strict TS lib defs
  // accept it as a BufferSource (TextEncoder.encode returns a
  // Uint8Array<ArrayBufferLike> which may be SharedArrayBuffer-backed).
  const keyCopy = new Uint8Array(keyBytes.byteLength);
  keyCopy.set(keyBytes);
  const msgBytes = encodeUtf8(message);
  const msgCopy = new Uint8Array(msgBytes.byteLength);
  msgCopy.set(msgBytes);
  const key = await crypto.subtle.importKey(
    'raw',
    keyCopy,
    { name: 'HMAC', hash: { name: info.webCrypto } },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, msgCopy);
}

/** A computed HMAC result. */
export interface HmacResult {
  algorithm: HmacAlgorithm;
  label: string;
  hex: string;
  base64: string;
  bits: number;
}

/**
 * Compute the hex + base64 HMAC of `message` under `secret` for `algorithm`.
 * Returns `null` when `message` is empty (nothing to sign).
 */
export async function computeHmac(
  algorithm: HmacAlgorithm,
  message: string,
  secret: string,
): Promise<HmacResult | null> {
  const info = ALGORITHM_MAP[algorithm];
  if (!info) throw new Error(`Unknown HMAC algorithm: ${algorithm}`);
  if (message.length === 0) return null;
  const sig = await computeHmacBytes(algorithm, message, secret);
  return {
    algorithm: info.id,
    label: info.label,
    hex: toHex(sig),
    base64: toBase64(sig),
    bits: info.bits,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface HmacGeneratorConfig {
  message: string;
  secret: string;
  algorithm: HmacAlgorithm;
}

export const DEFAULT_CONFIG: HmacGeneratorConfig = {
  message: '',
  secret: '',
  algorithm: DEFAULT_ALGORITHM,
};

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 150;
/** Skip auto-recompute for messages larger than this (manual button). */
const LARGE_INPUT_THRESHOLD = 1_000_000;

export interface UseHmacGeneratorReturn {
  message: Ref<string>;
  secret: Ref<string>;
  algorithm: Ref<HmacAlgorithm>;
  result: Ref<HmacResult | null>;
  computing: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setAlgorithm: (algo: HmacAlgorithm) => void;
}

export function useHmacGenerator(): UseHmacGeneratorReturn {
  const message = ref<string>('');
  const secret = ref<string>('');
  const algorithm = ref<HmacAlgorithm>(DEFAULT_ALGORITHM);
  const result = ref<HmacResult | null>(null);
  const computing = ref<boolean>(false);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let runToken = 0;

  async function run(): Promise<void> {
    const msg = message.value;
    const key = secret.value;
    const algo = algorithm.value;
    if (msg.length === 0) {
      result.value = null;
      error.value = '';
      computing.value = false;
      return;
    }
    if (msg.length > LARGE_INPUT_THRESHOLD) {
      error.value = 'Message is very large — click "Sign" to compute manually.';
      return;
    }
    const token = ++runToken;
    computing.value = true;
    error.value = '';
    try {
      const out = await computeHmac(algo, msg, key);
      if (token === runToken) result.value = out;
    } catch (e) {
      if (token === runToken) {
        error.value = e instanceof Error ? e.message : String(e);
        result.value = null;
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

  function setAlgorithm(algo: HmacAlgorithm): void {
    algorithm.value = algo;
  }

  // Recompute (debounced) whenever inputs change.
  watch(message, scheduleRun);
  watch(secret, scheduleRun);
  watch(algorithm, scheduleRun);

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.message === 'string') message.value = p.message;
      if (typeof p.secret === 'string') secret.value = p.secret;
      if (typeof p.algorithm === 'string' && p.algorithm in ALGORITHM_MAP) {
        algorithm.value = p.algorithm as HmacAlgorithm;
      }
    },
  });

  // Relay output to the parent whenever the result changes (embed mode only).
  watch(result, (r) => {
    if (isEmbed.value) {
      sendOutput(
        r
          ? { algorithm: r.algorithm, hex: r.hex, base64: r.base64 }
          : { algorithm: algorithm.value, hex: '', base64: '' },
      );
    }
  });

  return {
    message,
    secret,
    algorithm,
    result,
    computing,
    error,
    isEmbed,
    input,
    recompute,
    setAlgorithm,
  };
}
