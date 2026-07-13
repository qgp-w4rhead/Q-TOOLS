/**
 * useMacAddressLookup — composable + pure logic for the MAC address lookup tool.
 *
 * Parses a MAC-48 address (or a bare 3-octet OUI prefix) from any common
 * notation (`:`/`-`/`.` separated, or contiguous hex), normalises it, classifies
 * it (multicast / locally-administered / broadcast), and looks up the
 * vendor / manufacturer name from the bundled IEEE OUI database.
 *
 * The OUI database (~39k entries, ~1.3 MB) is a static JSON asset that is
 * lazy-loaded via a dynamic `import()` on first use so it lands in its own Vite
 * chunk and is cached by the service worker for offline use.
 *
 * Pure helpers (`parseMac`, `normalizeMac`, `formatMac`, `isMulticast`,
 * `isLocallyAdministered`, `isBroadcast`, `ouiFromOctets`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `useMacAddressLookup()` composable wraps them in reactive state, manages the
 * async OUI database load, and wires up the embed PostMessage protocol.
 *
 * No external dependencies — only the bundled OUI JSON asset.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* OUI database — lazy-loaded static asset                                     */
/* -------------------------------------------------------------------------- */

/** Shape of the bundled `oui-database.json`: `{ "AABBCC": "Vendor Name" }`. */
type OuiDatabase = Record<string, string>;

/** Cached promise so the JSON is fetched only once per session. */
let dbPromise: Promise<OuiDatabase> | null = null;
/** Cached database once loaded. */
let dbCache: OuiDatabase | null = null;

/**
 * Lazily import the OUI database JSON. The import is cached so subsequent
 * lookups resolve synchronously from `dbCache`. Vite emits the JSON as a
 * separate chunk (~1.3 MB, ~415 KB gzip) that the service worker caches for
 * offline use.
 */
export function loadOuiDatabase(): Promise<OuiDatabase> {
  if (dbCache) return Promise.resolve(dbCache);
  if (!dbPromise) {
    // Dynamic import → Vite code-splits the JSON into its own chunk.
    dbPromise = import('./oui-database.json').then((mod) => {
      // With resolveJsonModule, the module is the JSON object itself (Vite)
      // but may also expose a `default` key. Handle both shapes.
      const candidate = (mod as unknown as { default?: OuiDatabase }).default;
      const data = (candidate ?? (mod as unknown as OuiDatabase)) as OuiDatabase;
      dbCache = data;
      return data;
    });
  }
  return dbPromise;
}

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** A MAC-48 address as an array of 6 octets (0-255). */
export type MacOctets = [number, number, number, number, number, number];

/** Separator styles for MAC address formatting. */
export type MacSeparator = ':' | '-' | '.' | 'none';

/** Result of `parseMac` — the structural breakdown of a MAC input. */
export interface ParsedMac {
  /** Original input (trimmed). */
  raw: string;
  /** Whether the input is a structurally valid MAC-48 or 3-octet OUI. */
  isValid: boolean;
  /** Validation error message when `isValid` is false. */
  error: string | null;
  /** The 6 octets. When only a 3-octet OUI was supplied, the last 3 are 0. */
  octets: MacOctets | null;
  /** Whether only an OUI prefix (3 octets) was provided. */
  isOuiOnly: boolean;
  /** Canonical OUI prefix `AA-BB-CC` (uppercase, dash-separated). */
  oui: string | null;
  /** Normalised full MAC `AA:BB:CC:DD:EE:FF` (uppercase, colon-separated). */
  normalized: string | null;
}

/** Result of a vendor lookup. */
export interface MacLookupResult {
  /** Original input (trimmed). */
  raw: string;
  /** Whether the input is a structurally valid MAC-48 or 3-octet OUI. */
  isValid: boolean;
  /** Validation error message when `isValid` is false. */
  error: string | null;
  /** The 6 octets (last 3 are 0 when only an OUI was supplied). */
  octets: MacOctets | null;
  /** Whether only an OUI prefix (3 octets) was provided. */
  isOuiOnly: boolean;
  /** Canonical OUI prefix `AA-BB-CC` (uppercase, dash-separated). */
  oui: string | null;
  /** Normalised full MAC `AA:BB:CC:DD:EE:FF` (uppercase, colon-separated). */
  normalized: string | null;
  /** Vendor / manufacturer name from the OUI database, or `null` if unknown. */
  vendor: string | null;
  /** Whether the OUI was found in the database. */
  isKnown: boolean;
  /** Whether the address is a multicast address (IGMP bit set). */
  isMulticast: boolean;
  /** Whether the address is locally administered (U/L bit set). */
  isLocallyAdministered: boolean;
  /** Whether the address is the broadcast address (all 1s). */
  isBroadcast: boolean;
  /** MAC formatted with the given separators. */
  formatted: (sep: MacSeparator) => string;
}

