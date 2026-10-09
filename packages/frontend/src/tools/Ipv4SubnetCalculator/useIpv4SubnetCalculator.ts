/**
 * useIpv4SubnetCalculator - composable + pure logic for the IPv4 subnet
 * calculator tool.
 *
 * Parses an IPv4 address plus a CIDR prefix (e.g. `192.168.1.0/24`) or a dotted
 * subnet mask (e.g. `255.255.255.0`), then computes the full subnet breakdown:
 *   - network address
 *   - broadcast address
 *   - first + last usable host
 *   - number of usable hosts (hostCount = 2^(32-prefix) - 2, or 2 for /31, 1 for /32)
 *   - wildcard (inverse) mask
 *   - subnet mask (dotted)
 *   - CIDR notation
 *   - IP class (A/B/C/D/E)
 *   - private/public status (RFC 1918 + loopback + link-local)
 *   - binary representations of IP, mask, network, and wildcard
 *
 * All arithmetic uses 32-bit unsigned integers via `>>> 0` normalisation - no
 * BigInt needed (32 bits fits comfortably in JavaScript's safe-integer range).
 *
 * Pure helpers (`parseIpv4`, `parseCidr`, `parseSubnetMask`, `maskToPrefix`,
 * `prefixToMask`, `intToIpv4`, `ipv4ToInt`, `intToBinary`, `classifyIp`,
 * `isPrivateIp`, `calculateSubnet`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useIpv4SubnetCalculator()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** 32-bit unsigned integer representation of an IPv4 address (0 .. 2^32-1). */
export type Ipv4Int = number;

/** Octet tuple `[a, b, c, d]` (each 0-255). */
export type Ipv4Octets = [number, number, number, number];

/** Result of parsing an IPv4 dotted string. */
export interface Ipv4ParseResult {
  ok: boolean;
  /** 32-bit unsigned integer value (only valid when `ok`). */
  value: Ipv4Int;
  /** Octet tuple (only valid when `ok`). */
  octets: Ipv4Octets;
  /** Error message when `ok` is false. */
  error: string | null;
}

/** Result of parsing a CIDR prefix string (`0`-`32`). */
export interface CidrParseResult {
  ok: boolean;
  prefix: number;
  error: string | null;
}

/** Result of parsing a dotted subnet mask into a prefix length. */
export interface MaskParseResult {
  ok: boolean;
  prefix: number;
  /** 32-bit unsigned integer value of the mask (only valid when `ok`). */
  value: Ipv4Int;
  error: string | null;
}

/** Full subnet breakdown returned by `calculateSubnet`. */
export interface SubnetResult {
  /** Original IP as a 32-bit unsigned integer. */
  ipInt: Ipv4Int;
  /** Original IP as a dotted string. */
  ip: string;
  /** CIDR prefix length (0-32). */
  prefix: number;
  /** CIDR notation `ip/prefix` (using the original IP, not the network). */
  cidr: string;
  /** Network address as a dotted string. */
  network: string;
  /** Network address as a 32-bit unsigned integer. */
  networkInt: Ipv4Int;
  /** Broadcast address as a dotted string. */
  broadcast: string;
  /** Broadcast address as a 32-bit unsigned integer. */
  broadcastInt: Ipv4Int;
  /** First usable host as a dotted string. */
  firstHost: string;
  /** Last usable host as a dotted string. */
  lastHost: string;
  /** Number of usable hosts (2^(32-prefix) - 2; 2 for /31; 1 for /32). */
  hostCount: number;
  /** Total addresses in the subnet (2^(32-prefix)). */
  totalAddresses: number;
  /** Subnet mask as a dotted string. */
  subnetMask: string;
  /** Subnet mask as a 32-bit unsigned integer. */
  subnetMaskInt: Ipv4Int;
  /** Wildcard (inverse) mask as a dotted string. */
  wildcardMask: string;
  /** Wildcard mask as a 32-bit unsigned integer. */
  wildcardMaskInt: Ipv4Int;
  /** IP class: A, B, C, D, or E. */
  ipClass: 'A' | 'B' | 'C' | 'D' | 'E';
  /** Whether the address is in a private/reserved range. */
  isPrivate: boolean;
  /** Human-readable scope label (Private / Loopback / Link-local / Public / Reserved). */
  scope: string;
  /** Binary representation of the IP (dotted 8-bit groups). */
  binaryIp: string;
  /** Binary representation of the subnet mask. */
  binaryMask: string;
  /** Binary representation of the network address. */
  binaryNetwork: string;
  /** Binary representation of the wildcard mask. */
  binaryWildcard: string;
}

