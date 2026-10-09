/**
 * useSubnetSplitter - composable + pure logic for the subnet splitter / VLSM
 * planner tool.
 *
 * Two modes:
 *   - Equal split: divide a base CIDR into N subnets. Borrowing
 *     `ceil(log2(N))` bits yields `2^ceil(log2(N))` equal subnets (e.g. asking
 *     for 3 produces 4).
 *   - VLSM: given a list of required host counts, allocate the smallest
 *     subnet that fits each requirement (hosts + network + broadcast,
 *     rounded up to a power of two), packed descending from the base
 *     network address.
 *
 * All arithmetic uses 32-bit unsigned integers via `>>> 0` normalisation.
 *
 * Pure helpers (`parseIpv4`, `ipv4ToInt`, `intToIpv4`, `prefixToMask`,
 * `parseBaseCidr`, `splitEqual`, `planVlsm`, `hostsToPrefix`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `useSubnetSplitter()` composable wraps them in reactive state and wires up
 * the embed PostMessage protocol.
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

/** One allocated subnet row. */
export interface SubnetAllocation {
  /** 1-based index in the output table. */
  index: number;
  /** CIDR notation `network/prefix`. */
  cidr: string;
  /** Network address (dotted). */
  network: string;
  /** Subnet mask (dotted). */
  mask: string;
  /** Prefix length. */
  prefix: number;
  /** First usable host (dotted). */
  firstHost: string;
  /** Last usable host (dotted). */
  lastHost: string;
  /** Broadcast address (dotted). */
  broadcast: string;
  /** Total addresses in the block (2^(32-prefix)). */
  size: number;
  /** Usable host count (size - 2; 2 for /31; 1 for /32). */
  hosts: number;
  /** For VLSM mode: the requested host count this allocation satisfies. */
  requested?: number;
}

export interface SplitResult {
  /** Normalised base network `a.b.c.d/n`. */
  base: string;
  baseNetwork: string;
  basePrefix: number;
  /** Total addresses in the base network. */
  baseSize: number;
  subnets: SubnetAllocation[];
  /** Addresses consumed by the allocations. */
  usedAddresses: number;
  /** Addresses still free inside the base network. */
  freeAddresses: number;
  /** For equal-split mode: how many subnets were requested. */
  requestedCount?: number;
  /** Informational note (e.g. "3 requested → 4 equal subnets"). */
  note: string | null;
}

/** Maximum subnets the tool will enumerate (display safety cap). */
export const MAX_SUBNETS = 4096;

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

/** Convert a CIDR prefix length to a 32-bit subnet mask. */
export function prefixToMask(prefix: number): Ipv4Int {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff >>> 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Parse a base network specification `a.b.c.d/n` (or bare `a.b.c.d` → /32).
 *
 * The address is normalised to its network address (host bits cleared).
 */
export function parseBaseCidr(
  input: string,
): { ok: boolean; network: Ipv4Int; prefix: number; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, network: 0, prefix: 0, error: null };
  }
  const slashIdx = trimmed.lastIndexOf('/');
  let ipPart = trimmed;
  let prefix = 32;
  if (slashIdx >= 0) {
    ipPart = trimmed.slice(0, slashIdx).trim();
    const rawPrefix = trimmed.slice(slashIdx + 1).trim();
    if (!/^(?:[0-9]|[12][0-9]|3[0-2])$/.test(rawPrefix)) {
      return { ok: false, network: 0, prefix: 0, error: 'CIDR prefix must be an integer between 0 and 32.' };
    }
    prefix = Number.parseInt(rawPrefix, 10);
  }
  const ip = parseIpv4(ipPart);
  if (!ip.ok) return { ok: false, network: 0, prefix: 0, error: ip.error };
  const network = (ip.value & prefixToMask(prefix)) >>> 0;
  return { ok: true, network, prefix, error: null };
}

/** Usable host count for a prefix (RFC 3021 /31 → 2, /32 → 1). */
export function usableHosts(prefix: number): number {
  const size = Math.pow(2, 32 - prefix);
  if (prefix >= 32) return 1;
  if (prefix === 31) return 2;
  return size - 2;
}

