/**
 * useIpv6UlaGenerator — composable + pure logic for the IPv6 ULA generator.
 *
 * Generates IPv6 Unique Local Addresses (ULA) per RFC 4193. The ULA prefix
 * lives in `fd00::/8` (the locally-assigned half of `fc00::/7`). A /48 ULA
 * prefix is composed of:
 *
 *   | 8 bits (fd) | 40 bits Global ID | 16 bits Subnet ID | 64 bits host |
 *        L=1            random               configurable         zero
 *
 * The 40-bit Global ID and 16-bit Subnet ID are generated with
 * `crypto.getRandomValues()` unless the caller supplies an explicit prefix
 * or subnet ID. The first byte is always forced to `fd` so the result is a
 * valid locally-assigned ULA.
 *
 * Pure helpers (`randomBytes`, `parsePrefixInput`, `parseSubnetIdInput`,
 * `generateGlobalId`, `generateSubnetId`, `formatIpv6Groups`, `buildUla`,
 * `generateUla`, `generateUlas`, `clampQuantity`) have no Vue dependency and
 * can be imported standalone for unit testing or reuse. The
 * `useIpv6UlaGenerator()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies — only the Web Crypto API (`crypto.getRandomValues`).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A 48-bit ULA prefix as 6 bytes: [0]=0xfd, [1..5]=40-bit Global ID. */
export type UlaPrefixBytes = [number, number, number, number, number, number];

/** A 16-bit Subnet ID as 2 bytes. */
export type SubnetIdBytes = [number, number];

/** Configuration for ULA generation. */
export interface UlaGeneratorOptions {
  /** Optional 48-bit prefix as a hex string (e.g. `fd12:3456:7890`). Empty = random. */
  prefix: string;
  /** Optional 16-bit subnet ID as a hex string (e.g. `0001`). Empty = random. */
  subnetId: string;
  /** Number of ULA prefixes to generate (1-1000). */
  quantity: number;
}

/** Defaults for a fresh generator config. */
export const DEFAULT_ULA_OPTIONS: UlaGeneratorOptions = {
  prefix: '',
  subnetId: '',
  quantity: 10,
};

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 1000;

/** A single generated ULA result. */
export interface UlaResult {
  /** The /48 ULA prefix in compressed IPv6 notation, e.g. `fd12:3456:7890::/48`. */
  prefix48: string;
  /** The /64 ULA prefix in compressed IPv6 notation, e.g. `fd12:3456:7890:1::/64`. */
  prefix64: string;
  /** The 40-bit Global ID as 10 uppercase hex digits (no separators). */
  globalId: string;
  /** The 16-bit Subnet ID as 4 uppercase hex digits. */
  subnetId: string;
  /** The full 48-bit prefix bytes as 12 uppercase hex digits (fd + global ID). */
  prefixBytes: string;
  /** The 8-hextet expanded address (first 4 hextets populated, last 4 zero). */
  expanded: string;
}

/**
 * Generate `n` cryptographically secure random bytes via
 * `crypto.getRandomValues()`. Falls back to a `Math.random`-based path only
 * in insecure contexts where the Web Crypto API is unavailable.
 */
export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/** Convert a byte array to lowercase hex (no separators). */
export function bytesToHex(bytes: Uint8Array | number[]): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** Generate a random 40-bit Global ID as 5 bytes. */
export function generateGlobalId(): Uint8Array {
  return randomBytes(5);
}

/** Generate a random 16-bit Subnet ID as 2 bytes. */
export function generateSubnetId(): Uint8Array {
  return randomBytes(2);
}

/**
 * Parse an optional 48-bit prefix input string into 6 bytes.
 *
 * Accepted forms:
 *  - `fd12:3456:7890`            (3 hextets, colon-separated)
 *  - `fd12:3456:7890::/48`       (CIDR notation — suffix stripped)
 *  - `fd12:3456:7890:0000:0:0:0:0` (full 8-hextet, first 3 used)
 *  - `fd1234567890`              (12 bare hex digits)
 *  - `fd:12:34:56:78:90`         (6 bytes, colon-separated)
 *  - `1234567890`                (10 bare hex digits — 40-bit Global ID, fd prepended)
 *  - `12:34:56:78:90`            (5 bytes — 40-bit Global ID, fd prepended)
 *
 * The first byte is always forced to `0xfd` so the result is a valid
 * locally-assigned ULA. Returns `null` if the input is empty or unparseable.
 */