/**
 * Parse a dotted IPv4 string (`a.b.c.d`) into a 32-bit unsigned integer.
 *
 * Rules:
 *   - Exactly 4 octets separated by `.`.
 *   - Each octet is a decimal integer 0-255 (no leading zeros beyond `0`).
 *   - No whitespace, no extra characters.
 */
export function parseIpv4(input: string): Ipv4ParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, value: 0, octets: [0, 0, 0, 0], error: 'IP address is empty.' };
  }
  const parts = trimmed.split('.');
  if (parts.length !== 4) {
    return {
      ok: false,
      value: 0,
      octets: [0, 0, 0, 0],
      error: 'IPv4 address must have exactly 4 octets separated by dots.',
    };
  }
  const octets: Ipv4Octets = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const part = parts[i]!;
    if (!/^(?:0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(part)) {
      return {
        ok: false,
        value: 0,
        octets: [0, 0, 0, 0],
        error: `Octet ${i + 1} ("${part}") is not a valid decimal value (0-255, no leading zeros).`,
      };
    }
    octets[i] = Number.parseInt(part, 10);
  }
  return { ok: true, value: ipv4ToInt(octets), octets, error: null };
}

/** Convert an octet tuple to a 32-bit unsigned integer. */
export function ipv4ToInt(octets: Ipv4Octets): Ipv4Int {
  return (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
}

/** Convert a 32-bit unsigned integer to a dotted IPv4 string. */
export function intToIpv4(n: Ipv4Int): string {
  const v = n >>> 0;
  return `${(v >>> 24) & 0xff}.${(v >>> 16) & 0xff}.${(v >>> 8) & 0xff}.${v & 0xff}`;
}

/** Convert a 32-bit unsigned integer to a dotted binary string (8-bit groups). */
export function intToBinary(n: Ipv4Int): string {
  const v = n >>> 0;
  const bin = v.toString(2).padStart(32, '0');
  return `${bin.slice(0, 8)}.${bin.slice(8, 16)}.${bin.slice(16, 24)}.${bin.slice(24, 32)}`;
}

/**
 * Parse a CIDR prefix length (`0`-`32`).
 *
 * Accepts a bare number (`24`) or a full CIDR string (`192.168.1.0/24` - the IP
 * portion is ignored here; use `parseIpv4` separately).
 */
export function parseCidr(input: string): CidrParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, prefix: 0, error: 'CIDR prefix is empty.' };
  }
  // Allow a full `a.b.c.d/n` form - extract the part after the last `/`.
  const slashIdx = trimmed.lastIndexOf('/');
  let raw: string;
  if (slashIdx >= 0) {
    raw = trimmed.slice(slashIdx + 1).trim();
  } else {
    raw = trimmed;
  }
  if (!/^(?:[0-9]|[12][0-9]|3[0-2])$/.test(raw)) {
    return {
      ok: false,
      prefix: 0,
      error: 'CIDR prefix must be an integer between 0 and 32.',
    };
  }
  const prefix = Number.parseInt(raw, 10);
  return { ok: true, prefix, error: null };
}

/**
 * Convert a CIDR prefix length to a 32-bit unsigned subnet mask.
 *
 * `prefix` of 0 → `0.0.0.0`, 24 → `255.255.255.0`, 32 → `255.255.255.255`.
 */
export function prefixToMask(prefix: number): Ipv4Int {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff >>> 0;
  // `((0xffffffff << (32 - prefix)) >>> 0)` - shift left then normalise to
  // unsigned. The left shift produces a signed 32-bit value; the `>>> 0`
  // converts it back to an unsigned integer in [0, 2^32-1].
  return ((0xffffffff << (32 - prefix)) >>> 0);
}

/**
 * Convert a 32-bit subnet mask to its CIDR prefix length.
 *
 * Returns `null` if the mask is not a valid contiguous mask (e.g.
 * `255.0.255.0` is rejected).
 */
export function maskToPrefix(mask: Ipv4Int): number | null {
  const v = mask >>> 0;
  if (v === 0) return 0;
  // A valid contiguous mask is of the form `1^prefix 0^(32-prefix)`. Its
  // wildcard (inverse) `w = ~mask` is therefore of the form `0^prefix 1^(32-prefix)`
  // = `2^(32-prefix) - 1`, i.e. a value whose binary representation is all ones
  // in the low bits. The standard test for "x == 2^k - 1" is `(x & (x+1)) === 0`.
  const w = (~v) >>> 0;
  if (w === 0) return 32; // mask = 0xffffffff → prefix 32
  if ((w & (w + 1)) !== 0) return null; // non-contiguous mask (e.g. 255.0.255.0)
  // The prefix equals the number of leading zeros of the wildcard `w`.
  // Math.clz32(0) is defined as 32, so this also handles w === 0 above, but we
  // short-circuit for clarity.
  return Math.clz32(w);
}

