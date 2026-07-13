/**
 * useIpv4RangeExpander — composable + pure logic for the IPv4 range expander
 * tool.
 *
 * Takes a start IP + end IP (or a single range expression such as
 * `192.168.1.0 - 192.168.1.255` or a CIDR block `192.168.1.0/24`) and expands
 * it into the minimal list of CIDR blocks that exactly cover the inclusive
 * range, plus the total number of addresses.
 *
 * The core algorithm is the standard greedy "range to CIDR" walker:
 *   1. Start at `current = start`.
 *   2. Find the largest CIDR block (smallest prefix length) whose network
 *      address equals `current`, whose size does not overshoot `end`, and
 *      whose last address does not overshoot `end`.
 *   3. Emit that block, advance `current` past it, repeat until `current > end`.
 *
 * All arithmetic uses 32-bit unsigned integers via `>>> 0` normalisation — no
 * BigInt needed (32 bits fits comfortably in JavaScript's safe-integer range).
 *
 * Pure helpers (`parseIpv4`, `ipv4ToInt`, `intToIpv4`, `parseRangeExpression`,
 * `cidrToRange`, `maxBlockSize`, `rangeToCidrs`, `expandRange`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `useIpv4RangeExpander()` composable wraps them in reactive state and wires
 * up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
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

/** A single CIDR block produced by `rangeToCidrs`. */
export interface CidrBlock {
  /** Network address as a 32-bit unsigned integer. */
  networkInt: Ipv4Int;
  /** CIDR prefix length (0-32). */
  prefix: number;
  /** CIDR notation `network/prefix`. */
  cidr: string;
  /** Network address as a dotted string. */
  network: string;
  /** First address in the block (== network). */
  first: string;
  /** Last address in the block (== broadcast). */
  last: string;
  /** Number of addresses in this block (2^(32-prefix)). */
  count: number;
}

/** Full result of expanding a range. */
export interface RangeExpansionResult {
  /** Start of the range as a 32-bit unsigned integer. */
  startInt: Ipv4Int;
  /** End of the range as a 32-bit unsigned integer. */
  endInt: Ipv4Int;
  /** Start of the range as a dotted string. */
  start: string;
  /** End of the range as a dotted string. */
  end: string;
  /** Total number of addresses in the range (end - start + 1). */
  totalIps: number;
  /** CIDR blocks covering the range. */
  cidrs: CidrBlock[];
  /** Number of CIDR blocks. */
  cidrCount: number;
  /** Whether the range was expressed as a single CIDR block. */
  isSingleCidr: boolean;
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

/**
 * Parse a CIDR prefix length (`0`-`32`).
 *
 * Accepts a bare number (`24`) or a full CIDR string (`192.168.1.0/24` — the IP
 * portion is ignored here; use `parseIpv4` separately).
 */
export function parseCidr(input: string): CidrParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, prefix: 0, error: 'CIDR prefix is empty.' };
  }
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
 * Convert a CIDR block (ip + prefix) into its inclusive address range.
 */
