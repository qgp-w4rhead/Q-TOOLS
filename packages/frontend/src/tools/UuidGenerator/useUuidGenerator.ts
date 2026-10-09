/**
 * useUuidGenerator - composable + pure logic for the UUIDs generator tool.
 *
 * Generates UUIDs of versions 1, 3, 4 and 5 (RFC 4122):
 *   - v1: timestamp + clock sequence + node (random node with the multicast
 *     bit set per RFC 4122 §4.5 for privacy).
 *   - v3: MD5(namespace + name) - MD5 implemented in pure JS (Web Crypto has
 *     no MD5) so the tool introduces no external dependency.
 *   - v4: `crypto.randomUUID()` (cryptographically secure random).
 *   - v5: SHA-1(namespace + name) via Web Crypto `crypto.subtle.digest`.
 *
 * The pure helpers (`md5`, `sha1Bytes`, `uuidToBytes`, `bytesToUuid`,
 * `formatUuid`, `generateV1`, `generateV3`, `generateV4`, `generateV5`,
 * `generateUuids`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useUuidGenerator()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * Randomness always uses the Web Crypto API (`crypto.getRandomValues` /
 * `crypto.subtle` / `crypto.randomUUID`) - never `Math.random()`.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Supported UUID versions. */
export type UuidVersion = 'v1' | 'v3' | 'v4' | 'v5';

/** Quantity bounds (from milestone.md acceptance criteria). */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10000;
export const DEFAULT_QUANTITY = 1;

/** The nil UUID (all zeros). */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Well-known namespace UUIDs (RFC 4122 Appendix C). */
export const NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_OID = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_X500 = '6ba7b814-9dad-11d1-80b4-00c04fd430c8';

/** Namespace preset options exposed in the UI. */
export interface NamespacePreset {
  id: 'dns' | 'url' | 'oid' | 'x500' | 'custom';
  label: string;
  value: string;
}

export const NAMESPACE_PRESETS: NamespacePreset[] = [
  { id: 'dns', label: 'DNS', value: NAMESPACE_DNS },
  { id: 'url', label: 'URL', value: NAMESPACE_URL },
  { id: 'oid', label: 'OID', value: NAMESPACE_OID },
  { id: 'x500', label: 'X.500', value: NAMESPACE_X500 },
  { id: 'custom', label: 'Custom', value: '' },
];

/** Regex matching a canonical hyphenated UUID (any case). */
export const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Check whether `value` is a canonical hyphenated UUID string. */
export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Convert a hex string to a byte array (length must be even). */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Convert a byte array to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, '0');
  }
  return s;
}

/** Parse a canonical hyphenated UUID string into 16 bytes. Throws if invalid. */
export function uuidToBytes(uuid: string): Uint8Array {
  if (!isValidUuid(uuid)) throw new Error(`Invalid UUID: ${uuid}`);
  return hexToBytes(uuid.replace(/-/g, ''));
}

/**
 * Format 16 raw UUID bytes into a string, applying version/variant bits is the
 * caller's responsibility. `hyphenated` controls the canonical dashes;
 * `uppercase` controls letter case.
 */
export function formatUuid(
  bytes: Uint8Array,
  options: { hyphenated?: boolean; uppercase?: boolean } = {},
): string {
  if (bytes.length !== 16) throw new Error('UUID must be 16 bytes');
  const { hyphenated = true, uppercase = false } = options;
  const hex = bytesToHex(bytes);
  let out: string;
  if (hyphenated) {
    out = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } else {
    out = hex;
  }
  return uppercase ? out.toUpperCase() : out;
}

/* -------------------------------------------------------------------------- */
/* MD5 - compact pure-JS implementation (Web Crypto has no MD5)               */
/* -------------------------------------------------------------------------- */

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

function rotl(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c));
}

/**
 * Compute the MD5 digest of `data` and return 16 raw bytes. Pure JS
 * implementation - no external dependency.
 */