/** Build a SubnetAllocation row from a network int + prefix. */
function makeAllocation(
  index: number,
  networkInt: Ipv4Int,
  prefix: number,
  requested?: number,
): SubnetAllocation {
  const mask = prefixToMask(prefix);
  const size = Math.pow(2, 32 - prefix);
  const broadcast = (networkInt | (~mask >>> 0)) >>> 0;
  let firstHost = networkInt;
  let lastHost = broadcast;
  if (prefix < 31) {
    firstHost = (networkInt + 1) >>> 0;
    lastHost = (broadcast - 1) >>> 0;
  }
  return {
    index,
    cidr: `${intToIpv4(networkInt)}/${prefix}`,
    network: intToIpv4(networkInt),
    mask: intToIpv4(mask),
    prefix,
    firstHost: intToIpv4(firstHost),
    lastHost: intToIpv4(lastHost),
    broadcast: intToIpv4(broadcast),
    size,
    hosts: usableHosts(prefix),
    requested,
  };
}

/**
 * Split a base network into `count` equal subnets.
 *
 * Borrowing `ceil(log2(count))` bits produces `2^ceil(log2(count))` subnets;
 * when `count` is not a power of two the result contains more subnets than
 * requested (reported via `note`).
 */
export function splitEqual(
  network: Ipv4Int,
  prefix: number,
  count: number,
): { ok: boolean; result: SplitResult | null; error: string | null } {
  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, result: null, error: 'Number of subnets must be at least 1.' };
  }
  const n = Math.trunc(count);
  const bits = n <= 1 ? 0 : Math.ceil(Math.log2(n));
  const newPrefix = prefix + bits;
  if (newPrefix > 32) {
    return {
      ok: false,
      result: null,
      error: `Cannot split /${prefix} into ${n} subnets - would need /${newPrefix} (max /32).`,
    };
  }
  const produced = Math.pow(2, bits);
  if (produced > MAX_SUBNETS) {
    return {
      ok: false,
      result: null,
      error: `Splitting into ${produced.toLocaleString()} subnets exceeds the ${MAX_SUBNETS.toLocaleString()}-row display limit.`,
    };
  }
  const blockSize = Math.pow(2, 32 - newPrefix);
  const baseSize = Math.pow(2, 32 - prefix);
  const subnets: SubnetAllocation[] = [];
  for (let i = 0; i < produced; i++) {
    subnets.push(
      makeAllocation(i + 1, (network + i * blockSize) >>> 0, newPrefix),
    );
  }
  return {
    ok: true,
    error: null,
    result: {
      base: `${intToIpv4(network)}/${prefix}`,
      baseNetwork: intToIpv4(network),
      basePrefix: prefix,
      baseSize,
      subnets,
      usedAddresses: baseSize,
      freeAddresses: 0,
      requestedCount: n,
      note:
        produced === n
          ? null
          : `${n} requested → ${produced} equal subnets (next power of two).`,
    },
  };
}

/**
 * Smallest prefix whose usable-host capacity fits `hosts` required hosts.
 *
 * Uses the classic `hosts + 2` rule (network + broadcast) rounded up to a
 * power of two, minimum /30. `/31` and `/32` are never emitted - point-to-
 * point links should be requested explicitly.
 */
export function hostsToPrefix(hosts: number): number {
  const needed = Math.max(4, Math.trunc(hosts) + 2);
  const bits = Math.ceil(Math.log2(needed));
  return Math.max(0, 32 - bits);
}

/**
 * VLSM planner: allocate subnets for a list of required host counts.
 *
 * Requirements are sorted descending (largest first) so sequential
 * allocation from the base network stays block-aligned. Returns an error if
 * the allocations overflow the base network.
 */