export function cidrToRange(ip: Ipv4Int, prefix: number): {
  start: Ipv4Int;
  end: Ipv4Int;
  count: number;
} {
  const p = Math.max(0, Math.min(32, prefix));
  const mask = p === 0 ? 0 : ((0xffffffff << (32 - p)) >>> 0);
  const wildcard = (~mask) >>> 0;
  const network = (ip & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const count = Math.pow(2, 32 - p);
  return { start: network, end: broadcast, count };
}

/**
 * Compute the maximum block size (as a power-of-two exponent) that can start
 * at `current` without exceeding `end`.
 *
 * The size is constrained by two factors:
 *   1. Alignment: the block must start at `current`, so the maximum size is
 *      the largest power of two that divides `current` (i.e. the number of
 *      trailing zero bits in `current`). For `current === 0`, the alignment
 *      is 32 (the whole IPv4 space).
 *   2. Remaining range: the block's last address `current + size - 1` must
 *      not exceed `end`, so `size <= end - current + 1`.
 *
 * Returns the exponent `k` such that the block size is `2^k` and the
 * corresponding CIDR prefix is `32 - k`.
 */
export function maxBlockSize(current: Ipv4Int, end: Ipv4Int): number {
  // Alignment: count trailing zero bits of `current`. For current === 0 the
  // whole 32-bit space is aligned, so we cap at 32.
  let alignment: number;
  if (current === 0) {
    alignment = 32;
  } else {
    // Number of trailing zeros = log2 of the largest power of two dividing n.
    // Use Math.ctz where available; otherwise derive from clz of (n & -n).
    const isolated = (current & (-current)) >>> 0;
    alignment = 31 - Math.clz32(isolated);
  }
  // Remaining range: floor(log2(end - current + 1)). The difference
  // `end - current` always fits in 32 bits (since end >= current), but
  // `end - current + 1` can be 2^32 when current === 0 and end === 0xffffffff,
  // which overflows `>>> 0` to 0. Handle that edge case explicitly.
  const diff = (end - current) >>> 0;
  let rangeExp: number;
  if (diff === 0xffffffff) {
    rangeExp = 32;
  } else {
    rangeExp = 31 - Math.clz32(diff + 1);
  }
  return Math.min(alignment, rangeExp);
}

/**
 * Expand an inclusive IPv4 range `[start, end]` into the minimal list of CIDR
 * blocks that exactly cover it.
 *
 * Uses the standard greedy walker: at each step, emit the largest aligned
 * block that fits within the remaining range, then advance past it.
 */
export function rangeToCidrs(start: Ipv4Int, end: Ipv4Int): CidrBlock[] {
  const s = start >>> 0;
  const e = end >>> 0;
  if (s > e) return [];
  const blocks: CidrBlock[] = [];
  let current = s;
  while (current <= e) {
    const sizeExp = maxBlockSize(current, e);
    const prefix = 32 - sizeExp;
    const size = Math.pow(2, sizeExp) >>> 0;
    const last = (current + size - 1) >>> 0;
    blocks.push({
      networkInt: current,
      prefix,
      cidr: `${intToIpv4(current)}/${prefix}`,
      network: intToIpv4(current),
      first: intToIpv4(current),
      last: intToIpv4(last),
      count: size,
    });
    // Advance. Guard against wrap-around past 0xffffffff.
    if (last === 0xffffffff) break;
    current = (last + 1) >>> 0;
  }
  return blocks;
}

/**
 * Parse a single-field range expression into `{ start, end }`.
 *
 * Accepted forms:
 *   - `a.b.c.d - e.f.g.h` (with optional surrounding spaces)
 *   - `a.b.c.d-e.f.g.h`
 *   - `a.b.c.d/n` (CIDR → expand to its network..broadcast range)
 *   - `a.b.c.d` (single IP → start === end)
 */
export function parseRangeExpression(
  input: string,
): { ok: boolean; start: Ipv4Int; end: Ipv4Int; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, start: 0, end: 0, error: 'Range expression is empty.' };
  }

  // CIDR form: contains a `/`.
  const slashIdx = trimmed.lastIndexOf('/');
  if (slashIdx >= 0) {
    const ipPart = trimmed.slice(0, slashIdx).trim();
    const prefixPart = trimmed.slice(slashIdx + 1).trim();
    const ipRes = parseIpv4(ipPart);
    if (!ipRes.ok) return { ok: false, start: 0, end: 0, error: ipRes.error };
    const cidrRes = parseCidr(prefixPart);
    if (!cidrRes.ok) return { ok: false, start: 0, end: 0, error: cidrRes.error };
    const range = cidrToRange(ipRes.value, cidrRes.prefix);
    return { ok: true, start: range.start, end: range.end, error: null };
  }

  // Range form: split on `-` (but only the first dash that separates two IPs).
  // We look for ` - ` first (preferred), then a bare `-` between two dotted
  // quad groups. A leading dash is not treated as a separator.
  let dashIdx = -1;
  const spacedDash = trimmed.indexOf(' - ');
  if (spacedDash >= 0) {
    dashIdx = spacedDash;
  } else {
    // Find a `-` that is preceded by a digit (end of an IP) and followed by a
    // digit (start of the next IP). Scan from index 1 to avoid a leading dash.
    for (let i = 1; i < trimmed.length - 1; i++) {
      if (trimmed[i] === '-' && /\d/.test(trimmed[i - 1]!) && /\d/.test(trimmed[i + 1]!)) {
        dashIdx = i;
        break;
      }
    }
  }

  if (dashIdx >= 0) {
    const left = trimmed.slice(0, dashIdx).trim();
    const right = trimmed.slice(dashIdx + 1).trim();
    const leftRes = parseIpv4(left);
    if (!leftRes.ok) return { ok: false, start: 0, end: 0, error: `Start IP: ${leftRes.error}` };
    const rightRes = parseIpv4(right);
    if (!rightRes.ok) return { ok: false, start: 0, end: 0, error: `End IP: ${rightRes.error}` };
    if (leftRes.value > rightRes.value) {
      return {
        ok: false,
        start: 0,
        end: 0,
        error: 'Start IP must be less than or equal to end IP.',
      };
    }
    return { ok: true, start: leftRes.value, end: rightRes.value, error: null };
  }

  // Single IP form.
  const singleRes = parseIpv4(trimmed);
  if (!singleRes.ok) return { ok: false, start: 0, end: 0, error: singleRes.error };
  return { ok: true, start: singleRes.value, end: singleRes.value, error: null };
}