/**
 * Parse a dotted subnet mask string into a CIDR prefix length.
 *
 * Validates that the mask is contiguous (no gaps in the run of 1s).
 */
export function parseSubnetMask(input: string): MaskParseResult {
  const parsed = parseIpv4(input);
  if (!parsed.ok) {
    return { ok: false, prefix: 0, value: 0, error: parsed.error };
  }
  const prefix = maskToPrefix(parsed.value);
  if (prefix === null) {
    return {
      ok: false,
      prefix: 0,
      value: 0,
      error: 'Subnet mask is not contiguous (e.g. 255.255.0.255 is invalid).',
    };
  }
  return { ok: true, prefix, value: parsed.value, error: null };
}

/**
 * Classify an IPv4 address into its class (A/B/C/D/E) based on the leading
 * bits of the first octet.
 */
export function classifyIp(ip: Ipv4Int): 'A' | 'B' | 'C' | 'D' | 'E' {
  const first = (ip >>> 24) & 0xff;
  if (first < 128) return 'A';
  if (first < 192) return 'B';
  if (first < 224) return 'C';
  if (first < 240) return 'D';
  return 'E';
}

/**
 * Determine whether an IPv4 address is in a private or reserved range.
 *
 * Returns a human-readable scope label:
 *   - `Loopback` (127.0.0.0/8)
 *   - `Private` (RFC 1918: 10/8, 172.16/12, 192.168/16)
 *   - `Link-local` (169.254/16)
 *   - `Reserved` (0/8, 240/4 - "this network" + class E future use)
 *   - `Public` (everything else)
 */
export function isPrivateIp(ip: Ipv4Int): { isPrivate: boolean; scope: string } {
  const a = (ip >>> 24) & 0xff;
  const b = (ip >>> 16) & 0xff;
  if (a === 127) return { isPrivate: true, scope: 'Loopback' };
  if (a === 10) return { isPrivate: true, scope: 'Private (10/8)' };
  if (a === 172 && b >= 16 && b <= 31) {
    return { isPrivate: true, scope: 'Private (172.16/12)' };
  }
  if (a === 192 && b === 168) {
    return { isPrivate: true, scope: 'Private (192.168/16)' };
  }
  if (a === 169 && b === 254) {
    return { isPrivate: true, scope: 'Link-local (169.254/16)' };
  }
  if (a === 0) return { isPrivate: true, scope: 'Reserved (0/8)' };
  if (a >= 240) return { isPrivate: true, scope: 'Reserved (240/4)' };
  return { isPrivate: false, scope: 'Public' };
}

/**
 * Compute the full subnet breakdown for an IP + CIDR prefix.
 *
 * Host-count rules:
 *   - /31 → 2 hosts (RFC 3021 point-to-point, no broadcast)
 *   - /32 → 1 host (single host route)
 *   - /0 .. /30 → 2^(32-prefix) - 2 usable hosts
 */
