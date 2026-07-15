/**
 * usePhoneParserFormatter — composable + pure logic for the phone parser and
 * formatter tool.
 *
 * Parses an arbitrary phone number string into a structured result using the
 * lazy-loaded `libphonenumber-js` package. The library lands in its own Vite
 * chunk (~140 KB) and is cached after first use.
 *
 * Pure helpers (`loadLibphonenumber`, `parsePhone`, `formatTypeLabel`,
 * `coerceCountry`, `buildResult`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `usePhoneParserFormatter()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * Dependencies: `libphonenumber-js` (lazy-loaded, listed in tech-stack.md).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import type { CountryCode } from 'libphonenumber-js';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

/** A supported default country (ISO-3166 alpha-2) or `null` for auto-detect. */
export type DefaultCountry = string | null;

/** The four canonical output formats. */
export type PhoneFormat = 'NATIONAL' | 'INTERNATIONAL' | 'E.164' | 'RFC3966';

/** Human-friendly label for a `PhoneNumberType`. */
export type PhoneTypeLabel =
  | 'Mobile'
  | 'Fixed line'
  | 'Fixed line or mobile'
  | 'VoIP'
  | 'Toll free'
  | 'Premium rate'
  | 'Shared cost'
  | 'Personal number'
  | 'Pager'
  | 'UAN'
  | 'Voicemail'
  | 'Unknown';

/** A single formatted-output row. */
export interface FormattedPhone {
  /** Format key (matches `libphonenumber-js` `NumberFormat`). */
  format: PhoneFormat;
  /** Human label for the format. */
  label: string;
  /** The formatted string (empty when parsing failed). */
  value: string;
}

/** Full structured parse result. */
export interface PhoneParseResult {
  /** Whether the input parsed without throwing. */
  parsed: boolean;
  /** Whether the parsed number is a valid phone number (`isValid()`). */
  valid: boolean;
  /** Whether the parsed number is a possible phone number (`isPossible()`). */
  possible: boolean;
  /** ISO-3166 alpha-2 country code (e.g. `US`, `GB`), or `null` when none. */
  country: string | null;
  /** Country calling code (e.g. `1`, `44`), or `null` when none. */
  countryCallingCode: string | null;
  /** National (significant) number, or `null` when none. */
  nationalNumber: string | null;
  /** Phone type label (human-friendly), or `null` when unknown. */
  type: PhoneTypeLabel | null;
  /** Raw `PhoneNumberType` from the library, or `null` when none. */
  typeRaw: string | null;
  /** Extension, or `null` when none. */
  extension: string | null;
  /** `true` when the number belongs to a non-geographic entity (e.g. 800). */
  isNonGeographic: boolean;
  /** The four formatted outputs (national/international/E.164/RFC3966). */
  formats: FormattedPhone[];
  /** Error message when parsing failed, or `null` on success. */
  error: string | null;
  /** The original input echoed back. */
  input: string;
}

/* -------------------------------------------------------------------------- */
/* Lazy-loaded `libphonenumber-js` module cache                                */
/* -------------------------------------------------------------------------- */

type LibphonenumberModule = typeof import('libphonenumber-js');

let libPromise: Promise<LibphonenumberModule> | null = null;

/**
 * Lazily import the `libphonenumber-js` module. The import is cached so
 * repeated calls share a single promise (and a single Vite chunk download,
 * ~140 KB).
 */
export function loadLibphonenumber(): Promise<LibphonenumberModule> {
  if (!libPromise) {
    libPromise = import('libphonenumber-js');
  }
  return libPromise;
}

/**
 * Reset the cached `libphonenumber-js` promise. Exposed for unit tests so
 * each test can simulate a fresh load.
 */
