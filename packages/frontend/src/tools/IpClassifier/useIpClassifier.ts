/**
 * useIpClassifier - composable + pure logic for the IP address classifier
 * tool.
 *
 * Classifies an IPv4 or IPv6 address against the IANA special-purpose
 * registries (RFC 6890 for IPv4, RFC 4291 + friends for IPv6) using a
 * longest-prefix match, and reports the scope category (private, loopback,
 * link-local, multicast, CGNAT, documentation, reserved, …), the matching
 * CIDR range, and the governing RFC.
 *
 * Pure helpers (`parseIpv4`, `parseIpv6`, `classifyIpv4`, `classifyIpv6`,
 * `classifyIp`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useIpClassifier()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies - 32-bit integer + 8-hextet array math only.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export type Ipv4Int = number;
export type Ipv6Hextets = [
  number, number, number, number, number, number, number, number,
];

/** Scope category for a classified address. */
export type IpScope =
  | 'private'
  | 'loopback'
  | 'link-local'
  | 'multicast'
  | 'cgnat'
  | 'documentation'
  | 'reserved'
  | 'protocol'
  | 'broadcast'
  | 'public';

export interface IpClassification {
  /** IP version detected (4 or 6). */
  version: 4 | 6;
  /** Normalised input address. */
  address: string;
  /** Human-readable scope label (e.g. "Private (RFC 1918)"). */
  label: string;
  /** Scope category. */
  scope: IpScope;
  /** The special-purpose CIDR range the address falls in. */
  range: string;
  /** Governing RFC(s). */
  rfc: string;
  /** Longer description of the range's purpose. */
  description: string;
  /** Whether the address is globally routable (forwardable + reachable). */
  isGlobal: boolean;
  /** Whether the address is in a private/reserved (non-public) range. */
  isPrivate: boolean;
}

/* ---- IPv4 special-purpose registry (longest-prefix match) ---------------- */

interface V4Entry {
  network: Ipv4Int;
  prefix: number;
  cidr: string;
  label: string;
  scope: IpScope;
  rfc: string;
  description: string;
  isGlobal: boolean;
}

function v4(a: number, b: number, c: number, d: number): Ipv4Int {
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0);
}

