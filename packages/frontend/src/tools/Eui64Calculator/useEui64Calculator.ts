/**
 * useEui64Calculator - composable + pure logic for the EUI-64 calculator
 * tool.
 *
 * Converts a MAC-48 address into a modified EUI-64 interface identifier per
 * RFC 4291 §A / RFC 7042:
 *   1. Split the MAC into two 24-bit halves.
 *   2. Insert `0xFFFE` between them → 64-bit EUI-64.
 *   3. Invert the U/L bit (bit 1 of the first octet) → *modified* EUI-64.
 *
 * The IID is then combined with a /64 prefix (default `fe80::` for the
 * link-local address, or a user-supplied prefix) to form a full IPv6
 * address.
 *
 * Pure helpers (`parseMac`, `macToEui64`, `formatEui64`, `iidToHextets`,
 * `parsePrefix64`, `compressIpv6`, `buildLinkLocal`) have no Vue dependency
 * and can be imported standalone for unit testing or reuse. The
 * `useEui64Calculator()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies - byte-array math only.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export type MacOctets = [number, number, number, number, number, number];
export type Eui64Bytes = [
  number, number, number, number, number, number, number, number,
];
export type Ipv6Hextets = [
  number, number, number, number, number, number, number, number,
];

export interface Eui64Result {
  /** Original MAC input (trimmed). */
  raw: string;
  /** Normalised MAC `AA:BB:CC:DD:EE:FF`. */
  mac: string;
  /** Modified EUI-64 identifier `aabb:ccff:fedd:eeff` (hextet form). */
  eui64: string;
  /** Modified EUI-64 in colon-byte form `AA:BB:CC:FF:FE:DD:EE:FF`. */
  eui64Colon: string;
  /** The 8 EUI-64 bytes (U/L bit already flipped). */
  bytes: Eui64Bytes;
  /** Whether the U/L bit was set in the *original* MAC. */
  originalUL: boolean;
  /** Whether the U/L bit is set in the *modified* identifier. */
  modifiedUL: boolean;
  /** Link-local address `fe80::iid` (compressed). */
  linkLocal: string;
  /** Full address under the custom prefix (compressed), or null. */
  prefixed: string | null;
  /** The prefix actually used for `prefixed` (normalised `xxxx::/64`). */
  prefixUsed: string | null;
}

/** Parse a MAC-48 address from any common notation. */
export function parseMac(
  input: string,
): { ok: boolean; octets: MacOctets | null; error: string | null } {
  const raw = input.trim();
  if (raw.length === 0) {
    return { ok: false, octets: null, error: 'MAC address is empty.' };
  }
  const hex = raw.replace(/[\s:.-]/g, '');
  if (!/^[0-9A-Fa-f]+$/.test(hex)) {
    return { ok: false, octets: null, error: 'MAC address contains invalid hex characters.' };
  }
  if (hex.length !== 12) {
    return {
      ok: false,
      octets: null,
      error: `MAC address must be 12 hex digits (6 octets) - got ${hex.length}.`,
    };
  }
  if (/[.:-]/.test(raw)) {
    if (raw.includes('.')) {
      const groups = raw.split('.');
      if (groups.length !== 3 || groups.some((g) => !/^[0-9A-Fa-f]{4}$/.test(g))) {
        return { ok: false, octets: null, error: 'Dot-separated MAC must be Cisco format (AABB.CCDD.EEFF).' };
      }
    } else {
      const sep = raw.includes(':') ? ':' : '-';
      const groups = raw.split(sep);
      if (groups.length !== 6 || groups.some((g) => !/^[0-9A-Fa-f]{2}$/.test(g))) {
        return { ok: false, octets: null, error: 'Separated MAC must have 6 groups of 2 hex digits.' };
      }
    }
  }
  const octets: MacOctets = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    parseInt(hex.slice(6, 8), 16),
    parseInt(hex.slice(8, 10), 16),
    parseInt(hex.slice(10, 12), 16),
  ];
  return { ok: true, octets, error: null };
}

/**
 * Convert MAC-48 octets to a *modified* EUI-64 identifier: insert `FF FE`
 * between the OUI and device halves, then invert the U/L bit (0x02) of the
 * first octet.
 */
export function macToEui64(octets: MacOctets): Eui64Bytes {
  return [
    octets[0] ^ 0x02,
    octets[1],
    octets[2],
    0xff,
    0xfe,
    octets[3],
    octets[4],
    octets[5],
  ];
}

/** Format EUI-64 bytes as hextets `aabb:ccff:fedd:eeff` (lowercase). */
export function formatEui64(bytes: Eui64Bytes): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `${h(bytes[0])}${h(bytes[1])}:${h(bytes[2])}${h(bytes[3])}:${h(bytes[4])}${h(bytes[5])}:${h(bytes[6])}${h(bytes[7])}`;
}

/** Format EUI-64 bytes as colon-separated octets `AA:BB:CC:FF:FE:DD:EE:FF`. */
export function formatEui64Colon(bytes: Eui64Bytes): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/** Split EUI-64 bytes into the 4 low hextets of an IPv6 address. */
export function iidToHextets(bytes: Eui64Bytes): [number, number, number, number] {
  return [
    (bytes[0] << 8) | bytes[1],
    (bytes[2] << 8) | bytes[3],
    (bytes[4] << 8) | bytes[5],
    (bytes[6] << 8) | bytes[7],
  ];
}