export function planVlsm(
  network: Ipv4Int,
  prefix: number,
  hostCounts: number[],
): { ok: boolean; result: SplitResult | null; error: string | null } {
  if (hostCounts.length === 0) {
    return { ok: false, result: null, error: 'Enter at least one required host count.' };
  }
  for (const h of hostCounts) {
    if (!Number.isFinite(h) || h < 1) {
      return { ok: false, result: null, error: `Invalid host count "${h}" - must be a positive integer.` };
    }
  }
  const baseSize = Math.pow(2, 32 - prefix);
  const baseBroadcast = (network + baseSize - 1) >>> 0;

  // Sort descending, remembering the original request order for display.
  const sorted = hostCounts
    .map((h, i) => ({ hosts: Math.trunc(h), order: i }))
    .sort((a, b) => b.hosts - a.hosts);

  const allocations: SubnetAllocation[] = [];
  let cursor = network >>> 0;
  for (const req of sorted) {
    const p = hostsToPrefix(req.hosts);
    if (p < prefix) {
      return {
        ok: false,
        result: null,
        error: `${req.hosts.toLocaleString()} hosts needs a /${p}, which is larger than the base /${prefix}.`,
      };
    }
    const size = Math.pow(2, 32 - p);
    // Align cursor up to the block boundary.
    const aligned = cursor % size === 0 ? cursor : cursor + (size - (cursor % size));
    if (aligned + size - 1 > baseBroadcast) {
      return {
        ok: false,
        result: null,
        error: `Not enough space: ${req.hosts.toLocaleString()} hosts (/${p}) does not fit in the remaining ${(baseBroadcast - cursor + 1).toLocaleString()} addresses.`,
      };
    }
    cursor = aligned >>> 0;
    allocations.push(makeAllocation(allocations.length + 1, cursor, p, req.hosts));
    cursor = (cursor + size) >>> 0;
  }

  const used = allocations.reduce((acc, a) => acc + a.size, 0);
  return {
    ok: true,
    error: null,
    result: {
      base: `${intToIpv4(network)}/${prefix}`,
      baseNetwork: intToIpv4(network),
      basePrefix: prefix,
      baseSize,
      subnets: allocations,
      usedAddresses: used,
      freeAddresses: baseSize - used,
      note: 'Requirements allocated largest-first (VLSM).',
    },
  };
}

/** Parse a host-count list (`"500, 200, 50"` or one per line). */
export function parseHostCounts(input: string): number[] {
  return input
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => Number.parseInt(t, 10));
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export type SplitMode = 'equal' | 'vlsm';

export interface UseSubnetSplitterReturn {
  baseInput: Ref<string>;
  mode: Ref<SplitMode>;
  countInput: Ref<string>;
  hostsInput: Ref<string>;
  result: Ref<SplitResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useSubnetSplitter(): UseSubnetSplitterReturn {
  const baseInput = ref<string>('');
  const mode = ref<SplitMode>('equal');
  const countInput = ref<string>('4');
  const hostsInput = ref<string>('');
  const result = ref<SplitResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const base = baseInput.value.trim();
    if (base.length === 0) {
      result.value = null;
      error.value = null;
      return;
    }
    const parsed = parseBaseCidr(base);
    if (!parsed.ok) {
      result.value = null;
      error.value = parsed.error;
      return;
    }
    if (mode.value === 'equal') {
      const n = Number.parseInt(countInput.value.trim(), 10);
      const r = splitEqual(parsed.network, parsed.prefix, Number.isFinite(n) ? n : NaN);
      result.value = r.result;
      error.value = r.error;
      return;
    }
    const counts = parseHostCounts(hostsInput.value);
    const r = planVlsm(parsed.network, parsed.prefix, counts);
    result.value = r.result;
    error.value = r.error;
  }

  watch([baseInput, mode, countInput, hostsInput], recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.network === 'string') baseInput.value = p.network;
      else if (typeof p.cidr === 'string') baseInput.value = p.cidr;
      else if (typeof p.base === 'string') baseInput.value = p.base;
      else if (typeof p.input === 'string') baseInput.value = p.input;
      else if (typeof p.value === 'string') baseInput.value = p.value;
      if (typeof p.mode === 'string' && (p.mode === 'equal' || p.mode === 'vlsm')) {
        mode.value = p.mode;
      }
      if (typeof p.count === 'number' || typeof p.subnets === 'number') {
        countInput.value = String((p.count ?? p.subnets) as number);
        mode.value = 'equal';
      }
      if (Array.isArray(p.hosts)) {
        hostsInput.value = (p.hosts as unknown[]).join(', ');
        mode.value = 'vlsm';
      } else if (typeof p.hosts === 'string') {
        hostsInput.value = p.hosts;
        mode.value = 'vlsm';
      }
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          base: r.base,
          mode: mode.value,
          count: r.subnets.length,
          usedAddresses: r.usedAddresses,
          freeAddresses: r.freeAddresses,
          note: r.note,
          subnets: r.subnets.map((s) => ({
            cidr: s.cidr,
            network: s.network,
            mask: s.mask,
            firstHost: s.firstHost,
            lastHost: s.lastHost,
            broadcast: s.broadcast,
            hosts: s.hosts,
            requested: s.requested,
          })),
        });
      } else {
        sendOutput({ error: error.value });
      }
    }
  });

  return {
    baseInput,
    mode,
    countInput,
    hostsInput,
    result,
    error,
    isEmbed,
    embedInput,
    recompute,
  };
}
