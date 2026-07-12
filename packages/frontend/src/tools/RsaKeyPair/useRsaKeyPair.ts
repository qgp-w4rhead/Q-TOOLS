/**
 * useRsaKeyPair — composable + pure logic for the RSA key pair generator tool.
 *
 * Generates RSA key pairs using the Web Crypto API
 * (`crypto.subtle.generateKey` with `RSASSA-PKCS1-v1_5`, SHA-256 hash, and
 * public exponent F4 = 65537). The generated keys are exported as DER-encoded
 * `SubjectPublicKeyInfo` (public) and PKCS#8 `PrivateKeyInfo` (private), then
 * wrapped into PEM strings using `node-forge`'s `pem.encode` (lazy-loaded so
 * Vite emits it as a separate chunk, loaded only when the tool is opened).
 *
 * Supported key sizes: 2048, 4096, 8192 bits.
 *
 * The pure helpers (`bytesToBinaryString`, `derToPem`, `generateRsaKeyPair`)
 * have no Vue dependency and can be imported standalone for unit testing or
 * reuse. The `useRsaKeyPair()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * Dependencies: `node-forge` (lazy-loaded) — listed in tech-stack.md.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Supported RSA key sizes in bits. */
export const KEY_SIZES = [2048, 4096, 8192] as const;
export type KeySize = (typeof KEY_SIZES)[number];
export const DEFAULT_KEY_SIZE: KeySize = 2048;

/** Human-readable metadata for each key size option. */
export interface KeySizeInfo {
  value: KeySize;
  label: string;
  /** Rough generation-time hint. */
  hint: string;
}

export const KEY_SIZE_INFOS: KeySizeInfo[] = [
  { value: 2048, label: '2048-bit', hint: 'Fast · minimum recommended' },
  { value: 4096, label: '4096-bit', hint: 'Slower · standard for new keys' },
  { value: 8192, label: '8192-bit', hint: 'Very slow · high-security only' },
];

export const KEY_SIZE_MAP: Record<KeySize, KeySizeInfo> = Object.fromEntries(
  KEY_SIZE_INFOS.map((k) => [k.value, k]),
) as Record<KeySize, KeySizeInfo>;

/** A generated RSA key pair result. */
export interface RsaKeyPairResult {
  bits: KeySize;
  publicPem: string;
  privatePem: string;
  /** ISO timestamp of generation (for display). */
  generatedAt: string;
}

/** Cached `node-forge` module (shared across all calls). */
let cachedForge: typeof import('node-forge') | null = null;

/**
 * Resolve and cache the `node-forge` module (async). Dynamic import →
 * `node-forge` lands in its own Vite chunk, loaded only when the user opens
 * this tool or triggers generation. Safe to call repeatedly.
 */
export async function ensureForgeModule(): Promise<typeof import('node-forge')> {
  if (!cachedForge) {
    cachedForge = await import('node-forge');
  }
  return cachedForge;
}

/**
 * Convert a `Uint8Array` to a binary string (each byte → one char). Built in
 * 32 KiB chunks to avoid `String.fromCharCode` call-stack limits for large
 * buffers (8192-bit PKCS#8 DER is ~2 KB — well under the limit, but the helper
 * is robust for any size).
 */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000; // 32 KiB
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/**
 * Wrap a DER-encoded byte array into a PEM string using `node-forge`'s
 * `pem.encode`. The `type` label becomes the PEM header
 * (e.g. `"PUBLIC KEY"` → `-----BEGIN PUBLIC KEY-----`).
 */
export async function derToPem(
  der: ArrayBuffer | Uint8Array,
  type: string,
): Promise<string> {
  const forge = await ensureForgeModule();
  const bytes = der instanceof Uint8Array ? der : new Uint8Array(der);
  return forge.pem.encode({
    type,
    body: bytesToBinaryString(bytes),
  });
}

/**
 * Generate an RSA key pair of the given `bits` and return both keys as PEM
 * strings.
 *
 * - Key generation: Web Crypto API (`crypto.subtle.generateKey` with
 *   `RSASSA-PKCS1-v1_5`, SHA-256, public exponent F4 = 65537).
 * - PEM export: `node-forge` `pem.encode` (lazy-loaded).
 *
 * Public key PEM uses `SubjectPublicKeyInfo` (`-----BEGIN PUBLIC KEY-----`).
 * Private key PEM uses PKCS#8 `PrivateKeyInfo` (`-----BEGIN PRIVATE KEY-----`).
 */
export async function generateRsaKeyPair(
  bits: KeySize,
): Promise<RsaKeyPairResult> {
  if (!KEY_SIZES.includes(bits)) {
    throw new Error(`Unsupported key size: ${bits}. Use 2048, 4096, or 8192.`);
  }

  // Web Crypto key generation. RSASSA-PKCS1-v1_5 with SHA-256 is the most
  // widely compatible RSA signature algorithm; the exported key material
  // (SPKI / PKCS#8) is algorithm-agnostic and can be used with any RSA
  // scheme (OAEP, PSS, etc.) by importing with the desired algorithm.
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: bits,
      publicExponent: new Uint8Array([1, 0, 1]), // F4 = 65537
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );

  // Export as DER — SubjectPublicKeyInfo (public) + PKCS#8 PrivateKeyInfo.
  const spkiDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pkcs8Der = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  // Wrap DER → PEM using node-forge (lazy-loaded).
  const [publicPem, privatePem] = await Promise.all([
    derToPem(spkiDer, 'PUBLIC KEY'),
    derToPem(pkcs8Der, 'PRIVATE KEY'),
  ]);

  return {
    bits,
    publicPem,
    privatePem,
    generatedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseRsaKeyPairReturn {
  keySize: Ref<KeySize>;
  result: Ref<RsaKeyPairResult | null>;
  generating: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  generate: () => void;
  setKeySize: (size: KeySize) => void;
}

export function useRsaKeyPair(): UseRsaKeyPairReturn {
  const keySize = ref<KeySize>(DEFAULT_KEY_SIZE);
  const result = ref<RsaKeyPairResult | null>(null);
  const generating = ref<boolean>(false);
  const error = ref<string>('');

  let runToken = 0;

  async function run(): Promise<void> {
    const bits = keySize.value;
    const token = ++runToken;
    generating.value = true;
    error.value = '';
    try {
      const out = await generateRsaKeyPair(bits);
      if (token === runToken) result.value = out;
    } catch (e) {
      if (token === runToken) {
        error.value = e instanceof Error ? e.message : String(e);
        result.value = null;
      }
    } finally {
      if (token === runToken) generating.value = false;
    }
  }

  function generate(): void {
    void run();
  }

  function setKeySize(size: KeySize): void {
    if (KEY_SIZES.includes(size)) keySize.value = size;
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.keySize === 'number' && KEY_SIZES.includes(p.keySize as KeySize)) {
        keySize.value = p.keySize as KeySize;
      }
      // Allow parent to trigger generation via `generate: true`.
      if (p.generate === true) generate();
    },
  });

  // Relay output to the parent whenever the result changes (embed mode only).
  // We send the full PEM strings so the parent can use the keys directly.
  watch(result, (r) => {
    if (isEmbed.value) {
      sendOutput(
        r
          ? { bits: r.bits, publicPem: r.publicPem, privatePem: r.privatePem }
          : { bits: keySize.value, publicPem: '', privatePem: '' },
      );
    }
  });

  return {
    keySize,
    result,
    generating,
    error,
    isEmbed,
    input,
    generate,
    setKeySize,
  };
}
