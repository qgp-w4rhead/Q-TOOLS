/**
 * useIpv6Compressor - composable + pure logic for the IPv6 compressor /
 * expander tool.
 *
 * Parses any textual IPv6 form - full 8-hextet, `::`-compressed, and
 * IPv4-embedded (`::ffff:1.2.3.4`, `::1.2.3.4`) - into 8 hextets, then emits:
 *   - expanded form   `2001:0db8:0000:0000:0000:ff00:0042:8329`
 *   - compressed form `2001:db8::ff00:42:8329` (RFC 5952: longest zero run
 *     ≥ 2 → `::`, first run wins on ties, lowercase hextets)
 *   - IPv4-mapped     `::ffff:1.2.3.4` when the address is in `::ffff:0:0/96`
 *   - IPv4-compatible `::1.2.3.4` when the first 96 bits are zero (excluding
 *     the unspecified `::` and loopback `::1` addresses)
 *
 * Pure helpers (`parseIpv6`, `expandIpv6`, `compressIpv6`, `toIpv4Mapped`,
 * `toIpv4Compatible`, `convertIpv6`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useIpv6Compressor()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies - byte-array math only.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** An IPv6 address as 8 hextets (each 0-0xffff). */
export type Ipv6Hextets = [
  number, number, number, number, number, number, number, number,
];

export interface Ipv6ParseResult {
  ok: boolean;
  hextets: Ipv6Hextets | null;
  error: string | null;
}

export interface Ipv6ConvertResult {
  /** Canonical compressed form (RFC 5952). */
  compressed: string;
  /** Fully expanded form (8 zero-padded hextets). */
  expanded: string;
  /** Un-padded, uncompressed form (`2001:db8:0:0:...`). */
  uncompressed: string;
  /** IPv4-mapped form `::ffff:a.b.c.d`, or null when not applicable. */
  ipv4Mapped: string | null;
  /** IPv4-compatible form `::a.b.c.d`, or null when not applicable. */
  ipv4Compatible: string | null;
  /** The embedded IPv4 dotted quad, or null when none. */
  embeddedIpv4: string | null;
  /** Whether the address is IPv4-mapped (`::ffff:0:0/96`). */
  isIpv4Mapped: boolean;
  /** Whether the address is the unspecified address `::`. */
  isUnspecified: boolean;
  /** Whether the address is the loopback `::1`. */
  isLoopback: boolean;
}

/** Parse a dotted IPv4 quad into two hextets (high, low). */
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
  return [
    (octets[0]! << 8) | octets[1]!,
    (octets[2]! << 8) | octets[3]!,
  ];
}

/**
 * Parse an IPv6 address string into 8 hextets.
 *
 * Accepts full (`1:2:3:4:5:6:7:8`), compressed (`::`, `2001:db8::1`), and
 * IPv4-embedded (`::ffff:1.2.3.4`) forms. A zone id (`%eth0`) is tolerated
 * and stripped. Returns an error for malformed input.
 */
export function parseIpv6(input: string): Ipv6ParseResult {
  let raw = input.trim();
  if (raw.length === 0) {
    return { ok: false, hextets: null, error: 'IPv6 address is empty.' };
  }
  // Strip zone id (`fe80::1%eth0`) and CIDR suffix.
  const pctIdx = raw.indexOf('%');
  if (pctIdx >= 0) raw = raw.slice(0, pctIdx);
  const slashIdx = raw.indexOf('/');
  if (slashIdx >= 0) raw = raw.slice(0, slashIdx);
  if (raw.length === 0) {
    return { ok: false, hextets: null, error: 'IPv6 address is empty.' };
  }

  // At most one `::` is allowed.
  const firstDouble = raw.indexOf('::');
  const hasDouble = firstDouble >= 0;
  if (hasDouble && raw.indexOf('::', firstDouble + 2) >= 0) {
    return { ok: false, hextets: null, error: 'IPv6 address may contain at most one "::".' };
  }

  // Split into head/tail around `::`.
  let headPart = raw;
  let tailPart = '';
  if (hasDouble) {
    headPart = raw.slice(0, firstDouble);
    tailPart = raw.slice(firstDouble + 2);
  }

  // An IPv4 dotted quad may only appear as the last group.
  const parseGroups = (part: string): number[] | null => {
    if (part.length === 0) return [];
    const groups = part.split(':');
    const out: number[] = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!;
      if (g.includes('.')) {
        // IPv4 tail must be the final group.
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
    return {
      ok: false,
      hextets: null,
      error: 'Invalid hextet or IPv4 tail - expected 1-4 hex digits per group.',
    };
  }

  let hextets: number[];
  if (hasDouble) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) {
      return {
        ok: false,
        hextets: null,
        error: '"::" must elide at least one hextet - too many groups.',
      };
    }
    hextets = [...head, ...new Array<number>(missing).fill(0), ...tail];
  } else {
    if (head.length !== 8) {
      return {
        ok: false,
        hextets: null,
        error: `IPv6 address without "::" must have exactly 8 hextets (got ${head.length}).`,
      };
    }
    hextets = head;
  }

  return { ok: true, hextets: hextets as Ipv6Hextets, error: null };
}

