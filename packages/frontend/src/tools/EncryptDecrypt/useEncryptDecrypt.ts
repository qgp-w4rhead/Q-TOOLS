/**
 * useEncryptDecrypt — composable + pure logic for the encrypt/decrypt text tool.
 *
 * Symmetric authenticated encryption using AES-GCM with PBKDF2 key derivation,
 * implemented entirely on the Web Crypto API (`crypto.subtle`). No external
 * dependencies.
 *
 * Wire format (all bytes, then base64-encoded for display/transport):
 *
 *   [ 1 byte saltLen ][ saltLen bytes salt ][ 12 bytes IV ][ AES-GCM ciphertext ]
 *
 * The salt length is stored as a single leading byte so the salt size can vary
 * (8/16/32 bytes) without breaking decryption. The IV is always 12 bytes — the
 * AES-GCM standard length recommended by NIST SP 800-38D. The ciphertext
 * produced by `crypto.subtle.encrypt` with AES-GCM already includes the 16-byte
 * authentication tag appended, so the output is authenticated as well as
 * confidential: tampering with any byte causes decryption to throw.
 *
 * PBKDF2 derives a 256-bit AES key from the passphrase + salt using SHA-256 and
 * a configurable iteration count (default 250 000, per OWASP 2023 guidance for
 * PBKDF2-HMAC-SHA256). The salt and IV are generated with
 * `crypto.getRandomValues` (cryptographically secure).
 *
 * The pure helpers (`generateSalt`, `generateIv`, `deriveKey`, `encryptText`,
 * `decryptText`, `toBase64`, `fromBase64`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useEncryptDecrypt()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** AES-GCM IV length (bytes). Fixed by NIST SP 800-38D recommendation. */
export const IV_LENGTH = 12;
/** AES key length (bits). AES-256. */
export const KEY_LENGTH_BITS = 256;
/** AES key length (bytes). */
export const KEY_LENGTH = KEY_LENGTH_BITS / 8;
/** PBKDF2 hash algorithm. */
export const PBKDF2_HASH = 'SHA-256';
/** Default PBKDF2 iteration count (OWASP 2023 guidance for PBKDF2-HMAC-SHA256). */
export const DEFAULT_ITERATIONS = 250_000;
/** Minimum PBKDF2 iterations (enforced floor). */
export const MIN_ITERATIONS = 1_000;
/** Maximum PBKDF2 iterations (sanity ceiling — keeps UI responsive). */
export const MAX_ITERATIONS = 1_000_000;
/** Default salt length (bytes). */
export const DEFAULT_SALT_LENGTH = 16;
/** Allowed salt lengths (bytes). */
export const SALT_LENGTH_OPTIONS = [8, 16, 24, 32] as const;
/** Maximum salt length storable in the 1-byte length prefix. */
export const MAX_SALT_LENGTH = 255;

/** Tool mode. */
export type EncryptMode = 'encrypt' | 'decrypt';

/** Options for `encryptText`. */
export interface EncryptTextOptions {
  /** Passphrase used to derive the AES key via PBKDF2. */
  passphrase: string;
  /** PBKDF2 iteration count. */
  iterations?: number;
  /** Salt length in bytes. Defaults to 16. */
  saltLength?: number;
  /** Optional pre-generated salt (for deterministic tests). */
  salt?: Uint8Array;
  /** Optional pre-generated IV (for deterministic tests). */
  iv?: Uint8Array;
}

/** Options for `decryptText`. */
export interface DecryptTextOptions {
  /** Passphrase used to derive the AES key via PBKDF2. */
  passphrase: string;
  /** PBKDF2 iteration count. Must match the value used at encryption time. */
  iterations?: number;
}

/**
 * Generate a cryptographically secure random salt of the given length.
 * Throws if `length` is not a positive integer ≤ 255.
 */