export function calculateSubnet(ip: Ipv4Int, prefix: number): SubnetResult {
  const mask = prefixToMask(prefix);
  const wildcard = (~mask) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;

  const totalAddresses = Math.pow(2, 32 - prefix);
  let hostCount: number;
  let firstHost: Ipv4Int;
  let lastHost: Ipv4Int;
  if (prefix >= 32) {
    hostCount = 1;
    firstHost = network;
    lastHost = network;
  } else if (prefix === 31) {
    // RFC 3021 point-to-point: both addresses are usable hosts.
    hostCount = 2;
    firstHost = network;
    lastHost = broadcast;
  } else {
    hostCount = totalAddresses - 2;
    firstHost = (network + 1) >>> 0;
    lastHost = (broadcast - 1) >>> 0;
  }

  const cls = classifyIp(ip);
  const { isPrivate, scope } = isPrivateIp(ip);

  return {
    ipInt: ip,
    ip: intToIpv4(ip),
    prefix,
    cidr: `${intToIpv4(ip)}/${prefix}`,
    network: intToIpv4(network),
    networkInt: network,
    broadcast: intToIpv4(broadcast),
    broadcastInt: broadcast,
    firstHost: intToIpv4(firstHost),
    lastHost: intToIpv4(lastHost),
    hostCount,
    totalAddresses,
    subnetMask: intToIpv4(mask),
    subnetMaskInt: mask,
    wildcardMask: intToIpv4(wildcard),
    wildcardMaskInt: wildcard,
    ipClass: cls,
    isPrivate,
    scope,
    binaryIp: intToBinary(ip),
    binaryMask: intToBinary(mask),
    binaryNetwork: intToBinary(network),
    binaryWildcard: intToBinary(wildcard),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseIpv4SubnetCalculatorReturn {
  ipInput: Ref<string>;
  maskInput: Ref<string>;
  result: Ref<SubnetResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

/**
 * Resolve the user's mask input into a CIDR prefix.
 *
 * Accepts:
 *   - A bare prefix (`24`)
 *   - A full CIDR form (`192.168.1.0/24`) - the IP portion is ignored
 *   - A dotted subnet mask (`255.255.255.0`)
 */
function resolvePrefix(maskInput: string): { ok: boolean; prefix: number; error: string | null } {
  const trimmed = maskInput.trim();
  if (trimmed.length === 0) {
    return { ok: false, prefix: 0, error: 'Enter a CIDR prefix (e.g. 24) or subnet mask (e.g. 255.255.255.0).' };
  }
  // If it contains a dot, treat as a subnet mask.
  if (trimmed.includes('.')) {
    const r = parseSubnetMask(trimmed);
    if (!r.ok) return { ok: false, prefix: 0, error: r.error };
    return { ok: true, prefix: r.prefix, error: null };
  }
  // Otherwise treat as a CIDR prefix number.
  const r = parseCidr(trimmed);
  if (!r.ok) return { ok: false, prefix: 0, error: r.error };
  return { ok: true, prefix: r.prefix, error: null };
}

export function useIpv4SubnetCalculator(): UseIpv4SubnetCalculatorReturn {
  const ipInput = ref<string>('');
  const maskInput = ref<string>('24');
  const result = ref<SubnetResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const ip = ipInput.value.trim();
    const mask = maskInput.value.trim();
    if (ip.length === 0 && mask.length === 0) {
      result.value = null;
      error.value = null;
      return;
    }
    if (ip.length === 0) {
      result.value = null;
      error.value = 'Enter an IPv4 address.';
      return;
    }
    const ipRes = parseIpv4(ip);
    if (!ipRes.ok) {
      result.value = null;
      error.value = ipRes.error;
      return;
    }
    // Allow the IP field to contain a full `a.b.c.d/n` form - extract the
    // prefix from there if the mask field is empty.
    let prefixSource = mask;
    if (mask.length === 0 && ip.includes('/')) {
      prefixSource = ip.slice(ip.indexOf('/') + 1);
    }
    if (prefixSource.length === 0) {
      result.value = null;
      error.value = 'Enter a CIDR prefix (e.g. 24) or subnet mask (e.g. 255.255.255.0).';
      return;
    }
    const prefixRes = resolvePrefix(prefixSource);
    if (!prefixRes.ok) {
      result.value = null;
      error.value = prefixRes.error;
      return;
    }
    error.value = null;
    result.value = calculateSubnet(ipRes.value, prefixRes.prefix);
  }

  watch([ipInput, maskInput], recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.ip === 'string') {
        ipInput.value = p.ip;
      } else if (typeof p.address === 'string') {
        ipInput.value = p.address;
      } else if (typeof p.input === 'string') {
        ipInput.value = p.input;
      } else if (typeof p.value === 'string') {
        ipInput.value = p.value;
      }
      if (typeof p.cidr === 'string') {
        maskInput.value = p.cidr;
      } else if (typeof p.prefix === 'string') {
        maskInput.value = p.prefix;
      } else if (typeof p.mask === 'string') {
        maskInput.value = p.mask;
      } else if (typeof p.subnetMask === 'string') {
        maskInput.value = p.subnetMask;
      } else if (typeof p.prefix === 'number') {
        maskInput.value = String(p.prefix);
      } else if (typeof p.cidr === 'number') {
        maskInput.value = String(p.cidr);
      }
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          ip: r.ip,
          cidr: r.cidr,
          prefix: r.prefix,
          network: r.network,
          broadcast: r.broadcast,
          firstHost: r.firstHost,
          lastHost: r.lastHost,
          hostCount: r.hostCount,
          totalAddresses: r.totalAddresses,
          subnetMask: r.subnetMask,
          wildcardMask: r.wildcardMask,
          ipClass: r.ipClass,
          isPrivate: r.isPrivate,
          scope: r.scope,
          binaryIp: r.binaryIp,
          binaryMask: r.binaryMask,
          binaryNetwork: r.binaryNetwork,
          binaryWildcard: r.binaryWildcard,
        });
      } else {
        sendOutput({ error: error.value });
      }
    }
  });

  return { ipInput, maskInput, result, error, isEmbed, embedInput, recompute };
}
