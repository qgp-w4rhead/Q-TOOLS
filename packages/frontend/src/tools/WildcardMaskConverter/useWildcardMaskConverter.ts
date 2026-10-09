/**
 * useWildcardMaskConverter - composable + pure logic for the wildcard mask
 * converter tool.
 *
 * Converts between the three equivalent ways of expressing an IPv4 network
 * size (Cisco ACL style):
 *   - CIDR prefix       `24`
 *   - subnet mask       `255.255.255.0`
 *   - wildcard mask     `0.0.0.255`  (bitwise inverse of the subnet mask)
 *
 * Input auto-detection: a bare integer is a prefix; a dotted quad is tried
 * as a subnet mask first (contiguous 1s) then as a wildcard mask (contiguous
 * 0s). An explicit mode selector can force the interpretation. An optional
 * network address field renders a ready-to-paste Cisco ACL line.
 *
 * Pure helpers (`parseIpv4`, `intToIpv4`, `prefixToMask`, `maskToPrefix`,
 * `wildcardToPrefix`, `convert`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useWildcardMaskConverter()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies - 32-bit unsigned integer arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export type Ipv4Int = number;

/** How the input field should be interpreted. */
export type MaskMode = 'auto' | 'prefix' | 'mask' | 'wildcard';

export interface WildcardResult {
  /** CIDR prefix length (0-32). */
  prefix: number;
  /** Subnet mask (dotted). */
  subnetMask: string;
  /** Wildcard mask (dotted). */
  wildcardMask: string;
  /** Binary subnet mask (dotted octets). */
  binaryMask: string;
  /** Binary wildcard mask (dotted octets). */
  binaryWildcard: string;
  /** Total addresses covered (2^(32-prefix)). */
  totalAddresses: number;
  /** Usable hosts (total - 2; 2 for /31; 1 for /32). */
  usableHosts: number;
  /** How the input was interpreted. */
  interpretedAs: 'prefix' | 'mask' | 'wildcard';
  /** Cisco ACL fragment `network wildcard` when a network was supplied. */
  aclFragment: string | null;
}