export function generateSalt(length: number = DEFAULT_SALT_LENGTH): Uint8Array {
  if (!Number.isInteger(length) || length <= 0 || length > MAX_SALT_LENGTH) {
    throw new Error(
      `Salt length must be an integer between 1 and ${MAX_SALT_LENGTH}`,
    );
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** Generate a cryptographically secure random 12-byte AES-GCM IV. */
export function generateIv(): Uint8Array {
  const bytes = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Derive an AES-GCM 256-bit CryptoKey from a passphrase + salt using PBKDF2
 * with HMAC-SHA-256. The returned key is usable for both encryption and
 * decryption (`['encrypt', 'decrypt']`).
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<CryptoKey> {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error('Iterations must be a positive integer');
  }
  const subtle = ensureSubtle();
  // Import the passphrase as raw key material for PBKDF2.
  const keyMaterial = await subtle.importKey(
    'raw',
    toBuffer(encodeUtf8(passphrase)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  // Derive a 256-bit AES-GCM key.
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toBuffer(salt),
      iterations,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt `plaintext` with AES-GCM using a PBKDF2-derived key. Returns a
 * base64 string of the wire format:
 *   [1 byte saltLen][salt][12 byte IV][ciphertext+authTag]
 */
export async function encryptText(
  plaintext: string,
  options: EncryptTextOptions,
): Promise<string> {
  const {
    passphrase,
    iterations = DEFAULT_ITERATIONS,
    saltLength = DEFAULT_SALT_LENGTH,
    salt,
    iv,
  } = options;
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('Passphrase is required');
  }
  const subtle = ensureSubtle();
  const usedSalt = salt ?? generateSalt(saltLength);
  if (usedSalt.length > MAX_SALT_LENGTH) {
    throw new Error(`Salt length must be ≤ ${MAX_SALT_LENGTH} bytes`);
  }
  const usedIv = iv ?? generateIv();
  if (usedIv.length !== IV_LENGTH) {
    throw new Error(`IV length must be exactly ${IV_LENGTH} bytes`);
  }
  const key = await deriveKey(passphrase, usedSalt, iterations);
  const plaintextBytes = toBuffer(encodeUtf8(plaintext));
  const ciphertext = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv: toBuffer(usedIv) }, key, plaintextBytes),
  );
  // Assemble the wire format: [saltLen][salt][iv][ciphertext].
  const out = new Uint8Array(1 + usedSalt.length + IV_LENGTH + ciphertext.length);
  out[0] = usedSalt.length;
  out.set(usedSalt, 1);
  out.set(usedIv, 1 + usedSalt.length);
  out.set(ciphertext, 1 + usedSalt.length + IV_LENGTH);
  return toBase64(out);
}

/**
 * Decrypt a base64-encoded wire-format blob produced by `encryptText` using a
 * PBKDF2-derived AES-GCM key. Returns the recovered plaintext. Throws if the
 * passphrase is wrong, the blob is malformed, or the authentication tag fails
 * (tampering).
 */
export async function decryptText(
  base64: string,
  options: DecryptTextOptions,
): Promise<string> {
  const { passphrase, iterations = DEFAULT_ITERATIONS } = options;
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('Passphrase is required');
  }
  if (typeof base64 !== 'string' || base64.length === 0) {
    throw new Error('Ciphertext is required');
  }
  const subtle = ensureSubtle();
  const bytes = fromBase64(base64.trim());
  // Minimum: 1 (saltLen) + 1 (min salt) + IV + 16 (GCM tag) = 30 bytes.
  const minLen = 1 + 1 + IV_LENGTH + 16;
  if (bytes.length < minLen) {
    throw new Error('Ciphertext is too short or malformed');
  }
  const saltLen = bytes[0]!;
  if (saltLen === 0) {
    throw new Error('Invalid ciphertext: salt length is zero');
  }
  const headerLen = 1 + saltLen + IV_LENGTH;
  if (bytes.length < headerLen + 16) {
    throw new Error('Invalid ciphertext: truncated payload');
  }
  const salt = bytes.slice(1, 1 + saltLen);
  const iv = bytes.slice(1 + saltLen, headerLen);
  const ciphertext = bytes.slice(headerLen);
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    key,
    toBuffer(ciphertext),
  );
  return decodeUtf8(new Uint8Array(plaintext));
}

