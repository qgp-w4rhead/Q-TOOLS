/**
 * useIpv6SubnetCalculator - composable + pure logic for the IPv6 subnet
 * calculator tool.
 *
 * Parses an IPv6 address and prefix length, then calculates:
 *   - Network address
 *   - First and last usable addresses
 *   - Total number of addresses
 *   - Compressed and expanded forms
 *
 * Uses BigInt for 128-bit arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface UseIpv6SubnetCalculatorReturn {
  input: Ref<string>;
  prefixLength: Ref<number>;
  result: Ref<string>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

const IPV6_BITS = 128n;

/**
 * Parse an IPv6 address string into a BigInt (128-bit unsigned).
 * Returns null if the address is invalid.
 */
export function parseIpv6(addr: string): bigint | null {
  const trimmed = addr.trim().toLowerCase();
  if (!trimmed) return null;

  // Handle :: shorthand
  let parts: string[];
  if (trimmed.includes('::')) {
    const halves = trimmed.split('::');
    if (halves.length !== 2) return null; // Multiple :: is invalid
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    parts = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    parts = trimmed.split(':');
  }

  if (parts.length !== 8) return null;

  let result = 0n;
  for (const part of parts) {
    if (!part || part.length > 4) return null;
    if (!/^[0-9a-f]+$/.test(part)) return null;
    result = (result << 16n) | BigInt(parseInt(part, 16));
  }

  return result;
}

/**
 * Expand an IPv6 address to its full 8-group form.
 */
export function expandIpv6(addr: string): string | null {
  const value = parseIpv6(addr);
  if (value === null) return null;

  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const shift = BigInt(i) * 16n;
    const group = Number((value >> shift) & 0xffffn);
    groups.unshift(group.toString(16).padStart(4, '0'));
  }
  return groups.join(':');
}

/**
 * Compress an IPv6 address using :: shorthand for the longest run of zero groups.
 */
export function compressIpv6(addr: string): string | null {
  const value = parseIpv6(addr);
  if (value === null) return null;

  const groups: number[] = [];
  for (let i = 7; i >= 0; i--) {
    const shift = BigInt(i) * 16n;
    groups.unshift(Number((value >> shift) & 0xffffn));
  }

  // Find the longest run of zero groups
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;

  for (let i = 0; i < 8; i++) {
    if (groups[i] === 0) {
      if (curStart === -1) curStart = i;
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

  const hexGroups = groups.map((g) => g.toString(16));

  if (bestLen >= 2) {
    const left = hexGroups.slice(0, bestStart).join(':');
    const right = hexGroups.slice(bestStart + bestLen).join(':');
    return `${left}::${right}`;
  }

  return hexGroups.join(':');
}

/**
 * Calculate IPv6 subnet details from an address and prefix length.
 */
export function calculateIpv6Subnet(
  addr: string,
  prefix: number,
): {
  networkAddress: string;
  firstAddress: string;
  lastAddress: string;
  totalAddresses: string;
  expandedForm: string;
  compressedForm: string;
} | null {
  const value = parseIpv6(addr);
  if (value === null) return null;
  if (prefix < 0 || prefix > 128) return null;

  const prefixBigInt = BigInt(prefix);

  // Network mask: prefix bits set to 1, rest to 0
  const mask = prefixBigInt === 0n ? 0n : ((1n << prefixBigInt) - 1n) << (IPV6_BITS - prefixBigInt);
  const network = value & mask;

  // Total addresses: 2^(128 - prefix)
  const hostBits = IPV6_BITS - prefixBigInt;
  const total = 1n << hostBits;

  // First address = network
  const first = network;

  // Last address = network + total - 1
  const last = network + total - 1n;

  // Format BigInt as IPv6
  function formatIpv6(value: bigint): string {
    const groups: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const shift = BigInt(i) * 16n;
      const group = Number((value >> shift) & 0xffffn);
      groups.unshift(group.toString(16));
    }
    // Apply :: compression
    let bestStart = -1;
    let bestLen = 0;
    let curStart = -1;
    let curLen = 0;
    const nums = groups.map((g) => parseInt(g, 16));
    for (let i = 0; i < 8; i++) {
      if (nums[i] === 0) {
        if (curStart === -1) curStart = i;
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
    if (bestLen >= 2) {
      const left = groups.slice(0, bestStart).join(':');
      const right = groups.slice(bestStart + bestLen).join(':');
      return `${left}::${right}`;
    }
    return groups.join(':');
  }

  return {
    networkAddress: formatIpv6(network),
    firstAddress: formatIpv6(first),
    lastAddress: formatIpv6(last),
    totalAddresses: total.toString(),
    expandedForm: expandIpv6(addr) ?? '',
    compressedForm: compressIpv6(addr) ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useIpv6SubnetCalculator(): UseIpv6SubnetCalculatorReturn {
  const input = ref<string>('2001:db8::1');
  const prefixLength = ref<number>(64);
  const result = ref<string>('');
  const error = ref<string>('');

  function recompute(): void {
    const calc = calculateIpv6Subnet(input.value, prefixLength.value);
    if (calc === null) {
      error.value = 'Invalid IPv6 address or prefix length.';
      result.value = '';
      return;
    }
    error.value = '';
    result.value = [
      `Network address:   ${calc.networkAddress}`,
      `First address:      ${calc.firstAddress}`,
      `Last address:       ${calc.lastAddress}`,
      `Total addresses:    ${calc.totalAddresses}`,
      ``,
      `Expanded form:      ${calc.expandedForm}`,
      `Compressed form:    ${calc.compressedForm}`,
    ].join('\n');
  }

  function reset(): void {
    input.value = '2001:db8::1';
    prefixLength.value = 64;
    recompute();
  }

  watch([input, prefixLength], () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      }
      if (typeof p.prefix === 'number' || typeof p.prefix === 'string') {
        prefixLength.value = Number(p.prefix);
      }
    },
  });

  watch([result, error], () => {
    if (isEmbed.value) {
      sendOutput({
        result: result.value,
        error: error.value,
      });
    }
  });

  return {
    input,
    prefixLength,
    result,
    error,
    isEmbed,
    embedInput,
    reset,
  };
}
