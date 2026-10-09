/**
 * useCidrAggregator - composable + pure logic for the CIDR aggregator tool.
 *
 * Merges a list of CIDR blocks, IP ranges (`a.b.c.d - e.f.g.h`), and single
 * IPs into the minimal set of covering CIDR blocks - the inverse of the
 * IPv4 range expander.
 *
 * Algorithm:
 *   1. Parse each input line into an inclusive [start, end] interval.
 *   2. Sort intervals by start; merge overlapping *and adjacent* intervals
 *      (next.start <= cur.end + 1).
 *   3. Expand each merged interval into minimal CIDR blocks via the greedy
 *      range-to-CIDR walker.
 *
 * All arithmetic uses 32-bit unsigned integers via `>>> 0` normalisation.
 *
 * Pure helpers (`parseIpv4`, `intToIpv4`, `parseEntry`, `mergeIntervals`,
 * `rangeToCidrs`, `aggregate`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useCidrAggregator()` composable
 * wraps them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export type Ipv4Int = number;

/** An inclusive IPv4 interval. */
export interface IpInterval {
  start: Ipv4Int;
  end: Ipv4Int;
}

/** A single aggregated CIDR block. */
export interface CidrBlock {
  cidr: string;
  network: string;
  prefix: number;
  first: string;
  last: string;
  count: number;
}

/** A line that failed to parse. */
export interface ParseError {
  /** 1-based line number in the input. */
  line: number;
  /** The offending text (trimmed). */
  text: string;
  error: string;
}

export interface AggregateResult {
  /** Number of non-empty input entries parsed. */
  inputCount: number;
  /** Number of entries that parsed successfully. */
  validCount: number;
  /** Per-line parse errors. */
  errors: ParseError[];
  /** Merged intervals before CIDR expansion. */
  mergedRanges: { start: string; end: string; count: number }[];
  /** Minimal covering CIDR blocks. */
  cidrs: CidrBlock[];
  /** Total addresses covered. */
  totalAddresses: number;
}

/** Parse a dotted IPv4 string into a 32-bit unsigned integer. */
export function parseIpv4(input: string): { ok: boolean; value: Ipv4Int; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, value: 0, error: 'IP address is empty.' };
  }
  const parts = trimmed.split('.');
  if (parts.length !== 4) {
    return { ok: false, value: 0, error: 'IPv4 address must have exactly 4 octets.' };
  }
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

function prefixToMask(prefix: number): Ipv4Int {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff >>> 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Parse one input entry into an inclusive interval.
 *
 * Accepted forms:
 *   - `a.b.c.d/n`          CIDR block (host bits normalised to network)
 *   - `a.b.c.d - e.f.g.h`  explicit range
 *   - `a.b.c.d`            single address (/32)
 */
export function parseEntry(
  input: string,
): { ok: boolean; interval: IpInterval | null; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, interval: null, error: 'Empty entry.' };
  }

  // CIDR form.
  const slashIdx = trimmed.lastIndexOf('/');
  if (slashIdx >= 0) {
    const ipPart = trimmed.slice(0, slashIdx).trim();
    const rawPrefix = trimmed.slice(slashIdx + 1).trim();
    if (!/^(?:[0-9]|[12][0-9]|3[0-2])$/.test(rawPrefix)) {
      return { ok: false, interval: null, error: 'CIDR prefix must be an integer between 0 and 32.' };
    }
    const ip = parseIpv4(ipPart);
    if (!ip.ok) return { ok: false, interval: null, error: ip.error };
    const prefix = Number.parseInt(rawPrefix, 10);
    const mask = prefixToMask(prefix);
    const start = (ip.value & mask) >>> 0;
    const end = (start | (~mask >>> 0)) >>> 0;
    return { ok: true, interval: { start, end }, error: null };
  }

  // Range form: `a - b` or `a-b` (dash between two digits).
  let dashIdx = -1;
  const spacedDash = trimmed.indexOf(' - ');
  if (spacedDash >= 0) {
    dashIdx = spacedDash;
  } else {
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
    const l = parseIpv4(left);
    if (!l.ok) return { ok: false, interval: null, error: `Start IP: ${l.error}` };
    const r = parseIpv4(right);
    if (!r.ok) return { ok: false, interval: null, error: `End IP: ${r.error}` };
    if (l.value > r.value) {
      return { ok: false, interval: null, error: 'Start IP must be ≤ end IP.' };
    }
    return { ok: true, interval: { start: l.value, end: r.value }, error: null };
  }

  // Single IP.
  const single = parseIpv4(trimmed);
  if (!single.ok) return { ok: false, interval: null, error: single.error };
  return { ok: true, interval: { start: single.value, end: single.value }, error: null };
}

/**
 * Sort intervals by start and merge overlapping or adjacent intervals
 * (`next.start <= cur.end + 1` - adjacency is safe to merge because the two
 * ranges can always be covered by a common CIDR set).
 */