/**
 * Expand a range given separate start and end IP strings.
 *
 * Either field may itself contain a range/CIDR expression; if both are
 * provided, they are treated as the start and end respectively. If only the
 * start field is provided and it contains a range/CIDR expression, that
 * expression is parsed. If only the start field is provided and it is a bare
 * IP, the range is a single address.
 */
export function expandRange(
  startInput: string,
  endInput: string,
): { ok: boolean; result: RangeExpansionResult | null; error: string | null } {
  const s = startInput.trim();
  const e = endInput.trim();

  if (s.length === 0 && e.length === 0) {
    return { ok: false, result: null, error: null };
  }

  let startInt: Ipv4Int;
  let endInt: Ipv4Int;

  if (e.length === 0) {
    // Only start field provided: parse as a range expression (covers CIDR,
    // `a-b`, and single IP).
    const r = parseRangeExpression(s);
    if (!r.ok) return { ok: false, result: null, error: r.error };
    startInt = r.start;
    endInt = r.end;
  } else if (s.length === 0) {
    return { ok: false, result: null, error: 'Enter a start IP address.' };
  } else {
    // Both fields provided: parse each as a bare IP (a trailing `/n` on the
    // start field is tolerated and the prefix ignored — the end field
    // defines the range boundary).
    const sStart = s.includes('/') ? s.slice(0, s.indexOf('/')) : s;
    const sRes = parseIpv4(sStart);
    if (!sRes.ok) return { ok: false, result: null, error: `Start IP: ${sRes.error}` };
    const eRes = parseIpv4(e);
    if (!eRes.ok) return { ok: false, result: null, error: `End IP: ${eRes.error}` };
    if (sRes.value > eRes.value) {
      return {
        ok: false,
        result: null,
        error: 'Start IP must be less than or equal to end IP.',
      };
    }
    startInt = sRes.value;
    endInt = eRes.value;
  }

  const cidrs = rangeToCidrs(startInt, endInt);
  const totalIps = (endInt - startInt + 1) >>> 0;

  return {
    ok: true,
    error: null,
    result: {
      startInt,
      endInt,
      start: intToIpv4(startInt),
      end: intToIpv4(endInt),
      totalIps,
      cidrs,
      cidrCount: cidrs.length,
      isSingleCidr: cidrs.length === 1,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseIpv4RangeExpanderReturn {
  startInput: Ref<string>;
  endInput: Ref<string>;
  result: Ref<RangeExpansionResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useIpv4RangeExpander(): UseIpv4RangeExpanderReturn {
  const startInput = ref<string>('');
  const endInput = ref<string>('');
  const result = ref<RangeExpansionResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const res = expandRange(startInput.value, endInput.value);
    if (!res.ok) {
      result.value = null;
      error.value = res.error;
      return;
    }
    error.value = null;
    result.value = res.result;
  }

  watch([startInput, endInput], recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      // Accept a single `range`/`input`/`value` expression in the start field.
      if (typeof p.range === 'string') {
        startInput.value = p.range;
        endInput.value = '';
        return;
      }
      if (typeof p.input === 'string' && endInput.value === '' && startInput.value === '') {
        startInput.value = p.input;
        endInput.value = '';
        return;
      }
      if (typeof p.value === 'string' && endInput.value === '' && startInput.value === '') {
        startInput.value = p.value;
        endInput.value = '';
        return;
      }
      if (typeof p.start === 'string') {
        startInput.value = p.start;
      } else if (typeof p.from === 'string') {
        startInput.value = p.from;
      }
      if (typeof p.end === 'string') {
        endInput.value = p.end;
      } else if (typeof p.to === 'string') {
        endInput.value = p.to;
      }
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          start: r.start,
          end: r.end,
          totalIps: r.totalIps,
          cidrCount: r.cidrCount,
          isSingleCidr: r.isSingleCidr,
          cidrs: r.cidrs.map((c) => ({
            cidr: c.cidr,
            network: c.network,
            prefix: c.prefix,
            first: c.first,
            last: c.last,
            count: c.count,
          })),
        });
      } else {
        sendOutput({ error: error.value });
      }
    }
  });

  return { startInput, endInput, result, error, isEmbed, embedInput, recompute };
}