const V4_REGISTRY: V4Entry[] = [
  { network: v4(0, 0, 0, 0), prefix: 32, cidr: '0.0.0.0/32', label: 'This host', scope: 'reserved', rfc: 'RFC 1122', description: '"This host on this network" - only valid as a source address.', isGlobal: false },
  { network: v4(0, 0, 0, 0), prefix: 8, cidr: '0.0.0.0/8', label: 'This network', scope: 'reserved', rfc: 'RFC 791', description: '"This network" - only valid as a source address.', isGlobal: false },
  { network: v4(10, 0, 0, 0), prefix: 8, cidr: '10.0.0.0/8', label: 'Private-use', scope: 'private', rfc: 'RFC 1918', description: 'Private address space - not routable on the public internet.', isGlobal: false },
  { network: v4(100, 64, 0, 0), prefix: 10, cidr: '100.64.0.0/10', label: 'CGNAT shared space', scope: 'cgnat', rfc: 'RFC 6598', description: 'Shared address space for carrier-grade NAT between ISP and subscriber.', isGlobal: false },
  { network: v4(127, 0, 0, 0), prefix: 8, cidr: '127.0.0.0/8', label: 'Loopback', scope: 'loopback', rfc: 'RFC 1122', description: 'Loopback - traffic never leaves the host.', isGlobal: false },
  { network: v4(169, 254, 0, 0), prefix: 16, cidr: '169.254.0.0/16', label: 'Link-local', scope: 'link-local', rfc: 'RFC 3927', description: 'Link-local (APIPA) - auto-configured, valid only on the local link.', isGlobal: false },
  { network: v4(172, 16, 0, 0), prefix: 12, cidr: '172.16.0.0/12', label: 'Private-use', scope: 'private', rfc: 'RFC 1918', description: 'Private address space - not routable on the public internet.', isGlobal: false },
  { network: v4(192, 0, 0, 0), prefix: 24, cidr: '192.0.0.0/24', label: 'IETF protocol assignments', scope: 'protocol', rfc: 'RFC 6890', description: 'Reserved for IETF protocol assignments (anycast services etc.).', isGlobal: false },
  { network: v4(192, 0, 2, 0), prefix: 24, cidr: '192.0.2.0/24', label: 'Documentation (TEST-NET-1)', scope: 'documentation', rfc: 'RFC 5737', description: 'Reserved for documentation and examples - not routable.', isGlobal: false },
  { network: v4(192, 31, 196, 0), prefix: 24, cidr: '192.31.196.0/24', label: 'AS112-v4', scope: 'protocol', rfc: 'RFC 7535', description: 'AS112 anycast sinkhole for DNAME/NS queries.', isGlobal: true },
  { network: v4(192, 52, 193, 0), prefix: 24, cidr: '192.52.193.0/24', label: 'AMT', scope: 'protocol', rfc: 'RFC 7450', description: 'Automatic Multicast Tunneling relays.', isGlobal: true },
  { network: v4(192, 88, 99, 0), prefix: 24, cidr: '192.88.99.0/24', label: '6to4 relay anycast (deprecated)', scope: 'reserved', rfc: 'RFC 3068 / RFC 7526', description: 'Formerly 6to4 relay anycast - deprecated, must not be used.', isGlobal: false },
  { network: v4(192, 168, 0, 0), prefix: 16, cidr: '192.168.0.0/16', label: 'Private-use', scope: 'private', rfc: 'RFC 1918', description: 'Private address space - not routable on the public internet.', isGlobal: false },
  { network: v4(192, 175, 48, 0), prefix: 24, cidr: '192.175.48.0/24', label: 'Direct Delegation AS112', scope: 'protocol', rfc: 'RFC 7534', description: 'AS112 project sinkhole service.', isGlobal: true },
  { network: v4(198, 18, 0, 0), prefix: 15, cidr: '198.18.0.0/15', label: 'Benchmarking', scope: 'reserved', rfc: 'RFC 2544', description: 'Reserved for network device benchmarking tests.', isGlobal: false },
  { network: v4(198, 51, 100, 0), prefix: 24, cidr: '198.51.100.0/24', label: 'Documentation (TEST-NET-2)', scope: 'documentation', rfc: 'RFC 5737', description: 'Reserved for documentation and examples - not routable.', isGlobal: false },
  { network: v4(203, 0, 113, 0), prefix: 24, cidr: '203.0.113.0/24', label: 'Documentation (TEST-NET-3)', scope: 'documentation', rfc: 'RFC 5737', description: 'Reserved for documentation and examples - not routable.', isGlobal: false },
  { network: v4(224, 0, 0, 0), prefix: 4, cidr: '224.0.0.0/4', label: 'Multicast', scope: 'multicast', rfc: 'RFC 5771', description: 'IPv4 multicast address block (includes local-scope 224.0.0.0/24).', isGlobal: false },
  { network: v4(233, 252, 0, 0), prefix: 24, cidr: '233.252.0.0/24', label: 'MCAST-TEST-NET', scope: 'documentation', rfc: 'RFC 7042', description: 'Multicast documentation/test range.', isGlobal: false },
  { network: v4(240, 0, 0, 0), prefix: 4, cidr: '240.0.0.0/4', label: 'Reserved (future use)', scope: 'reserved', rfc: 'RFC 1112', description: 'Former class E - reserved for future use, not routable.', isGlobal: false },
  { network: v4(255, 255, 255, 255), prefix: 32, cidr: '255.255.255.255/32', label: 'Limited broadcast', scope: 'broadcast', rfc: 'RFC 919', description: 'Limited broadcast - destination only, never forwarded.', isGlobal: false },
];

/* ---- IPv6 special-purpose registry (longest-prefix match) ---------------- */

interface V6Entry {
  base: Ipv6Hextets;
  prefix: number;
  cidr: string;
  label: string;
  scope: IpScope;
  rfc: string;
  description: string;
  isGlobal: boolean;
}

function h6(...groups: number[]): Ipv6Hextets {
  const out = new Array<number>(8).fill(0);
  for (let i = 0; i < groups.length && i < 8; i++) out[i] = groups[i]!;
  return out as Ipv6Hextets;
}