export function mergeIntervals(intervals: IpInterval[]): IpInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: IpInterval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = merged[merged.length - 1]!;
    const next = sorted[i]!;
    // `cur.end + 1` can overflow to 0 at 0xffffffff; guard by also merging
    // when cur.end is already the max address.
    if (next.start <= cur.end || cur.end === 0xffffffff || next.start === cur.end + 1) {
      if (next.end > cur.end) cur.end = next.end;
    } else {
      merged.push({ ...next });
    }
  }
  return merged;
}

/**
 * Expand an inclusive range into the minimal covering CIDR blocks (greedy
 * largest-aligned-block walker).
 */
export function rangeToCidrs(start: Ipv4Int, end: Ipv4Int): CidrBlock[] {
  const s = start >>> 0;
  const e = end >>> 0;
  if (s > e) return [];
  const blocks: CidrBlock[] = [];
  let current = s;
  while (current <= e) {
    // Alignment: trailing zero bits of `current` (32 when current === 0).
    let alignment: number;
    if (current === 0) {
      alignment = 32;
    } else {
      const isolated = (current & -current) >>> 0;
      alignment = 31 - Math.clz32(isolated);
    }
    // Remaining: floor(log2(end - current + 1)) with 2^32 overflow guard.
    const diff = (e - current) >>> 0;
    const rangeExp = diff === 0xffffffff ? 32 : 31 - Math.clz32(diff + 1);
    const sizeExp = Math.min(alignment, rangeExp);
    const prefix = 32 - sizeExp;
    const size = Math.pow(2, sizeExp) >>> 0;
    const last = (current + size - 1) >>> 0;
    blocks.push({
      cidr: `${intToIpv4(current)}/${prefix}`,
      network: intToIpv4(current),
      prefix,
      first: intToIpv4(current),
      last: intToIpv4(last),
      count: size,
    });
    if (last === 0xffffffff) break;
    current = (last + 1) >>> 0;
  }
  return blocks;
}

/**
 * Aggregate a multi-line input into minimal covering CIDR blocks.
 *
 * Lines are split on newlines and commas; `#`/`//` comments and blank lines
 * are skipped. Each remaining entry may be a CIDR, a range, or a single IP.
 */
export function aggregate(input: string): AggregateResult {
  const errors: ParseError[] = [];
  const intervals: IpInterval[] = [];
  let inputCount = 0;

  const lines = input.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    let line = lines[li]!;
    // Strip comments.
    const hashIdx = line.indexOf('#');
    if (hashIdx >= 0) line = line.slice(0, hashIdx);
    const slashComment = line.indexOf('//');
    if (slashComment >= 0) line = line.slice(0, slashComment);
    // Split on commas so `a/24, b/24` works on one line.
    const tokens = line.split(',');
    for (const token of tokens) {
      const text = token.trim();
      if (text.length === 0) continue;
      inputCount++;
      const parsed = parseEntry(text);
      if (parsed.ok && parsed.interval) {
        intervals.push(parsed.interval);
      } else {
        errors.push({ line: li + 1, text, error: parsed.error ?? 'Parse error.' });
      }
    }
  }

  const merged = mergeIntervals(intervals);
  const cidrs: CidrBlock[] = [];
  let total = 0;
  for (const m of merged) {
    const blocks = rangeToCidrs(m.start, m.end);
    cidrs.push(...blocks);
    total += (m.end - m.start + 1) >>> 0;
  }

  return {
    inputCount,
    validCount: intervals.length,
    errors,
    mergedRanges: merged.map((m) => ({
      start: intToIpv4(m.start),
      end: intToIpv4(m.end),
      count: (m.end - m.start + 1) >>> 0,
    })),
    cidrs,
    totalAddresses: total >>> 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseCidrAggregatorReturn {
  input: Ref<string>;
  result: Ref<AggregateResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useCidrAggregator(): UseCidrAggregatorReturn {
  const input = ref<string>('');
  const result = ref<AggregateResult | null>(null);

  function recompute(): void {
    if (input.value.trim().length === 0) {
      result.value = null;
      return;
    }
    result.value = aggregate(input.value);
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
      else if (typeof p.cidrs === 'string') input.value = p.cidrs;
      else if (Array.isArray(p.cidrs)) input.value = (p.cidrs as unknown[]).join('\n');
      else if (Array.isArray(p.input)) input.value = (p.input as unknown[]).join('\n');
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          inputCount: r.inputCount,
          validCount: r.validCount,
          cidrCount: r.cidrs.length,
          totalAddresses: r.totalAddresses,
          cidrs: r.cidrs.map((c) => c.cidr),
          errors: r.errors,
        });
      } else {
        sendOutput({});
      }
    }
  });

  return { input, result, isEmbed, embedInput, recompute };
}