export function parsePrefixInput(input: string): UlaPrefixBytes | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Strip CIDR suffix (/nn) if present.
  const slashIdx = trimmed.indexOf('/');
  const raw = slashIdx >= 0 ? trimmed.slice(0, slashIdx) : trimmed;

  // Determine the byte sequence from the input.
  let bytes: number[] = [];

  if (raw.includes(':')) {
    // Colon-separated — could be IPv6 hextets or colon-separated bytes.
    // Heuristic: if every part is 1-2 hex digits AND there are 4-6 parts,
    // treat as bytes (e.g. `fd:12:34:56:78:90`, `12:34:56:78:90`).
    // Otherwise treat as hextets (covers 1-3 hextet prefixes, full 8-hextet
    // addresses, and any group with a 3-4 digit hextet).
    const parts = raw.split(':').filter((p) => p !== '');
    if (parts.length === 0) return null;
    if (!parts.every((p) => /^[0-9a-fA-F]{1,4}$/.test(p))) return null;

    const allByteSized = parts.every((p) => p.length <= 2);
    const asBytes = allByteSized && parts.length >= 4 && parts.length <= 6;

    if (asBytes) {
      for (const p of parts) {
        bytes.push(parseInt(p, 16) & 0xff);
      }
    } else {
      // Hextets → 2 bytes each (take first 3 hextets = 6 bytes).
      for (const p of parts.slice(0, 3)) {
        const val = parseInt(p, 16);
        bytes.push((val >> 8) & 0xff, val & 0xff);
      }
    }
  } else {
    // Bare hex string.
    const hex = raw.replace(/[^0-9a-fA-F]/g, '');
    if (hex.length === 0) return null;
    if (hex.length % 2 !== 0) return null;
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
  }

  // Normalise to exactly 6 bytes.
  // If we got 5 bytes (40-bit Global ID without fd), prepend fd.
  if (bytes.length === 5) {
    bytes = [0xfd, ...bytes];
  }
  // If we got 6 bytes, use as-is (fd will be forced below).
  // If we got more than 6, take the first 6.
  // If we got fewer than 5, reject.
  if (bytes.length < 5) return null;
  if (bytes.length > 6) bytes = bytes.slice(0, 6);
  if (bytes.length === 5) bytes = [0xfd, ...bytes];

  // Force first byte to fd (ULA locally-assigned marker).
  bytes[0] = 0xfd;

  return [
    bytes[0]!,
    bytes[1]!,
    bytes[2]!,
    bytes[3]!,
    bytes[4]!,
    bytes[5]!,
  ];
}

/**
 * Parse an optional 16-bit Subnet ID input string into 2 bytes.
 *
 * Accepted forms:
 *  - `0001`        (4 bare hex digits)
 *  - `1`           (1-4 hex digits, zero-padded)
 *  - `0:01`        (2 bytes, colon-separated)
 *  - `::1`         (IPv6 trailing hextet)
 *
 * Returns `null` if the input is empty or unparseable.
 */
export function parseSubnetIdInput(input: string): SubnetIdBytes | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let hex = trimmed;
  // Strip leading colons (e.g. `::1` → `1`).
  hex = hex.replace(/^:+/, '');
  // Remove any colons within.
  hex = hex.replace(/:/g, '');
  // Strip CIDR suffix if present.
  const slashIdx = hex.indexOf('/');
  if (slashIdx >= 0) hex = hex.slice(0, slashIdx);

  if (!/^[0-9a-fA-F]{1,4}$/.test(hex)) return null;
  const val = parseInt(hex, 16);
  if (!Number.isFinite(val) || val < 0 || val > 0xffff) return null;
  return [(val >> 8) & 0xff, val & 0xff];
}

/**
 * Format 8 IPv6 hextets (each 0-0xffff) into compressed notation per RFC 5952:
 * the longest run of consecutive zero hextets (length >= 2) is replaced with
 * `::`. Hextets are lowercase per RFC 5952 §4.3.
 */