const V6_REGISTRY: V6Entry[] = [
  { base: h6(0, 0, 0, 0, 0, 0, 0, 0), prefix: 128, cidr: '::/128', label: 'Unspecified', scope: 'reserved', rfc: 'RFC 4291', description: 'Unspecified address - only valid as a source before an address is assigned.', isGlobal: false },
  { base: h6(0, 0, 0, 0, 0, 0, 0, 1), prefix: 128, cidr: '::1/128', label: 'Loopback', scope: 'loopback', rfc: 'RFC 4291', description: 'Loopback - traffic never leaves the host.', isGlobal: false },
  { base: h6(0, 0, 0, 0, 0, 0xffff, 0, 0), prefix: 96, cidr: '::ffff:0:0/96', label: 'IPv4-mapped', scope: 'protocol', rfc: 'RFC 4291', description: 'IPv4-mapped IPv6 address - represents an IPv4 node to IPv6 software.', isGlobal: false },
  { base: h6(0x64, 0xff9b, 0, 0, 0, 0, 0, 0), prefix: 96, cidr: '64:ff9b::/96', label: 'NAT64 well-known prefix', scope: 'protocol', rfc: 'RFC 6052', description: 'IPv4/IPv6 translation (NAT64) well-known prefix.', isGlobal: true },
  { base: h6(0x64, 0xff9b, 1, 0, 0, 0, 0, 0), prefix: 48, cidr: '64:ff9b:1::/48', label: 'IPv4-IPv6 translation (local)', scope: 'private', rfc: 'RFC 8215', description: 'Local-use IPv4/IPv6 translation prefix.', isGlobal: false },
  { base: h6(0x100, 0, 0, 0, 0, 0, 0, 0), prefix: 64, cidr: '100::/64', label: 'Discard-only', scope: 'reserved', rfc: 'RFC 6666', description: 'Discard-only block - packets to these addresses are dropped.', isGlobal: false },
  { base: h6(0x2001, 0, 0, 0, 0, 0, 0, 0), prefix: 32, cidr: '2001::/32', label: 'Teredo', scope: 'protocol', rfc: 'RFC 4380', description: 'Teredo IPv6 tunneling over IPv4 NATs.', isGlobal: true },
  { base: h6(0x2001, 0x2, 0, 0, 0, 0, 0, 0), prefix: 48, cidr: '2001:2::/48', label: 'Benchmarking', scope: 'reserved', rfc: 'RFC 5180', description: 'Reserved for IPv6 benchmarking tests.', isGlobal: false },
  { base: h6(0x2001, 0xdb8, 0, 0, 0, 0, 0, 0), prefix: 32, cidr: '2001:db8::/32', label: 'Documentation', scope: 'documentation', rfc: 'RFC 3849', description: 'Reserved for documentation and examples - not routable.', isGlobal: false },
  { base: h6(0x2001, 0x10, 0, 0, 0, 0, 0, 0), prefix: 28, cidr: '2001:10::/28', label: 'ORCHID (deprecated)', scope: 'reserved', rfc: 'RFC 4843', description: 'Legacy ORCHID overlay identifiers - deprecated.', isGlobal: false },
  { base: h6(0x2001, 0x20, 0, 0, 0, 0, 0, 0), prefix: 28, cidr: '2001:20::/28', label: 'ORCHIDv2', scope: 'protocol', rfc: 'RFC 7343', description: 'ORCHIDv2 cryptographic overlay identifiers.', isGlobal: true },
  { base: h6(0x2001, 0, 0, 0, 0, 0, 0, 0), prefix: 23, cidr: '2001::/23', label: 'IETF protocol assignments', scope: 'protocol', rfc: 'RFC 2928', description: 'Reserved for IETF protocol assignments (Teredo, benchmarking, documentation, ORCHID).', isGlobal: true },
  { base: h6(0x2002, 0, 0, 0, 0, 0, 0, 0), prefix: 16, cidr: '2002::/16', label: '6to4', scope: 'protocol', rfc: 'RFC 3056', description: '6to4 IPv6 transition mechanism (deprecated in practice).', isGlobal: true },
  { base: h6(0x3fff, 0, 0, 0, 0, 0, 0, 0), prefix: 20, cidr: '3fff::/20', label: 'Documentation', scope: 'documentation', rfc: 'RFC 9637', description: 'Additional documentation range - not routable.', isGlobal: false },
  { base: h6(0x5f00, 0, 0, 0, 0, 0, 0, 0), prefix: 16, cidr: '5f00::/16', label: 'SRv6 SIDs', scope: 'protocol', rfc: 'RFC 9602', description: 'Segment Routing over IPv6 segment identifiers.', isGlobal: false },
  { base: h6(0xfc00, 0, 0, 0, 0, 0, 0, 0), prefix: 7, cidr: 'fc00::/7', label: 'Unique-local (ULA)', scope: 'private', rfc: 'RFC 4193', description: 'Unique local addresses - private, not routable on the public internet.', isGlobal: false },
  { base: h6(0xfe80, 0, 0, 0, 0, 0, 0, 0), prefix: 10, cidr: 'fe80::/10', label: 'Link-local', scope: 'link-local', rfc: 'RFC 4291', description: 'Link-local unicast - valid only on the local link.', isGlobal: false },
  { base: h6(0xff00, 0, 0, 0, 0, 0, 0, 0), prefix: 8, cidr: 'ff00::/8', label: 'Multicast', scope: 'multicast', rfc: 'RFC 4291', description: 'IPv6 multicast address block.', isGlobal: false },
];