/** RFC 5952 compressed form of 8 hextets. */
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

/**
 * Parse a /64 prefix input into 4 hextets.
 *
 * Accepted: `2001:db8::`, `2001:db8:1:2::/64`, `fd12:3456:7890:abcd`,
 * `fe80::/64`. The prefix is truncated to its first 64 bits.
 */
export function parsePrefix64(
  input: string,
): { ok: boolean; hextets: [number, number, number, number] | null; error: string | null } {
  let raw = input.trim();
  if (raw.length === 0) {
    return { ok: false, hextets: null, error: 'Prefix is empty.' };
  }
  const slashIdx = raw.indexOf('/');
  if (slashIdx >= 0) {
    const p = raw.slice(slashIdx + 1).trim();
    if (!/^\d{1,3}$/.test(p) || Number.parseInt(p, 10) > 64) {
      return { ok: false, hextets: null, error: 'Prefix length must be ≤ 64.' };
    }
    raw = raw.slice(0, slashIdx);
  }

  const firstDouble = raw.indexOf('::');
  const hasDouble = firstDouble >= 0;
  if (hasDouble && raw.indexOf('::', firstDouble + 2) >= 0) {
    return { ok: false, hextets: null, error: 'IPv6 prefix may contain at most one "::".' };
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
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(Number.parseInt(g, 16));
    }
    return out;
  };
  const head = parseGroups(headPart);
  const tail = parseGroups(tailPart);
  if (head === null || tail === null) {
    return { ok: false, hextets: null, error: 'Invalid hextet in prefix.' };
  }
  let full: number[];
  if (hasDouble) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) {
      return { ok: false, hextets: null, error: 'Too many hextets in prefix.' };
    }
    full = [...head, ...new Array<number>(missing).fill(0), ...tail];
  } else {
    if (head.length > 8) {
      return { ok: false, hextets: null, error: 'Too many hextets in prefix.' };
    }
    full = [...head, ...new Array<number>(8 - head.length).fill(0)];
  }
  return {
    ok: true,
    hextets: [full[0]!, full[1]!, full[2]!, full[3]!],
    error: null,
  };
}

/** Build the full EUI-64 result for a MAC + optional /64 prefix. */
export function buildEui64(
  octets: MacOctets,
  raw: string,
  prefixInput: string,
): { ok: boolean; result: Eui64Result | null; error: string | null } {
  const bytes = macToEui64(octets);
  const iid = iidToHextets(bytes);

  const linkLocal = compressIpv6([0xfe80, 0, 0, 0, ...iid]);

  let prefixed: string | null = null;
  let prefixUsed: string | null = null;
  const pText = prefixInput.trim();
  if (pText.length > 0) {
    const p = parsePrefix64(pText);
    if (!p.ok || !p.hextets) {
      return { ok: false, result: null, error: p.error };
    }
    prefixed = compressIpv6([...p.hextets, ...iid]);
    prefixUsed = `${compressIpv6([...p.hextets, 0, 0, 0, 0])}/64`;
  }

  const mac = octets.map((o) => o.toString(16).padStart(2, '0').toUpperCase()).join(':');
  return {
    ok: true,
    error: null,
    result: {
      raw,
      mac,
      eui64: formatEui64(bytes),
      eui64Colon: formatEui64Colon(bytes),
      bytes,
      originalUL: (octets[0] & 0x02) === 0x02,
      modifiedUL: (bytes[0] & 0x02) === 0x02,
      linkLocal,
      prefixed,
      prefixUsed,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseEui64CalculatorReturn {
  macInput: Ref<string>;
  prefixInput: Ref<string>;
  result: Ref<Eui64Result | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useEui64Calculator(): UseEui64CalculatorReturn {
  const macInput = ref<string>('');
  const prefixInput = ref<string>('');
  const result = ref<Eui64Result | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const text = macInput.value.trim();
    if (text.length === 0) {
      result.value = null;
      error.value = null;
      return;
    }
    const parsed = parseMac(text);
    if (!parsed.ok || !parsed.octets) {
      result.value = null;
      error.value = parsed.error;
      return;
    }
    const built = buildEui64(parsed.octets, text, prefixInput.value);
    result.value = built.result;
    error.value = built.error;
  }

  watch([macInput, prefixInput], recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mac === 'string') macInput.value = p.mac;
      else if (typeof p.address === 'string') macInput.value = p.address;
      else if (typeof p.input === 'string') macInput.value = p.input;
      else if (typeof p.value === 'string') macInput.value = p.value;
      if (typeof p.prefix === 'string') prefixInput.value = p.prefix;
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          mac: r.mac,
          eui64: r.eui64,
          eui64Colon: r.eui64Colon,
          linkLocal: r.linkLocal,
          prefixed: r.prefixed,
          prefix: r.prefixUsed,
          originalUL: r.originalUL,
          modifiedUL: r.modifiedUL,
        });
      } else {
        sendOutput({ error: error.value });
      }
    }
  });

  return { macInput, prefixInput, result, error, isEmbed, embedInput, recompute };
}