/* -------------------------------------------------------------------------- */
/* Base64 helpers (binary-safe, handles UTF-8 correctly)                      */
/* -------------------------------------------------------------------------- */

/** Encode a Uint8Array to a base64 string (binary-safe). */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Decode a base64 string to a Uint8Array. Throws on invalid input. */
export function fromBase64(b64: string): Uint8Array {
  const cleaned = b64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/* -------------------------------------------------------------------------- */
/* UTF-8 helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Encode a string as UTF-8 bytes. */
export function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Decode UTF-8 bytes to a string. */
export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Copy any byte source into a fresh `Uint8Array<ArrayBuffer>`. The strict TS
 * lib defs require `BufferSource` to be backed by a real `ArrayBuffer` (not
 * `SharedArrayBuffer`); `TextEncoder.encode` and `Uint8Array.slice()` return
 * `Uint8Array<ArrayBufferLike>`, which TS rejects. Copying into a
 * `new Uint8Array(length)` (always ArrayBuffer-backed) satisfies the type and
 * is safe for the small inputs we feed to `crypto.subtle`.
 */
function toBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/** Access `crypto.subtle` with a helpful error if unavailable. */
function ensureSubtle(): SubtleCrypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available');
  }
  return crypto.subtle;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseEncryptDecryptReturn {
  mode: Ref<EncryptMode>;
  text: Ref<string>;
  passphrase: Ref<string>;
  iterations: Ref<number>;
  saltLength: Ref<number>;
  output: Ref<string>;
  processing: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  process: () => Promise<void>;
}

export function useEncryptDecrypt(): UseEncryptDecryptReturn {
  const mode = ref<EncryptMode>('encrypt');
  const text = ref<string>('');
  const passphrase = ref<string>('');
  const iterations = ref<number>(DEFAULT_ITERATIONS);
  const saltLength = ref<number>(DEFAULT_SALT_LENGTH);
  const output = ref<string>('');
  const processing = ref<boolean>(false);
  const error = ref<string>('');

  async function process(): Promise<void> {
    error.value = '';
    output.value = '';
    if (!text.value) {
      error.value = 'Text is required';
      return;
    }
    if (!passphrase.value) {
      error.value = 'Passphrase is required';
      return;
    }
    processing.value = true;
    try {
      if (mode.value === 'encrypt') {
        output.value = await encryptText(text.value, {
          passphrase: passphrase.value,
          iterations: iterations.value,
          saltLength: saltLength.value,
        });
      } else {
        output.value = await decryptText(text.value, {
          passphrase: passphrase.value,
          iterations: iterations.value,
        });
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      output.value = '';
    } finally {
      processing.value = false;
    }
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mode === 'string' && (p.mode === 'encrypt' || p.mode === 'decrypt')) {
        mode.value = p.mode as EncryptMode;
      }
      if (typeof p.text === 'string') text.value = p.text;
      if (typeof p.passphrase === 'string') passphrase.value = p.passphrase;
      if (
        typeof p.iterations === 'number' &&
        p.iterations >= MIN_ITERATIONS &&
        p.iterations <= MAX_ITERATIONS
      ) {
        iterations.value = Math.floor(p.iterations);
      }
      if (typeof p.saltLength === 'number' && SALT_LENGTH_OPTIONS.includes(p.saltLength as 8 | 16 | 24 | 32)) {
        saltLength.value = p.saltLength;
      }
      if (p.process === true) {
        void process();
      }
    },
  });

  // Relay output to the parent whenever it changes (embed only).
  watch(output, (value) => {
    if (!isEmbed.value) return;
    sendOutput({ output: value });
  });

  return {
    mode,
    text,
    passphrase,
    iterations,
    saltLength,
    output,
    processing,
    error,
    isEmbed,
    input,
    process,
  };
}