/* ---- Parsers -------------------------------------------------------------- */

/** Parse a dotted IPv4 string into a 32-bit unsigned integer. */
export function parseIpv4(input: string): { ok: boolean; value: Ipv4Int; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, value: 0, error: 'Address is empty.' };
  const parts = trimmed.split('.');
  if (parts.length !== 4) return { ok: false, value: 0, error: 'IPv4 address must have exactly 4 octets.' };
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const part = parts[i]!;
    if (!/^(?:0|[1-9][0-9]?|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(part)) {
      return { ok: false, value: 0, error: `Octet ${i + 1} ("${part}") is not valid (0-255).` };
    }
    value = ((value << 8) | Number.parseInt(part, 10)) >>> 0;
  }
  return { ok: true, value, error: null };
}

/** Convert a 32-bit unsigned integer to a dotted IPv4 string. */
export function intToIpv4(n: Ipv4Int): string {
  const v = n >>> 0;
  return `${(v >>> 24) & 0xff}.${(v >>> 16) & 0xff}.${(v >>> 8) & 0xff}.${v & 0xff}`;
}

function parseIpv4Tail(input: string): [number, number] | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number.parseInt(p, 10);
    if (v > 255) return null;
    octets.push(v);
  }
  return [(octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!];
}

/** Parse an IPv6 address string into 8 hextets (same rules as Ipv6Compressor). */
export function parseIpv6(input: string): { ok: boolean; hextets: Ipv6Hextets | null; error: string | null } {
  let raw = input.trim();
  if (raw.length === 0) return { ok: false, hextets: null, error: 'Address is empty.' };
  const pctIdx = raw.indexOf('%');
  if (pctIdx >= 0) raw = raw.slice(0, pctIdx);
  const slashIdx = raw.indexOf('/');
  if (slashIdx >= 0) raw = raw.slice(0, slashIdx);
  if (raw.length === 0) return { ok: false, hextets: null, error: 'Address is empty.' };

  const firstDouble = raw.indexOf('::');
  const hasDouble = firstDouble >= 0;
  if (hasDouble && raw.indexOf('::', firstDouble + 2) >= 0) {
    return { ok: false, hextets: null, error: 'IPv6 address may contain at most one "::".' };
  }

  let headPart = raw;
  let tailPart = '';
  if (hasDouble) {
    headPart = raw.slice(0, firstDouble);
    tailPart = raw.slice(firstDouble + 2);
  }

  const parseGroups = (part: string): number[] | null => {
    if (part.length === 0) return [];
    const groups = part.split(':');
    const out: number[] = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!;
      if (g.includes('.')) {
        if (i !== groups.length - 1) return null;
        const pair = parseIpv4Tail(g);
        if (!pair) return null;
        out.push(pair[0], pair[1]);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
        out.push(Number.parseInt(g, 16));
      }
    }
    return out;
  };

  const head = parseGroups(headPart);
  const tail = parseGroups(tailPart);
  if (head === null || tail === null) {
    return { ok: false, hextets: null, error: 'Invalid hextet or IPv4 tail.' };
  }

  let hextets: number[];
  if (hasDouble) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) {
      return { ok: false, hextets: null, error: '"::" must elide at least one hextet.' };
    }
    hextets = [...head, ...new Array<number>(missing).fill(0), ...tail];
  } else {
    if (head.length !== 8) {
      return { ok: false, hextets: null, error: `IPv6 address without "::" must have 8 hextets (got ${head.length}).` };
    }
    hextets = head;
  }
  return { ok: true, hextets: hextets as Ipv6Hextets, error: null };
}