/**
 * Parse a MAC address (or 3-octet OUI prefix) from any common notation.
 *
 * Accepted formats:
 *   - `AA:BB:CC:DD:EE:FF` (colon-separated, 6 groups)
 *   - `AA-BB-CC-DD-EE-FF` (dash-separated, 6 groups)
 *   - `AABB.CCDD.EEFF`    (Cisco-style, 4 hex digits × 3 groups)
 *   - `AABBCCDDEEFF`      (contiguous, 12 hex digits)
 *   - `AA:BB:CC`          (OUI only, 3 groups)
 *   - `AA-BB-CC`          (OUI only, 3 groups)
 *   - `AABBCC`            (OUI only, 6 contiguous hex digits)
 *
 * Hex digits are case-insensitive. Surrounding whitespace is trimmed.
 */
export function parseMac(input: string): ParsedMac {
  const raw = input.trim();
  const empty: ParsedMac = {
    raw,
    isValid: false,
    error: null,
    octets: null,
    isOuiOnly: false,
    oui: null,
    normalized: null,
  };
  if (raw.length === 0) {
    return { ...empty, error: 'MAC address is empty.' };
  }

  // Strip all separators to get the contiguous hex string.
  const hex = raw.replace(/[\s:.-]/g, '').toUpperCase();

  if (!/^[0-9A-F]+$/.test(hex)) {
    return { ...empty, error: 'MAC address contains invalid hex characters.' };
  }

  // Accept 6 hex digits (OUI only) or 12 hex digits (full MAC-48).
  let octets: MacOctets;
  let isOuiOnly = false;

  if (hex.length === 12) {
    octets = [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      parseInt(hex.slice(6, 8), 16),
      parseInt(hex.slice(8, 10), 16),
      parseInt(hex.slice(10, 12), 16),
    ];
  } else if (hex.length === 6) {
    isOuiOnly = true;
    octets = [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      0,
      0,
      0,
    ];
  } else {
    return {
      ...empty,
      error: 'MAC address must be 12 hex digits (6 octets) or 6 hex digits (OUI only).',
    };
  }

  // Validate the separator structure if separators were present.
  // We allow mixed separators but reject malformed groupings like `AAB:BC:CD:EE:FF`.
  if (raw !== hex) {
    // Re-check: the raw input with separators removed must round-trip.
    // Also ensure no group has more than 2 hex digits (except Cisco 4-digit).
    // The Cisco format `AABB.CCDD.EEFF` is 4-4-4; colon/dash is 2-2-2-2-2-2.
    const hasDots = raw.includes('.');
    if (hasDots) {
      // Cisco-style: exactly 3 groups of 4 hex digits.
      const groups = raw.split('.');
      if (
        groups.length !== 3 ||
        groups.some((g) => !/^[0-9A-Fa-f]{4}$/.test(g))
      ) {
        return {
          ...empty,
          error: 'Dot-separated MAC must be in Cisco format (AABB.CCDD.EEFF).',
        };
      }
    } else {
      // Colon or dash separated: groups of 2 hex digits.
      const sep = raw.includes(':') ? ':' : '-';
      const groups = raw.split(sep);
      const expected = isOuiOnly ? 3 : 6;
      if (
        groups.length !== expected ||
        groups.some((g) => !/^[0-9A-Fa-f]{2}$/.test(g))
      ) {
        return {
          ...empty,
          error: `Separator-separated MAC must have ${expected} groups of 2 hex digits.`,
        };
      }
    }
  }

  const oui = ouiFromOctets(octets);
  const normalized = isOuiOnly ? `${oui.replace(/-/g, ':')}:00:00:00` : formatMac(octets, ':');

  return {
    raw,
    isValid: true,
    error: null,
    octets,
    isOuiOnly,
    oui,
    normalized,
  };
}

/**
 * Extract the canonical OUI prefix `AA-BB-CC` (uppercase, dash-separated)
 * from a 6-octet MAC address.
 */
export function ouiFromOctets(octets: MacOctets): string {
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `${h(octets[0])}-${h(octets[1])}-${h(octets[2])}`;
}

/**
 * Format a 6-octet MAC address with the given separator.
 *
 * - `':'` → `AA:BB:CC:DD:EE:FF`
 * - `'-'` → `AA-BB-CC-DD-EE-FF`
 * - `'.'` → `AABB.CCDD.EEFF` (Cisco format)
 * - `'none'` → `AABBCCDDEEFF`
 */