export function md5(data: Uint8Array): Uint8Array {
  // Pre-processing: padding the message.
  const originalLength = data.length;
  const bitLen = originalLength * 8;
  // Append 0x80, then zero bytes, then 64-bit little-endian length.
  const paddedLength = (((originalLength + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLength);
  msg.set(data);
  msg[originalLength] = 0x80;
  // 64-bit little-endian length (we only use the low 32 bits - data is small).
  const lenView = new DataView(msg.buffer);
  lenView.setUint32(paddedLength - 8, bitLen >>> 0, true);
  lenView.setUint32(paddedLength - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const view = new DataView(msg.buffer);
  for (let off = 0; off < paddedLength; off += 64) {
    const M = new Array<number>(16);
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(off + i * 4, true);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + MD5_K[i]! + M[g]!) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, MD5_S[i]!)) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}

/* -------------------------------------------------------------------------- */
/* SHA-1 via Web Crypto (returns 20 raw bytes)                                */
/* -------------------------------------------------------------------------- */

/** Compute the SHA-1 digest of `data` via Web Crypto. Returns 20 bytes. */
export async function sha1Bytes(data: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer-backed Uint8Array so the strict TS lib defs
  // accept it as a BufferSource (Uint8Array<ArrayBufferLike> may be
  // SharedArrayBuffer-backed).
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const digest = await crypto.subtle.digest('SHA-1', copy);
  return new Uint8Array(digest);
}

/* -------------------------------------------------------------------------- */
/* UUID generation                                                            */
/* -------------------------------------------------------------------------- */

/** UUID v1 epoch offset: 1582-10-15 00:00:00 UTC in 100-ns intervals. */
const UUID_EPOCH_100NS = 122192928000000000n;

/** Cached v1 state across calls within a process tick (clock sequence + node). */
let v1ClockSeq = -1;
let v1Node: Uint8Array | null = null;

/** Initialise (or reuse) the v1 clock sequence and node bytes. */
function ensureV1State(): void {
  if (v1ClockSeq >= 0 && v1Node) return;
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  // 14-bit clock sequence (bits 6-7 of byte 0 are the variant).
  v1ClockSeq = (buf[0]! << 8) | buf[1]!;
  v1ClockSeq &= 0x3fff;
  // 6-byte node with the multicast bit set (RFC 4122 §4.5 - random node).
  v1Node = new Uint8Array(6);
  crypto.getRandomValues(v1Node);
  v1Node[0]! |= 0x01;
}

/**
 * Generate a UUID v1 (timestamp-based). Uses the current time, a random 14-bit
 * clock sequence, and a random 6-byte node with the multicast bit set per
 * RFC 4122 §4.5 (privacy). Returns 16 raw bytes (version/variant bits set).
 */
export function generateV1(): Uint8Array {
  ensureV1State();
  // 100-ns intervals since the UUID epoch (1582-10-15). Date.now() is ms.
  const ts = BigInt(Date.now()) * 10000n + UUID_EPOCH_100NS;
  const timeLow = Number(ts & 0xffffffffn);
  const timeMid = Number((ts >> 32n) & 0xffffn);
  const timeHi = Number((ts >> 48n) & 0x0fffn);

  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  view.setUint32(0, timeLow >>> 0, false); // big-endian
  view.setUint16(4, timeMid & 0xffff, false);
  view.setUint16(6, (timeHi & 0x0fff) | 0x1000, false); // version 1
  // Clock sequence + reserved (variant 10xx).
  view.setUint16(8, ((v1ClockSeq & 0x3fff) | 0x8000) >>> 0, false);
  out.set(v1Node!, 10);
  return out;
}

/**
 * Generate a UUID v3 (MD5 namespace + name). `namespaceBytes` is 16 bytes;
 * `name` is UTF-8 encoded. Returns 16 raw bytes (version 3 / variant bits set).
 */
export function generateV3(namespaceBytes: Uint8Array, name: string): Uint8Array {
  if (namespaceBytes.length !== 16) {
    throw new Error('Namespace must be 16 bytes');
  }
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(16 + nameBytes.length);
  input.set(namespaceBytes, 0);
  input.set(nameBytes, 16);
  const hash = md5(input);
  // Set version (3) and variant (10xx) bits.
  hash[6]! = (hash[6]! & 0x0f) | 0x30;
  hash[8]! = (hash[8]! & 0x3f) | 0x80;
  return hash;
}

/**
 * Generate a UUID v4 (random) using `crypto.randomUUID()`. Returns the
 * canonical hyphenated lowercase string (formatting applied by the caller via
 * `uuidToBytes` + `formatUuid` when needed).
 */
export function generateV4(): Uint8Array {
  // crypto.randomUUID() is available in secure contexts (browsers + Node 19+).
  return uuidToBytes(crypto.randomUUID());
}

/**
 * Generate a UUID v5 (SHA-1 namespace + name). `namespaceBytes` is 16 bytes;
 * `name` is UTF-8 encoded. Returns 16 raw bytes (version 5 / variant bits set).
 */
export async function generateV5(
  namespaceBytes: Uint8Array,
  name: string,
): Promise<Uint8Array> {
  if (namespaceBytes.length !== 16) {
    throw new Error('Namespace must be 16 bytes');
  }
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(16 + nameBytes.length);
  input.set(namespaceBytes, 0);
  input.set(nameBytes, 16);
  const hash = await sha1Bytes(input);
  const out = hash.slice(0, 16);
  // Set version (5) and variant (10xx) bits.
  out[6]! = (out[6]! & 0x0f) | 0x50;
  out[8]! = (out[8]! & 0x3f) | 0x80;
  return out;
}

/** Options for `generateUuids`. */
export interface GenerateUuidsOptions {
  version: UuidVersion;
  quantity: number;
  uppercase: boolean;
  hyphenated: boolean;
  /** Required for v3/v5: the namespace UUID string (canonical hyphenated). */
  namespace?: string;
  /** Required for v3/v5: the name to hash with the namespace. */
  name?: string;
}

/**
 * Generate `quantity` UUIDs of the requested version with the given formatting.
 * Returns an array of formatted UUID strings. Throws on invalid options.
 */
export async function generateUuids(
  options: GenerateUuidsOptions,
): Promise<string[]> {
  const { version, quantity, uppercase, hyphenated } = options;
  if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
    throw new Error(`Quantity must be an integer between ${MIN_QUANTITY} and ${MAX_QUANTITY}`);
  }
  const out: string[] = [];

  if (version === 'v1') {
    for (let i = 0; i < quantity; i++) {
      out.push(formatUuid(generateV1(), { hyphenated, uppercase }));
    }
    return out;
  }
  if (version === 'v4') {
    for (let i = 0; i < quantity; i++) {
      out.push(formatUuid(generateV4(), { hyphenated, uppercase }));
    }
    return out;
  }

  // v3 / v5 require a namespace + name.
  const ns = options.namespace ?? '';
  const name = options.name ?? '';
  if (!isValidUuid(ns)) {
    throw new Error('Namespace must be a valid canonical UUID (e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8)');
  }
  if (name.length === 0) {
    throw new Error('A name is required for UUID v3/v5');
  }
  const nsBytes = uuidToBytes(ns);

  if (version === 'v3') {
    for (let i = 0; i < quantity; i++) {
      out.push(formatUuid(generateV3(nsBytes, name), { hyphenated, uppercase }));
    }
    return out;
  }
  // v5
  for (let i = 0; i < quantity; i++) {
    out.push(formatUuid(await generateV5(nsBytes, name), { hyphenated, uppercase }));
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseUuidGeneratorReturn {
  version: Ref<UuidVersion>;
  quantity: Ref<number>;
  uppercase: Ref<boolean>;
  hyphenated: Ref<boolean>;
  /** Namespace preset id (dns/url/oid/x500/custom). */
  namespacePreset: Ref<NamespacePreset['id']>;
  /** Custom namespace UUID string (used when preset === 'custom'). */
  customNamespace: Ref<string>;
  /** Effective namespace UUID string (preset value or custom). */
  namespace: ComputedRef<string>;
  /** Name input for v3/v5. */
  name: Ref<string>;
  /** Generated UUID strings. */
  uuids: Ref<string[]>;
  generating: Ref<boolean>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  generate: () => Promise<void>;
}

export function useUuidGenerator(): UseUuidGeneratorReturn {
  const version = ref<UuidVersion>('v4');
  const quantity = ref<number>(DEFAULT_QUANTITY);
  const uppercase = ref<boolean>(false);
  const hyphenated = ref<boolean>(true);
  const namespacePreset = ref<NamespacePreset['id']>('dns');
  const customNamespace = ref<string>('');
  const name = ref<string>('');
  const uuids = ref<string[]>([]);
  const generating = ref<boolean>(false);
  const error = ref<string>('');

  /** Effective namespace UUID string derived from the preset selection. */
  const namespace = computed<string>(() => {
    if (namespacePreset.value === 'custom') return customNamespace.value;
    const preset = NAMESPACE_PRESETS.find((p) => p.id === namespacePreset.value);
    return preset ? preset.value : NAMESPACE_DNS;
  });

  async function generate(): Promise<void> {
    error.value = '';
    generating.value = true;
    try {
      const result = await generateUuids({
        version: version.value,
        quantity: quantity.value,
        uppercase: uppercase.value,
        hyphenated: hyphenated.value,
        namespace: namespace.value,
        name: name.value,
      });
      uuids.value = result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      uuids.value = [];
    } finally {
      generating.value = false;
    }
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.version === 'string' && ['v1', 'v3', 'v4', 'v5'].includes(p.version)) {
        version.value = p.version as UuidVersion;
      }
      if (typeof p.quantity === 'number' && p.quantity >= MIN_QUANTITY && p.quantity <= MAX_QUANTITY) {
        quantity.value = Math.floor(p.quantity);
      }
      if (typeof p.uppercase === 'boolean') uppercase.value = p.uppercase;
      if (typeof p.hyphenated === 'boolean') hyphenated.value = p.hyphenated;
      if (typeof p.namespace === 'string') {
        customNamespace.value = p.namespace;
        namespacePreset.value = 'custom';
      }
      if (typeof p.name === 'string') name.value = p.name;
      if (p.generate === true) {
        void generate();
      }
    },
  });

  // Relay output to the parent whenever the generated list changes (embed only).
  watch(uuids, (list) => {
    if (!isEmbed.value) return;
    sendOutput({ uuids: list });
  });

  return {
    version,
    quantity,
    uppercase,
    hyphenated,
    namespacePreset,
    customNamespace,
    namespace,
    name,
    uuids,
    generating,
    error,
    isEmbed,
    input,
    generate,
  };
}
