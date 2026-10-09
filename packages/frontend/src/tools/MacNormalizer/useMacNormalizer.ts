/**
 * useMacNormalizer - composable + pure logic for the MAC address normalizer
 * tool.
 *
 * Accepts a MAC-48 address in any common notation (`:`/`-`/`.` separated or
 * contiguous hex, any case) and emits every standard representation:
 *   - colon-separated  `AA:BB:CC:DD:EE:FF` (upper + lower)
 *   - hyphen-separated `AA-BB-CC-DD-EE-FF` (upper + lower)
 *   - Cisco dot        `aabb.ccdd.eeff`    (lower, per Cisco convention)
 *   - bare hex         `AABBCCDDEEFF`      (upper + lower)
 *   - 48-bit integer   decimal + hex
 *   - binary           6 octets of 8 bits
 *
 * Also decodes the IEEE 802 flag bits in the first octet: I/G (multicast)
 * and U/L (locally administered), plus the broadcast address and the OUI
 * prefix.
 *
 * Pure helpers (`parseMac`, `formatMac`, `macToInt`, `macToBinary`,
 * `isMulticast`, `isLocallyAdministered`, `isBroadcast`, `normalizeMacInput`)
 * have no Vue dependency and can be imported standalone for unit testing or
 * reuse. The `useMacNormalizer()` composable wraps them in reactive state
 * and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A MAC-48 address as an array of 6 octets (0-255). */
export type MacOctets = [number, number, number, number, number, number];

/** Separator styles for MAC formatting. */
export type MacSeparator = ':' | '-' | '.' | 'none';

export interface MacNormalizeResult {
  /** Original input (trimmed). */
  raw: string;
  /** The 6 octets. */
  octets: MacOctets;
  /** `AA:BB:CC:DD:EE:FF` (uppercase). */
  colonUpper: string;
  /** `aa:bb:cc:dd:ee:ff` (lowercase). */
  colonLower: string;
  /** `AA-BB-CC-DD-EE-FF` (uppercase). */
  hyphenUpper: string;
  /** `aa-bb-cc-dd-ee-ff` (lowercase). */
  hyphenLower: string;
  /** `aabb.ccdd.eeff` (Cisco, lowercase). */
  cisco: string;
  /** `AABBCCDDEEFF` (bare, uppercase). */
  bareUpper: string;
  /** `aabbccddeeff` (bare, lowercase). */
  bareLower: string;
  /** 48-bit decimal integer string. */
  decimal: string;
  /** `0xAABBCCDDEEFF`. */
  hexInteger: string;
  /** Dotted binary (`xxxxxxxx.xxxxxxxx.…`). */
  binary: string;
  /** Canonical OUI prefix `AA:BB:CC`. */
  oui: string;
  /** I/G bit: multicast/group address. */
  isMulticast: boolean;
  /** U/L bit: locally administered. */
  isLocallyAdministered: boolean;
  /** All-ones broadcast address. */
  isBroadcast: boolean;
}

/**
 * Parse a MAC-48 address from any common notation.
 *
 * Accepted: `AA:BB:CC:DD:EE:FF`, `AA-BB-CC-DD-EE-FF`, `AABB.CCDD.EEFF`,
 * `AABBCCDDEEFF` (any case). Unlike the lookup tool, a full 6-octet address
 * is required - a bare OUI is rejected.
 */
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
  // Validate separator structure when separators are present.
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
 * Format a 6-octet MAC with the given separator.
 *
 * `':'` → `AA:BB:CC:DD:EE:FF`, `'-'` → `AA-BB-CC-DD-EE-FF`,
 * `'.'` → `AABB.CCDD.EEFF` (Cisco), `'none'` → `AABBCCDDEEFF`.
 */
export function formatMac(octets: MacOctets, sep: MacSeparator, upper = true): string {
  const h = (n: number) => {
    const s = n.toString(16).padStart(2, '0');
    return upper ? s.toUpperCase() : s;
  };
  const parts = octets.map((o) => h(o));
  switch (sep) {
    case ':':
      return parts.join(':');
    case '-':
      return parts.join('-');
    case '.':
      return `${parts[0]}${parts[1]}.${parts[2]}${parts[3]}.${parts[4]}${parts[5]}`;
    case 'none':
      return parts.join('');
  }
}

/** 48-bit integer value of the MAC (BigInt → decimal string). */
export function macToInt(octets: MacOctets): bigint {
  let v = 0n;
  for (const o of octets) v = (v << 8n) | BigInt(o);
  return v;
}

/** Dotted binary representation (`xxxxxxxx` per octet). */
export function macToBinary(octets: MacOctets): string {
  return octets.map((o) => o.toString(2).padStart(8, '0')).join('.');
}

/** I/G bit: least-significant bit of the first octet (multicast/group). */
export function isMulticast(octets: MacOctets): boolean {
  return (octets[0] & 0b0000_0001) === 1;
}

/** U/L bit: second-least-significant bit of the first octet (local). */
export function isLocallyAdministered(octets: MacOctets): boolean {
  return (octets[0] & 0b0000_0010) === 0b10;
}

/** Whether the MAC is the broadcast address `FF:FF:FF:FF:FF:FF`. */
export function isBroadcast(octets: MacOctets): boolean {
  return octets.every((o) => o === 0xff);
}

/** Full normalisation result for a parsed MAC. */
export function normalizeMacInput(octets: MacOctets, raw: string): MacNormalizeResult {
  const intVal = macToInt(octets);
  return {
    raw,
    octets,
    colonUpper: formatMac(octets, ':', true),
    colonLower: formatMac(octets, ':', false),
    hyphenUpper: formatMac(octets, '-', true),
    hyphenLower: formatMac(octets, '-', false),
    cisco: formatMac(octets, '.', false),
    bareUpper: formatMac(octets, 'none', true),
    bareLower: formatMac(octets, 'none', false),
    decimal: intVal.toString(10),
    hexInteger: `0x${intVal.toString(16).toUpperCase().padStart(12, '0')}`,
    binary: macToBinary(octets),
    oui: formatMac(octets, ':', true).slice(0, 8),
    isMulticast: isMulticast(octets),
    isLocallyAdministered: isLocallyAdministered(octets),
    isBroadcast: isBroadcast(octets),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseMacNormalizerReturn {
  input: Ref<string>;
  result: Ref<MacNormalizeResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useMacNormalizer(): UseMacNormalizerReturn {
  const input = ref<string>('');
  const result = ref<MacNormalizeResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const text = input.value.trim();
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
    error.value = null;
    result.value = normalizeMacInput(parsed.octets, text);
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mac === 'string') input.value = p.mac;
      else if (typeof p.address === 'string') input.value = p.address;
      else if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          colon: r.colonUpper,
          hyphen: r.hyphenUpper,
          cisco: r.cisco,
          bare: r.bareUpper,
          decimal: r.decimal,
          hex: r.hexInteger,
          binary: r.binary,
          oui: r.oui,
          isMulticast: r.isMulticast,
          isLocallyAdministered: r.isLocallyAdministered,
          isBroadcast: r.isBroadcast,
        });
      } else {
        sendOutput({ error: error.value });
      }
    }
  });

  return { input, result, error, isEmbed, embedInput, recompute };
}