export function resetLibphonenumberCache(): void {
  libPromise = null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Curated list of common default-country options for the `<select>`. */
export interface CountryOption {
  /** ISO-3166 alpha-2 code. */
  code: string;
  /** Display label (country name + calling code). */
  label: string;
}

/**
 * A curated subset of frequently-used countries. The full ISO-3166 list is
 * huge; this keeps the dropdown compact while covering the most common cases.
 * Users can still type any valid 2-letter code in embed mode.
 */
export const COUNTRY_OPTIONS: readonly CountryOption[] = [
  { code: 'US', label: 'United States (+1)' },
  { code: 'CA', label: 'Canada (+1)' },
  { code: 'GB', label: 'United Kingdom (+44)' },
  { code: 'IE', label: 'Ireland (+353)' },
  { code: 'FR', label: 'France (+33)' },
  { code: 'DE', label: 'Germany (+49)' },
  { code: 'ES', label: 'Spain (+34)' },
  { code: 'IT', label: 'Italy (+39)' },
  { code: 'PT', label: 'Portugal (+351)' },
  { code: 'NL', label: 'Netherlands (+31)' },
  { code: 'BE', label: 'Belgium (+32)' },
  { code: 'CH', label: 'Switzerland (+41)' },
  { code: 'AT', label: 'Austria (+43)' },
  { code: 'SE', label: 'Sweden (+46)' },
  { code: 'NO', label: 'Norway (+47)' },
  { code: 'DK', label: 'Denmark (+45)' },
  { code: 'FI', label: 'Finland (+358)' },
  { code: 'PL', label: 'Poland (+48)' },
  { code: 'RU', label: 'Russia (+7)' },
  { code: 'UA', label: 'Ukraine (+380)' },
  { code: 'CZ', label: 'Czechia (+420)' },
  { code: 'GR', label: 'Greece (+30)' },
  { code: 'TR', label: 'Türkiye (+90)' },
  { code: 'IN', label: 'India (+91)' },
  { code: 'PK', label: 'Pakistan (+92)' },
  { code: 'BD', label: 'Bangladesh (+880)' },
  { code: 'CN', label: 'China (+86)' },
  { code: 'JP', label: 'Japan (+81)' },
  { code: 'KR', label: 'South Korea (+82)' },
  { code: 'HK', label: 'Hong Kong (+852)' },
  { code: 'TW', label: 'Taiwan (+886)' },
  { code: 'SG', label: 'Singapore (+65)' },
  { code: 'MY', label: 'Malaysia (+60)' },
  { code: 'TH', label: 'Thailand (+66)' },
  { code: 'VN', label: 'Vietnam (+84)' },
  { code: 'ID', label: 'Indonesia (+62)' },
  { code: 'PH', label: 'Philippines (+63)' },
  { code: 'AU', label: 'Australia (+61)' },
  { code: 'NZ', label: 'New Zealand (+64)' },
  { code: 'BR', label: 'Brazil (+55)' },
  { code: 'MX', label: 'Mexico (+52)' },
  { code: 'AR', label: 'Argentina (+54)' },
  { code: 'CL', label: 'Chile (+56)' },
  { code: 'CO', label: 'Colombia (+57)' },
  { code: 'PE', label: 'Peru (+51)' },
  { code: 'VE', label: 'Venezuela (+58)' },
  { code: 'ZA', label: 'South Africa (+27)' },
  { code: 'NG', label: 'Nigeria (+234)' },
  { code: 'KE', label: 'Kenya (+254)' },
  { code: 'EG', label: 'Egypt (+20)' },
  { code: 'SA', label: 'Saudi Arabia (+966)' },
  { code: 'AE', label: 'United Arab Emirates (+971)' },
  { code: 'IL', label: 'Israel (+972)' },
  { code: 'IR', label: 'Iran (+98)' },
  { code: 'IQ', label: 'Iraq (+964)' },
  { code: 'MA', label: 'Morocco (+212)' },
  { code: 'DZ', label: 'Algeria (+213)' },
  { code: 'TN', label: 'Tunisia (+216)' },
  { code: 'GH', label: 'Ghana (+233)' },
  { code: 'ET', label: 'Ethiopia (+251)' },
];

/** Format metadata (key → human label) in display order. */
export const FORMAT_LABELS: Readonly<Record<PhoneFormat, string>> = {
  NATIONAL: 'National',
  INTERNATIONAL: 'International',
  'E.164': 'E.164',
  RFC3966: 'RFC 3966 (tel: URI)',
};

/** Ordered list of format keys for the output grid. */
export const FORMAT_ORDER: readonly PhoneFormat[] = [
  'NATIONAL',
  'INTERNATIONAL',
  'E.164',
  'RFC3966',
];

/* -------------------------------------------------------------------------- */
/* Pure helpers — no Vue dependency                                            */
/* -------------------------------------------------------------------------- */

/**
 * Map a raw `PhoneNumberType` to a human-friendly label.
 */
export function formatTypeLabel(type: string | null | undefined): PhoneTypeLabel {
  switch (type) {
    case 'MOBILE':
      return 'Mobile';
    case 'FIXED_LINE':
      return 'Fixed line';
    case 'FIXED_LINE_OR_MOBILE':
      return 'Fixed line or mobile';
    case 'VOIP':
      return 'VoIP';
    case 'TOLL_FREE':
      return 'Toll free';
    case 'PREMIUM_RATE':
      return 'Premium rate';
    case 'SHARED_COST':
      return 'Shared cost';
    case 'PERSONAL_NUMBER':
      return 'Personal number';
    case 'PAGER':
      return 'Pager';
    case 'UAN':
      return 'UAN';
    case 'VOICEMAIL':
      return 'Voicemail';
    default:
      return 'Unknown';
  }
}

/**
 * Validate and coerce a candidate ISO-3166 alpha-2 country code using the
 * loaded library's `isSupportedCountry`. Returns the uppercased code when
 * supported, otherwise `null`.
 */
export function coerceCountry(
  mod: LibphonenumberModule,
  code: unknown,
): string | null {
  if (typeof code !== 'string') return null;
  const upper = code.trim().toUpperCase();
  if (upper.length !== 2) return null;
  try {
    return mod.isSupportedCountry(upper) ? upper : null;
  } catch {
    return null;
  }
}

/**
 * Build the four formatted outputs from a parsed `PhoneNumber` instance.
 */
function buildFormats(
  phone: import('libphonenumber-js').PhoneNumber,
): FormattedPhone[] {
  return FORMAT_ORDER.map((fmt) => {
    let value = '';
    try {
      if (fmt === 'RFC3966') {
        // `getURI()` returns `tel:...` form (RFC 3966).
        value = phone.getURI();
      } else {
        value = phone.format(fmt);
      }
    } catch {
      value = '';
    }
    return { format: fmt, label: FORMAT_LABELS[fmt], value };
  });
}

/**
 * Parse a phone number string and return a structured result. The
 * `libphonenumber-js` module must already be loaded.
 *
 * When parsing fails (the library throws `ParseError`), the result has
 * `parsed: false`, a human-friendly `error` message, and empty formats. When
 * parsing succeeds, the result is fully populated; `valid`/`possible` reflect
 * the library's `isValid()`/`isPossible()` checks.
 */
export function parsePhone(
  mod: LibphonenumberModule,
  input: string,
  defaultCountry: DefaultCountry,
): PhoneParseResult {
  const trimmed = input == null ? '' : String(input).trim();
  const base: PhoneParseResult = {
    parsed: false,
    valid: false,
    possible: false,
    country: null,
    countryCallingCode: null,
    nationalNumber: null,
    type: null,
    typeRaw: null,
    extension: null,
    isNonGeographic: false,
    formats: FORMAT_ORDER.map((fmt) => ({
      format: fmt,
      label: FORMAT_LABELS[fmt],
      value: '',
    })),
    error: null,
    input: trimmed,
  };

  if (trimmed.length === 0) {
    return { ...base, error: 'Enter a phone number to parse.' };
  }

  const country = coerceCountry(mod, defaultCountry) as CountryCode | undefined;

  let phone: import('libphonenumber-js').PhoneNumber;
  try {
    phone = mod.parsePhoneNumberWithError(trimmed, country);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Invalid phone number.';
    return { ...base, error: msg };
  }

  // `parsePhoneNumberWithError` always returns a PhoneNumber instance when it
  // doesn't throw, but guard defensively.
  if (!phone) {
    return { ...base, error: 'Invalid phone number.' };
  }

  let typeRaw: string | null = null;
  try {
    typeRaw = phone.getType() ?? null;
  } catch {
    typeRaw = null;
  }

  let isNonGeo = false;
  try {
    isNonGeo = phone.isNonGeographic();
  } catch {
    isNonGeo = false;
  }

  let ext: string | null = null;
  try {
    ext = phone.ext ?? null;
  } catch {
    ext = null;
  }

  return {
    parsed: true,
    valid: phone.isValid(),
    possible: phone.isPossible(),
    country: phone.country ?? null,
    countryCallingCode: phone.countryCallingCode ?? null,
    nationalNumber: phone.nationalNumber ?? null,
    type: formatTypeLabel(typeRaw),
    typeRaw,
    extension: ext,
    isNonGeographic: isNonGeo,
    formats: buildFormats(phone),
    error: null,
    input: trimmed,
  };
}

/**
 * Convenience wrapper: load the library (cached) and parse. Returns the
 * structured result. Errors during loading are surfaced via `error`.
 */
export async function buildResult(
  input: string,
  defaultCountry: DefaultCountry,
): Promise<PhoneParseResult> {
  const mod = await loadLibphonenumber();
  return parsePhone(mod, input, defaultCountry);
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 150;

export interface UsePhoneParserFormatterReturn {
  input: Ref<string>;
  defaultCountry: Ref<DefaultCountry>;
  result: Ref<PhoneParseResult | null>;
  loading: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  reset: () => void;
}

export function usePhoneParserFormatter(): UsePhoneParserFormatterReturn {
  const input = ref<string>('');
  const defaultCountry = ref<DefaultCountry>(null);
  const result = ref<PhoneParseResult | null>(null);
  const loading = ref<boolean>(false);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  // Guard against out-of-order async completions when inputs change quickly.
  let runToken = 0;

  async function run(): Promise<void> {
    const text = input.value;
    const country = defaultCountry.value;
    if (text.trim().length === 0) {
      result.value = null;
      loading.value = false;
      return;
    }
    const token = ++runToken;
    loading.value = true;
    try {
      const r = await buildResult(text, country);
      if (token !== runToken) return; // stale
      result.value = r;
    } catch (e) {
      if (token !== runToken) return;
      result.value = {
        parsed: false,
        valid: false,
        possible: false,
        country: null,
        countryCallingCode: null,
        nationalNumber: null,
        type: null,
        typeRaw: null,
        extension: null,
        isNonGeographic: false,
        formats: FORMAT_ORDER.map((fmt) => ({
          format: fmt,
          label: FORMAT_LABELS[fmt],
          value: '',
        })),
        error: e instanceof Error ? e.message : 'Failed to load phone library.',
        input: text.trim(),
      };
    } finally {
      if (token === runToken) loading.value = false;
    }
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    void run();
  }

  function reset(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    input.value = '';
    defaultCountry.value = null;
    result.value = null;
    loading.value = false;
  }

  watch(input, scheduleRun);
  watch(defaultCountry, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.phone === 'string') input.value = p.phone;
      else if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
      else if (typeof p.content === 'string') input.value = p.content;
      else if (typeof p.text === 'string') input.value = p.text;
      if (p.defaultCountry !== undefined) {
        defaultCountry.value =
          typeof p.defaultCountry === 'string'
            ? (p.defaultCountry.toUpperCase() as string)
            : null;
      } else if (p.country !== undefined) {
        defaultCountry.value =
          typeof p.country === 'string'
            ? (p.country.toUpperCase() as string)
            : null;
      }
      const action = typeof p.action === 'string' ? p.action : null;
      if (action === 'reset' || action === 'clear') reset();
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      sendOutput(r ? { ...r, defaultCountry: defaultCountry.value } : {});
    }
  });

  return {
    input,
    defaultCountry,
    result,
    loading,
    isEmbed,
    embedInput,
    recompute,
    reset,
  };
}
