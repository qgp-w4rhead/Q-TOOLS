/**
 * useIpv4AddressConverter — composable + pure logic for the IPv4 address
 * converter tool.
 *
 * Parses an IPv4 dotted-decimal string (e.g. `192.168.1.10`) and converts it
 * into eight numeric representations:
 *   - decimal      (32-bit unsigned integer, e.g. `3232235786`)
 *   - hex          (e.g. `0xC0A8010A`)
 *   - binary       (32-bit zero-padded, e.g. `11000000101010000000000100001010`)
 *   - octal        (e.g. `030052004012`)
 *   - dotted decimal  (canonical `a.b.c.d`)
 *   - dotted hex      (`C0.A8.01.0A`)
 *   - dotted binary   (`11000000.10101000.00000001.00001010`)
 *   - dotted octal    (`0300.0250.0001.0012`)
 *
 * It also reports the IP class (A/B/C/D/E) and private/loopback/link-local
 * scope, mirroring the subnet calculator's classification.
 *
 * All arithmetic uses 32-bit unsigned integers via `>>> 0` normalisation — no
 * BigInt needed (32 bits fits comfortably in JavaScript's safe-integer range).
 *
 * Pure helpers (`parseIpv4`, `ipv4ToInt`, `intToIpv4`, `intToHex`,
 * `intToOctal`, `intToBinary`, `intToDottedHex`, `intToDottedBinary`,
 * `intToDottedOctal`, `classifyIp`, `isPrivateIp`, `convertIpv4`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `useIpv4AddressConverter()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
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

/** Full conversion result returned by `convertIpv4`. */
export interface Ipv4ConversionResult {
  /** Original IP as a dotted-decimal string. */
  dottedDecimal: string;
  /** 32-bit unsigned integer (e.g. `3232235786`). */
  decimal: number;
  /** Hex string with `0x` prefix, uppercase (e.g. `0xC0A8010A`). */
  hex: string;
  /** 32-bit zero-padded binary string (e.g. `11000000101010000000000100001010`). */
  binary: string;
  /** Octal string with `0` prefix (e.g. `030052004012`). */
  octal: string;
  /** Dotted hex, uppercase (e.g. `C0.A8.01.0A`). */
  dottedHex: string;
  /** Dotted binary, 8-bit groups (e.g. `11000000.10101000.00000001.00001010`). */
  dottedBinary: string;
  /** Dotted octal, 4-digit zero-padded groups (e.g. `0300.0250.0001.0012`). */
  dottedOctal: string;
  /** IP class: A, B, C, D, or E. */
  ipClass: 'A' | 'B' | 'C' | 'D' | 'E';
  /** Whether the address is in a private/reserved range. */
  isPrivate: boolean;
  /** Human-readable scope label (Private / Loopback / Link-local / Public / Reserved). */
  scope: string;
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
  // Allow a trailing `/n` CIDR suffix — strip it (the converter only cares
  // about the address itself).
  const slashIdx = trimmed.lastIndexOf('/');
  const addr = slashIdx >= 0 ? trimmed.slice(0, slashIdx).trim() : trimmed;
  const parts = addr.split('.');
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

/** Convert a 32-bit unsigned integer to a dotted-decimal IPv4 string. */
export function intToIpv4(n: Ipv4Int): string {
  const v = n >>> 0;
  return `${(v >>> 24) & 0xff}.${(v >>> 16) & 0xff}.${(v >>> 8) & 0xff}.${v & 0xff}`;
}

/** Convert a 32-bit unsigned integer to a hex string with `0x` prefix (uppercase). */
export function intToHex(n: Ipv4Int): string {
  return '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/** Convert a 32-bit unsigned integer to an octal string with `0` prefix. */
export function intToOctal(n: Ipv4Int): string {
  return '0' + (n >>> 0).toString(8).padStart(11, '0');
}

/** Convert a 32-bit unsigned integer to a 32-bit zero-padded binary string. */
export function intToBinary(n: Ipv4Int): string {
  return (n >>> 0).toString(2).padStart(32, '0');
}

/** Convert a 32-bit unsigned integer to a dotted-hex string (uppercase, 2-digit groups). */
export function intToDottedHex(n: Ipv4Int): string {
  const v = n >>> 0;
  const h = (b: number): string => (b & 0xff).toString(16).toUpperCase().padStart(2, '0');
  return `${h(v >>> 24)}.${h(v >>> 16)}.${h(v >>> 8)}.${h(v)}`;
}

/** Convert a 32-bit unsigned integer to a dotted-binary string (8-bit groups). */
export function intToDottedBinary(n: Ipv4Int): string {
  const v = n >>> 0;
  const b = (x: number): string => (x & 0xff).toString(2).padStart(8, '0');
  return `${b(v >>> 24)}.${b(v >>> 16)}.${b(v >>> 8)}.${b(v)}`;
}

/** Convert a 32-bit unsigned integer to a dotted-octal string (4-digit zero-padded groups). */
export function intToDottedOctal(n: Ipv4Int): string {
  const v = n >>> 0;
  const o = (x: number): string => (x & 0xff).toString(8).padStart(4, '0');
  return `${o(v >>> 24)}.${o(v >>> 16)}.${o(v >>> 8)}.${o(v)}`;
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
 *   - `Reserved` (0/8, 240/4 — "this network" + class E future use)
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
 * Convert an IPv4 dotted-decimal string into all eight numeric representations.
 *
 * Returns `{ ok: false, error }` on parse failure.
 */
export function convertIpv4(input: string): { ok: true; result: Ipv4ConversionResult } | { ok: false; error: string } {
  const parsed = parseIpv4(input);
  if (!parsed.ok) return { ok: false, error: parsed.error! };
  const ip = parsed.value;
  const cls = classifyIp(ip);
  const { isPrivate, scope } = isPrivateIp(ip);
  return {
    ok: true,
    result: {
      dottedDecimal: intToIpv4(ip),
      decimal: ip,
      hex: intToHex(ip),
      binary: intToBinary(ip),
      octal: intToOctal(ip),
      dottedHex: intToDottedHex(ip),
      dottedBinary: intToDottedBinary(ip),
      dottedOctal: intToDottedOctal(ip),
      ipClass: cls,
      isPrivate,
      scope,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseIpv4AddressConverterReturn {
  ipInput: Ref<string>;
  result: Ref<Ipv4ConversionResult | null>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useIpv4AddressConverter(): UseIpv4AddressConverterReturn {
  const ipInput = ref<string>('');
  const result = ref<Ipv4ConversionResult | null>(null);
  const error = ref<string | null>(null);

  function recompute(): void {
    const ip = ipInput.value.trim();
    if (ip.length === 0) {
      result.value = null;
      error.value = null;
      return;
    }
    const conv = convertIpv4(ip);
    if (!conv.ok) {
      result.value = null;
      error.value = conv.error;
      return;
    }
    error.value = null;
    result.value = conv.result;
  }

  watch(ipInput, recompute, { immediate: true });

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
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          dottedDecimal: r.dottedDecimal,
          decimal: r.decimal,
          hex: r.hex,
          binary: r.binary,
          octal: r.octal,
          dottedHex: r.dottedHex,
          dottedBinary: r.dottedBinary,
          dottedOctal: r.dottedOctal,
          ipClass: r.ipClass,
          isPrivate: r.isPrivate,
          scope: r.scope,
        });
      } else {
        sendOutput({ error: error.value });
      }
    }
  });

  return { ipInput, result, error, isEmbed, embedInput, recompute };
}