/** Expanded form: 8 zero-padded lowercase hextets. */
export function expandIpv6(h: Ipv6Hextets): string {
  return h.map((g) => g.toString(16).padStart(4, '0')).join(':');
}

/** Un-padded, uncompressed form (`2001:db8:0:0:0:ff00:42:8329`). */
export function uncompressedIpv6(h: Ipv6Hextets): string {
  return h.map((g) => g.toString(16)).join(':');
}

/**
 * Compressed form per RFC 5952: lowercase hextets, the longest run of
 * consecutive zero hextets (length ≥ 2) replaced by `::`; ties resolve to
 * the first run.
 */
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
  const before = groups.slice(0, bestStart).join(':');
  const after = groups.slice(bestStart + bestLen).join(':');
  return `${before}::${after}`;
}

/** Whether the address is IPv4-mapped (`::ffff:0:0/96`). */
export function isIpv4Mapped(h: Ipv6Hextets): boolean {
  return (
    h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 &&
    h[5] === 0xffff
  );
}

/** Dotted-quad string for the low 32 bits. */
export function embeddedIpv4(h: Ipv6Hextets): string {
  return `${(h[6]! >> 8) & 0xff}.${h[6]! & 0xff}.${(h[7]! >> 8) & 0xff}.${h[7]! & 0xff}`;
}

/** IPv4-mapped text form `::ffff:a.b.c.d`, or null when not applicable. */
export function toIpv4Mapped(h: Ipv6Hextets): string | null {
  return isIpv4Mapped(h) ? `::ffff:${embeddedIpv4(h)}` : null;
}

/**
 * IPv4-compatible text form `::a.b.c.d`, or null when not applicable.
 * Applies when the first 96 bits are zero, excluding `::` (unspecified) and
 * `::1` (loopback) which have their own canonical names.
 */
export function toIpv4Compatible(h: Ipv6Hextets): string | null {
  const first96Zero =
    h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 &&
    h[5] === 0;
  if (!first96Zero) return null;
  if (h[6] === 0 && (h[7] === 0 || h[7] === 1)) return null;
  return `::${embeddedIpv4(h)}`;
}

/** Full conversion result for a parsed address. */
export function convertIpv6(h: Ipv6Hextets): Ipv6ConvertResult {
  const mapped = isIpv4Mapped(h);
  const unspecified = h.every((g) => g === 0);
  const loopback = h[7] === 1 && h.slice(0, 7).every((g) => g === 0);
  return {
    compressed: compressIpv6(h),
    expanded: expandIpv6(h),
    uncompressed: uncompressedIpv6(h),
    ipv4Mapped: toIpv4Mapped(h),
    ipv4Compatible: toIpv4Compatible(h),
    embeddedIpv4: mapped || toIpv4Compatible(h) !== null ? embeddedIpv4(h) : null,
    isIpv4Mapped: mapped,
    isUnspecified: unspecified,
    isLoopback: loopback,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseIpv6CompressorReturn {
  input: Ref<string>;
  result: Ref<Ipv6ConvertResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useIpv6Compressor(): UseIpv6CompressorReturn {
  const input = ref<string>('');
  const result = ref<Ipv6ConvertResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const text = input.value.trim();
    if (text.length === 0) {
      result.value = null;
      error.value = null;
      return;
    }
    const parsed = parseIpv6(text);
    if (!parsed.ok || !parsed.hextets) {
      result.value = null;
      error.value = parsed.error;
      return;
    }
    error.value = null;
    result.value = convertIpv6(parsed.hextets);
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.address === 'string') input.value = p.address;
      else if (typeof p.ipv6 === 'string') input.value = p.ipv6;
      else if (typeof p.ip === 'string') input.value = p.ip;
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