/** RFC 5952 compressed form for display. */
export function compressIpv6(h: Ipv6Hextets): string {
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (h[i] === 0) {
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
  const groups = h.map((g) => g.toString(16));
  if (bestLen < 2) return groups.join(':');
  return `${groups.slice(0, bestStart).join(':')}::${groups.slice(bestStart + bestLen).join(':')}`;
}

/* ---- Classification ------------------------------------------------------- */

function v4Matches(ip: Ipv4Int, e: V4Entry): boolean {
  if (e.prefix === 0) return true;
  const shift = 32 - e.prefix;
  return (ip >>> shift) === (e.network >>> shift);
}

function v6Matches(h: Ipv6Hextets, e: V6Entry): boolean {
  let remaining = e.prefix;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    if (remaining >= 16) {
      if (h[i] !== e.base[i]) return false;
      remaining -= 16;
    } else {
      const shift = 16 - remaining;
      return (h[i]! >> shift) === (e.base[i]! >> shift);
    }
  }
  return true;
}

/** Classify an IPv4 address (longest-prefix match against the registry). */
export function classifyIpv4(ip: Ipv4Int): IpClassification {
  let best: V4Entry | null = null;
  for (const e of V4_REGISTRY) {
    if (v4Matches(ip, e) && (best === null || e.prefix > best.prefix)) {
      best = e;
    }
  }
  if (!best) {
    return {
      version: 4,
      address: intToIpv4(ip),
      label: 'Public',
      scope: 'public',
      range: '0.0.0.0/0',
      rfc: '—',
      description: 'Globally routable public unicast address.',
      isGlobal: true,
      isPrivate: false,
    };
  }
  return {
    version: 4,
    address: intToIpv4(ip),
    label: best.label,
    scope: best.scope,
    range: best.cidr,
    rfc: best.rfc,
    description: best.description,
    isGlobal: best.isGlobal,
    isPrivate: !best.isGlobal,
  };
}

/** Classify an IPv6 address (longest-prefix match against the registry). */
export function classifyIpv6(h: Ipv6Hextets): IpClassification {
  let best: V6Entry | null = null;
  for (const e of V6_REGISTRY) {
    if (v6Matches(h, e) && (best === null || e.prefix > best.prefix)) {
      best = e;
    }
  }
  const address = compressIpv6(h);
  if (!best) {
    return {
      version: 6,
      address,
      label: 'Global unicast',
      scope: 'public',
      range: '2000::/3',
      rfc: 'RFC 4291',
      description: 'Globally routable IPv6 unicast address.',
      isGlobal: true,
      isPrivate: false,
    };
  }
  return {
    version: 6,
    address,
    label: best.label,
    scope: best.scope,
    range: best.cidr,
    rfc: best.rfc,
    description: best.description,
    isGlobal: best.isGlobal,
    isPrivate: !best.isGlobal,
  };
}

/**
 * Classify an input string as IPv4 or IPv6 and return its classification.
 * IPv4-mapped IPv6 input (`::ffff:1.2.3.4`) is classified as IPv6.
 */
export function classifyIp(
  input: string,
): { ok: boolean; result: IpClassification | null; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, result: null, error: null };
  }
  if (trimmed.includes(':')) {
    const v6 = parseIpv6(trimmed);
    if (!v6.ok || !v6.hextets) {
      return { ok: false, result: null, error: v6.error };
    }
    return { ok: true, result: classifyIpv6(v6.hextets), error: null };
  }
  const v4 = parseIpv4(trimmed);
  if (!v4.ok) {
    return { ok: false, result: null, error: v4.error };
  }
  return { ok: true, result: classifyIpv4(v4.value), error: null };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseIpClassifierReturn {
  input: Ref<string>;
  result: Ref<IpClassification | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useIpClassifier(): UseIpClassifierReturn {
  const input = ref<string>('');
  const result = ref<IpClassification | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const r = classifyIp(input.value);
    result.value = r.result;
    error.value = r.error;
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.ip === 'string') input.value = p.ip;
      else if (typeof p.address === 'string') input.value = p.address;
      else if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({ ...r });
      } else {
        sendOutput({ error: error.value });
      }
    }
  });

  return { input, result, error, isEmbed, embedInput, recompute };
}