/** Parse a dotted IPv4 string into a 32-bit unsigned integer. */
export function parseIpv4(input: string): { ok: boolean; value: Ipv4Int; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, value: 0, error: 'Address is empty.' };
  const parts = trimmed.split('.');
  if (parts.length !== 4) {
    return { ok: false, value: 0, error: 'Expected 4 dot-separated octets.' };
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

/** Dotted binary form of a 32-bit value. */
export function intToBinary(n: Ipv4Int): string {
  const bin = (n >>> 0).toString(2).padStart(32, '0');
  return `${bin.slice(0, 8)}.${bin.slice(8, 16)}.${bin.slice(16, 24)}.${bin.slice(24, 32)}`;
}

/** CIDR prefix length → 32-bit subnet mask. */
export function prefixToMask(prefix: number): Ipv4Int {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff >>> 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * 32-bit subnet mask → CIDR prefix, or `null` when the mask is not
 * contiguous (e.g. `255.0.255.0`).
 */
export function maskToPrefix(mask: Ipv4Int): number | null {
  const v = mask >>> 0;
  if (v === 0) return 0;
  const w = (~v) >>> 0;
  if (w === 0) return 32;
  if ((w & (w + 1)) !== 0) return null;
  return Math.clz32(w);
}

/**
 * 32-bit wildcard mask → CIDR prefix, or `null` when the wildcard is not
 * contiguous (a valid wildcard is all 1s in the low bits, i.e. its inverse
 * is a contiguous subnet mask).
 */
export function wildcardToPrefix(wildcard: Ipv4Int): number | null {
  return maskToPrefix((~wildcard) >>> 0);
}

/**
 * Convert a mask/prefix input into all three forms.
 *
 * `mode` controls interpretation; `'auto'` tries prefix (bare integer),
 * then subnet mask (contiguous 1s), then wildcard (contiguous 0s).
 * `networkInput` optionally supplies a base address for the ACL fragment.
 */
export function convert(
  input: string,
  mode: MaskMode,
  networkInput: string,
): { ok: boolean; result: WildcardResult | null; error: string | null } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, result: null, error: null };
  }

  let prefix: number | null = null;
  let interpretedAs: WildcardResult['interpretedAs'] = 'prefix';

  const asPrefix = (): number | null => {
    if (!/^(?:[0-9]|[12][0-9]|3[0-2])$/.test(trimmed)) return null;
    return Number.parseInt(trimmed, 10);
  };
  const asMask = (): number | null => {
    const p = parseIpv4(trimmed);
    if (!p.ok) return null;
    return maskToPrefix(p.value);
  };
  const asWildcard = (): number | null => {
    const p = parseIpv4(trimmed);
    if (!p.ok) return null;
    return wildcardToPrefix(p.value);
  };

  if (mode === 'prefix') {
    prefix = asPrefix();
    if (prefix === null) {
      return { ok: false, result: null, error: 'CIDR prefix must be an integer between 0 and 32.' };
    }
    interpretedAs = 'prefix';
  } else if (mode === 'mask') {
    prefix = asMask();
    if (prefix === null) {
      return { ok: false, result: null, error: 'Not a valid contiguous subnet mask (e.g. 255.255.255.0).' };
    }
    interpretedAs = 'mask';
  } else if (mode === 'wildcard') {
    prefix = asWildcard();
    if (prefix === null) {
      return { ok: false, result: null, error: 'Not a valid contiguous wildcard mask (e.g. 0.0.0.255).' };
    }
    interpretedAs = 'wildcard';
  } else {
    // auto: bare integer → prefix; dotted → mask first, then wildcard.
    const p = asPrefix();
    if (p !== null) {
      prefix = p;
      interpretedAs = 'prefix';
    } else {
      const m = asMask();
      if (m !== null) {
        prefix = m;
        interpretedAs = 'mask';
      } else {
        const w = asWildcard();
        if (w !== null) {
          prefix = w;
          interpretedAs = 'wildcard';
        } else {
          return {
            ok: false,
            result: null,
            error: 'Enter a prefix (24), subnet mask (255.255.255.0), or wildcard mask (0.0.0.255).',
          };
        }
      }
    }
  }

  const mask = prefixToMask(prefix);
  const wildcard = (~mask) >>> 0;
  const total = Math.pow(2, 32 - prefix);
  const usable = prefix >= 32 ? 1 : prefix === 31 ? 2 : total - 2;

  let aclFragment: string | null = null;
  const netText = networkInput.trim();
  if (netText.length > 0) {
    const net = parseIpv4(netText);
    if (!net.ok) {
      return { ok: false, result: null, error: `Network address: ${net.error}` };
    }
    const base = (net.value & mask) >>> 0;
    aclFragment = `${intToIpv4(base)} ${intToIpv4(wildcard)}`;
  }

  return {
    ok: true,
    error: null,
    result: {
      prefix,
      subnetMask: intToIpv4(mask),
      wildcardMask: intToIpv4(wildcard),
      binaryMask: intToBinary(mask),
      binaryWildcard: intToBinary(wildcard),
      totalAddresses: total,
      usableHosts: usable,
      interpretedAs,
      aclFragment,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseWildcardMaskConverterReturn {
  input: Ref<string>;
  mode: Ref<MaskMode>;
  networkInput: Ref<string>;
  result: Ref<WildcardResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useWildcardMaskConverter(): UseWildcardMaskConverterReturn {
  const input = ref<string>('');
  const mode = ref<MaskMode>('auto');
  const networkInput = ref<string>('');
  const result = ref<WildcardResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const r = convert(input.value, mode.value, networkInput.value);
    result.value = r.result;
    error.value = r.error;
  }

  watch([input, mode, networkInput], recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
      else if (typeof p.mask === 'string') { input.value = p.mask; mode.value = 'mask'; }
      else if (typeof p.wildcard === 'string') { input.value = p.wildcard; mode.value = 'wildcard'; }
      else if (typeof p.prefix === 'string' || typeof p.prefix === 'number') {
        input.value = String(p.prefix);
        mode.value = 'prefix';
      } else if (typeof p.cidr === 'string' || typeof p.cidr === 'number') {
        input.value = String(p.cidr);
        mode.value = 'prefix';
      }
      if (typeof p.mode === 'string' &&
        (p.mode === 'auto' || p.mode === 'prefix' || p.mode === 'mask' || p.mode === 'wildcard')) {
        mode.value = p.mode;
      }
      if (typeof p.network === 'string') networkInput.value = p.network;
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

  return { input, mode, networkInput, result, error, isEmbed, embedInput, recompute };
}