export function formatIpv6Groups(hextets: number[]): string {
  if (hextets.length !== 8) {
    throw new Error(`formatIpv6Groups expects 8 hextets, got ${hextets.length}`);
  }

  // Find the longest run of zeros (length >= 2).
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (hextets[i] === 0) {
      if (curStart < 0) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  const groups = hextets.map((h) => h.toString(16));

  if (bestLen < 2) {
    return groups.join(':');
  }

  const before = groups.slice(0, bestStart).join(':');
  const after = groups.slice(bestStart + bestLen).join(':');
  // `::` with nothing on one side still renders correctly.
  return `${before}::${after}`;
}

/**
 * Build a UlaResult from a 6-byte prefix (fd + 40-bit Global ID) and a
 * 2-byte Subnet ID.
 */
export function buildUla(
  prefixBytes: UlaPrefixBytes,
  subnetBytes: SubnetIdBytes,
): UlaResult {
  // 8 hextets: first 3 from prefix (6 bytes), 4th from subnet (2 bytes),
  // last 4 are zero (interface ID).
  const hextets = [
    (prefixBytes[0] << 8) | prefixBytes[1],
    (prefixBytes[2] << 8) | prefixBytes[3],
    (prefixBytes[4] << 8) | prefixBytes[5],
    (subnetBytes[0] << 8) | subnetBytes[1],
    0,
    0,
    0,
    0,
  ];

  const expanded = hextets.map((h) => h.toString(16).padStart(4, '0')).join(':');
  const prefix48 = `${formatIpv6Groups([
    hextets[0]!,
    hextets[1]!,
    hextets[2]!,
    0,
    0,
    0,
    0,
    0,
  ])}/48`;
  const prefix64 = `${formatIpv6Groups(hextets)}/64`;

  const globalId = bytesToHex(prefixBytes.slice(1)).toUpperCase();
  const subnetId = bytesToHex(subnetBytes).toUpperCase();
  const prefixHex = bytesToHex(prefixBytes).toUpperCase();

  return {
    prefix48,
    prefix64,
    globalId,
    subnetId,
    prefixBytes: prefixHex,
    expanded,
  };
}

/**
 * Generate a single ULA result. If `opts.prefix` is provided, it is parsed
 * and used; otherwise a random 40-bit Global ID is generated. If
 * `opts.subnetId` is provided, it is parsed and used; otherwise a random
 * 16-bit Subnet ID is generated.
 */
export function generateUla(opts: UlaGeneratorOptions): UlaResult {
  const parsedPrefix = parsePrefixInput(opts.prefix);
  const prefixBytes: UlaPrefixBytes = parsedPrefix
    ? parsedPrefix
    : (() => {
        const gid = generateGlobalId();
        return [0xfd, gid[0]!, gid[1]!, gid[2]!, gid[3]!, gid[4]!];
      })();

  const parsedSubnet = parseSubnetIdInput(opts.subnetId);
  const subnetBytes: SubnetIdBytes = parsedSubnet
    ? parsedSubnet
    : (() => {
        const s = generateSubnetId();
        return [s[0]!, s[1]!];
      })();

  return buildUla(prefixBytes, subnetBytes);
}

/**
 * Generate `quantity` ULA results. When a fixed prefix or subnet is supplied,
 * uniqueness is harder (small space), so we use a Set-based dedup with a
 * safety cap; when both are random, collisions are astronomically unlikely.
 */
export function generateUlas(
  opts: UlaGeneratorOptions,
  unique = true,
): UlaResult[] {
  const qty = clampQuantity(opts.quantity);
  if (!unique) {
    const out: UlaResult[] = [];
    for (let i = 0; i < qty; i++) out.push(generateUla(opts));
    return out;
  }
  const seen = new Set<string>();
  const out: UlaResult[] = [];
  let attempts = 0;
  const cap = Math.max(qty * 10, 1000);
  while (out.length < qty && attempts < cap) {
    const r = generateUla(opts);
    attempts++;
    if (seen.has(r.prefix64)) continue;
    seen.add(r.prefix64);
    out.push(r);
  }
  while (out.length < qty) out.push(generateUla(opts));
  return out;
}

/** Clamp the quantity into the valid [MIN_QUANTITY, MAX_QUANTITY] range. */
export function clampQuantity(n: number): number {
  if (!Number.isFinite(n)) return MIN_QUANTITY;
  const v = Math.trunc(n);
  if (v < MIN_QUANTITY) return MIN_QUANTITY;
  if (v > MAX_QUANTITY) return MAX_QUANTITY;
  return v;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseIpv6UlaGeneratorReturn {
  config: Ref<UlaGeneratorOptions>;
  results: Ref<UlaResult[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  regenerate: () => void;
}

export function useIpv6UlaGenerator(): UseIpv6UlaGeneratorReturn {
  const config = ref<UlaGeneratorOptions>({ ...DEFAULT_ULA_OPTIONS });
  const results = ref<UlaResult[]>([]);

  function regenerate(): void {
    results.value = generateUlas(config.value);
  }

  watch(
    config,
    () => {
      regenerate();
    },
    { deep: true, immediate: true },
  );

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.prefix === 'string') {
        config.value.prefix = p.prefix;
      } else if (typeof p.globalId === 'string') {
        // Accept a bare 40-bit global ID — prepend fd for the parser.
        const g = (p.globalId as string).trim().replace(/^fd/i, '');
        config.value.prefix = g;
      }
      if (typeof p.subnetId === 'string') {
        config.value.subnetId = p.subnetId;
      } else if (typeof p.subnet === 'string') {
        config.value.subnetId = p.subnet;
      }
      if (typeof p.quantity === 'number' || typeof p.count === 'number') {
        config.value.quantity = clampQuantity(
          (p.quantity as number) ?? (p.count as number),
        );
      }
      if (
        typeof p.input === 'string' ||
        typeof p.value === 'string' ||
        p.generate === true ||
        p.regenerate === true
      ) {
        regenerate();
      }
    },
  });

  watch(results, (r) => {
    if (isEmbed.value) {
      sendOutput({
        results: r,
        quantity: r.length,
        options: { ...config.value },
      });
    }
  });

  return { config, results, isEmbed, embedInput, regenerate };
}