export function formatMac(octets: MacOctets, sep: MacSeparator): string {
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
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

/**
 * Normalise a 6-octet MAC to the canonical `AA:BB:CC:DD:EE:FF` form.
 */
export function normalizeMac(octets: MacOctets): string {
  return formatMac(octets, ':');
}

/**
 * Whether the MAC is a multicast address (the least-significant bit of the
 * first octet is 1, per IEEE 802.3).
 */
export function isMulticast(octets: MacOctets): boolean {
  return (octets[0] & 0b0000_0001) === 1;
}

/**
 * Whether the MAC is locally administered (the U/L bit — second-least-
 * significant bit of the first octet — is 1, per IEEE 802).
 */
export function isLocallyAdministered(octets: MacOctets): boolean {
  return (octets[0] & 0b0000_0010) === 0b10;
}

/**
 * Whether the MAC is the broadcast address (`FF:FF:FF:FF:FF:FF`).
 */
export function isBroadcast(octets: MacOctets): boolean {
  return octets.every((o) => o === 0xff);
}

/**
 * Look up the vendor / manufacturer name for an OUI prefix.
 *
 * `oui` is the canonical `AA-BB-CC` string (case-insensitive, separators
 * ignored). Returns the vendor name, or `null` if the OUI is not in the
 * database.
 */
export function lookupVendor(oui: string, db: OuiDatabase): string | null {
  const key = oui.replace(/[\s:.-]/g, '').toUpperCase();
  if (key.length !== 6) return null;
  return db[key] ?? null;
}

/**
 * Synchronously resolve a MAC lookup using a pre-loaded OUI database.
 *
 * This is the pure core used by the composable after the database has loaded.
 */
export function resolveMacLookup(parsed: ParsedMac, db: OuiDatabase): MacLookupResult {
  if (!parsed.isValid || !parsed.octets) {
    return {
      raw: parsed.raw,
      isValid: false,
      error: parsed.error,
      octets: null,
      isOuiOnly: false,
      oui: null,
      normalized: null,
      vendor: null,
      isKnown: false,
      isMulticast: false,
      isLocallyAdministered: false,
      isBroadcast: false,
      formatted: () => '',
    };
  }
  const octets = parsed.octets;
  const vendor = lookupVendor(parsed.oui!, db);
  return {
    raw: parsed.raw,
    isValid: true,
    error: null,
    octets,
    isOuiOnly: parsed.isOuiOnly,
    oui: parsed.oui,
    normalized: parsed.normalized,
    vendor,
    isKnown: vendor !== null,
    isMulticast: isMulticast(octets),
    isLocallyAdministered: isLocallyAdministered(octets),
    isBroadcast: isBroadcast(octets),
    formatted: (sep: MacSeparator) => formatMac(octets, sep),
  };
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseMacAddressLookupReturn {
  input: Ref<string>;
  result: Ref<MacLookupResult | null>;
  loading: Ref<boolean>;
  dbLoaded: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useMacAddressLookup(): UseMacAddressLookupReturn {
  const input = ref<string>('');
  const result = ref<MacLookupResult | null>(null);
  const loading = ref<boolean>(false);
  const dbLoaded = ref<boolean>(false);

  // Kick off the OUI database load immediately (async, cached).
  loading.value = true;
  loadOuiDatabase()
    .then(() => {
      dbLoaded.value = true;
      loading.value = false;
      recompute();
    })
    .catch(() => {
      loading.value = false;
    });

  function recompute(): void {
    const text = input.value.trim();
    if (text.length === 0) {
      result.value = null;
      return;
    }
    const parsed = parseMac(input.value);
    if (!parsed.isValid) {
      result.value = {
        raw: parsed.raw,
        isValid: false,
        error: parsed.error,
        octets: null,
        isOuiOnly: false,
        oui: null,
        normalized: null,
        vendor: null,
        isKnown: false,
        isMulticast: false,
        isLocallyAdministered: false,
        isBroadcast: false,
        formatted: () => '',
      };
      return;
    }
    if (!dbLoaded.value || !dbCache) {
      // Database not loaded yet — show partial result without vendor.
      result.value = {
        raw: parsed.raw,
        isValid: true,
        error: null,
        octets: parsed.octets,
        isOuiOnly: parsed.isOuiOnly,
        oui: parsed.oui,
        normalized: parsed.normalized,
        vendor: null,
        isKnown: false,
        isMulticast: isMulticast(parsed.octets!),
        isLocallyAdministered: isLocallyAdministered(parsed.octets!),
        isBroadcast: isBroadcast(parsed.octets!),
        formatted: (sep: MacSeparator) => formatMac(parsed.octets!, sep),
      };
      return;
    }
    result.value = resolveMacLookup(parsed, dbCache);
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mac === 'string') {
        input.value = p.mac;
      } else if (typeof p.address === 'string') {
        input.value = p.address;
      } else if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      }
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      if (r) {
        sendOutput({
          oui: r.oui,
          vendor: r.vendor,
          normalized: r.normalized,
          isMulticast: r.isMulticast,
          isLocallyAdministered: r.isLocallyAdministered,
          isBroadcast: r.isBroadcast,
          isKnown: r.isKnown,
          isOuiOnly: r.isOuiOnly,
          isValid: r.isValid,
          error: r.error,
        });
      } else {
        sendOutput({});
      }
    }
  });

  return { input, result, loading, dbLoaded, isEmbed, embedInput, recompute };
}
