/**
 * useMacAddressGenerator — composable + pure logic for the MAC address generator.
 *
 * Generates cryptographically secure random MAC-48 addresses using
 * `crypto.getRandomValues()`. Supports configurable quantity, case (upper/
 * lower), separator (`:`/`-`/`.` Cisco/`none` bare), and toggles for the
 * IEEE 802 locally-administered (U/L) bit and the multicast (I/G) bit.
 *
 * Pure helpers (`randomOctets`, `applyMacBits`, `formatMacOctets`,
 * `generateMac`, `generateMacs`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useMacAddressGenerator()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies — only the Web Crypto API (`crypto.getRandomValues`).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A MAC-48 address as an array of 6 octets (0-255). */
export type MacOctets = [number, number, number, number, number, number];

/** Separator styles for MAC address formatting. */
export type MacSeparator = ':' | '-' | '.' | 'none';

/** Letter case for MAC address formatting. */
export type MacCase = 'upper' | 'lower';

/** Configuration for MAC address generation. */
export interface MacGeneratorOptions {
  /** Number of MAC addresses to generate (1-1000). */
  quantity: number;
  /** Letter case of the hex digits. */
  case: MacCase;
  /** Separator style between octet groups. */
  separator: MacSeparator;
  /** Whether to set the locally-administered (U/L) bit (bit 1 of octet 0). */
  locallyAdministered: boolean;
  /** Whether to set the multicast (I/G) bit (bit 0 of octet 0). */
  multicast: boolean;
}

/** Defaults for a fresh generator config. */
export const DEFAULT_MAC_OPTIONS: MacGeneratorOptions = {
  quantity: 10,
  case: 'upper',
  separator: ':',
  locallyAdministered: true,
  multicast: false,
};

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 1000;

/**
 * Generate 6 cryptographically secure random octets via
 * `crypto.getRandomValues()`. Falls back to a CSPRNG-emulating path only if
 * the Web Crypto API is unavailable (e.g. insecure context without
 * `window.crypto`); in that case a `Math.random`-based fallback is used so the
 * tool still functions, though with weaker randomness.
 */
export function randomOctets(): MacOctets {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    return [
      buf[0] ?? 0,
      buf[1] ?? 0,
      buf[2] ?? 0,
      buf[3] ?? 0,
      buf[4] ?? 0,
      buf[5] ?? 0,
    ];
  }
  // Fallback — insecure context. Still produces 6 octets in [0, 255].
  const out: MacOctets = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/**
 * Apply the IEEE 802 U/L (locally administered) and I/G (multicast) bits to
 * the first octet of a MAC address.
 *
 * - Bit 0 (LSB) of octet 0 = multicast / I-G bit (1 = multicast/group).
 * - Bit 1 of octet 0 = U/L bit (1 = locally administered).
 *
 * Returns a *new* octets array — the input is not mutated.
 */
export function applyMacBits(
  octets: MacOctets,
  opts: Pick<MacGeneratorOptions, 'locallyAdministered' | 'multicast'>,
): MacOctets {
  let first = octets[0];
  // Clear both bits, then set them per the options.
  first &= 0b1111_1100;
  if (opts.locallyAdministered) first |= 0b0000_0010;
  if (opts.multicast) first |= 0b0000_0001;
  return [first, octets[1], octets[2], octets[3], octets[4], octets[5]];
}

/**
 * Format 6 octets as a MAC address string with the given separator and case.
 *
 * - `':'` → `AA:BB:CC:DD:EE:FF`
 * - `'-'` → `AA-BB-CC-DD-EE-FF`
 * - `'.'` → `AABB.CCDD.EEFF` (Cisco format)
 * - `'none'` → `AABBCCDDEEFF`
 */
export function formatMacOctets(
  octets: MacOctets,
  sep: MacSeparator,
  case_: MacCase,
): string {
  const toHex = (n: number) => {
    const h = n.toString(16).padStart(2, '0');
    return case_ === 'lower' ? h.toLowerCase() : h.toUpperCase();
  };
  const parts = octets.map((o) => toHex(o));
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

/**
 * Generate a single random MAC address string with the given options.
 */
export function generateMac(opts: MacGeneratorOptions): string {
  const raw = randomOctets();
  const withBits = applyMacBits(raw, opts);
  return formatMacOctets(withBits, opts.separator, opts.case);
}

/**
 * Generate `quantity` random MAC addresses. When `unique` is true (default),
 * duplicates are avoided by regenerating until the set is full or a safety
 * cap is hit (10× the requested quantity) — after which duplicates are
 * allowed to avoid an infinite loop for very small option spaces.
 */
export function generateMacs(
  opts: MacGeneratorOptions,
  unique = true,
): string[] {
  const qty = clampQuantity(opts.quantity);
  if (!unique) {
    const out: string[] = [];
    for (let i = 0; i < qty; i++) out.push(generateMac(opts));
    return out;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  let attempts = 0;
  const cap = Math.max(qty * 10, 1000);
  while (out.length < qty && attempts < cap) {
    const mac = generateMac(opts);
    attempts++;
    if (seen.has(mac)) continue;
    seen.add(mac);
    out.push(mac);
  }
  // If we hit the cap without filling, top up with any (possibly duplicate)
  // values so the user always gets the requested count.
  while (out.length < qty) out.push(generateMac(opts));
  return out;
}

/** Clamp the quantity into the valid [MIN_QUANTITY, MAX_QUANTITY] range. */
export function clampQuantity(n: number): number {
  if (!Number.isFinite(n)) return MIN_QUANTITY;
  const v = Math.trunc(n);
  if (v < MIN_QUANTITY) return MIN_QUANTITY;
  if (v > MAX_QUANTITY) return MAX_QUANTITY;
  return v;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseMacAddressGeneratorReturn {
  config: Ref<MacGeneratorOptions>;
  macs: Ref<string[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  regenerate: () => void;
}

export function useMacAddressGenerator(): UseMacAddressGeneratorReturn {
  const config = ref<MacGeneratorOptions>({ ...DEFAULT_MAC_OPTIONS });
  const macs = ref<string[]>([]);

  function regenerate(): void {
    macs.value = generateMacs(config.value);
  }

  // Regenerate whenever any config option changes.
  watch(
    config,
    () => {
      regenerate();
    },
    { deep: true, immediate: true },
  );

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.quantity === 'number' || typeof p.count === 'number') {
        config.value.quantity = clampQuantity(
          (p.quantity as number) ?? (p.count as number),
        );
      }
      if (p.case === 'upper' || p.case === 'lower') {
        config.value.case = p.case;
      }
      if (
        p.separator === ':' ||
        p.separator === '-' ||
        p.separator === '.' ||
        p.separator === 'none'
      ) {
        config.value.separator = p.separator;
      }
      if (typeof p.locallyAdministered === 'boolean') {
        config.value.locallyAdministered = p.locallyAdministered;
      }
      if (typeof p.multicast === 'boolean') {
        config.value.multicast = p.multicast;
      }
      // Allow a plain `input`/`value` string to trigger a regenerate.
      if (
        typeof p.input === 'string' ||
        typeof p.value === 'string' ||
        p.generate === true ||
        p.regenerate === true
      ) {
        regenerate();
      }
    },
  });

  watch(macs, (m) => {
    if (isEmbed.value) {
      sendOutput({
        macs: m,
        quantity: m.length,
        options: { ...config.value },
      });
    }
  });

  return { config, macs, isEmbed, embedInput, regenerate };
}
