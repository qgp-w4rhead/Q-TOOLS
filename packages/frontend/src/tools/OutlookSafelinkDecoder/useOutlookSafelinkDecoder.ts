/**
 * useOutlookSafelinkDecoder — composable + pure logic for the Outlook Safelink
 * decoder tool.
 *
 * Microsoft Defender for Office 365 (Safe Links) rewrites every hyperlink in
 * incoming email through a regional scanning host. The wrapped URL keeps the
 * original destination inside a `url` query parameter, percent-encoded (and
 * sometimes double-encoded). This module recovers the original URL and
 * surfaces the safelink metadata (regional host, `data`/`sdata`/`reserved`
 * params, and the recipient email address embedded in the pipe-delimited
 * `data` field when present).
 *
 * Wrapped form:
 *
 *   https://nam04.safelinks.protection.outlook.com/?url=<encoded>&data=…&sdata=…&reserved=0
 *
 * Pure helpers (`isSafelinkUrl`, `decodeSafelink`, `parseSafelinkData`,
 * `extractSafelink`) have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useOutlookSafelinkDecoder()` composable wraps
 * them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies — only the native `URL` / `decodeURIComponent`
 * APIs.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Host suffix that identifies a Microsoft Safelinks redirect URL.
 *
 * The regional prefix (`nam04`, `eur03`, `apc01`, `ind01`, …) varies, but the
 * domain is always `<region>.safelinks.protection.outlook.com`.
 */
const SAFELINK_HOST_SUFFIX = '.safelinks.protection.outlook.com';

/**
 * .NET `DateTime.Ticks` value at the Unix epoch (1970-01-01 UTC). Used to
 * convert .NET ticks (100-ns intervals since 0001-01-01) — the timestamp
 * format used by modern Safelinks `data` fields — into Unix milliseconds.
 */
const DOTNET_EPOCH_TICKS = 621355968000000000;

/** Stage tag for `SafelinkParseError` — where in the pipeline it failed. */
export type SafelinkParseStage = 'not-safelink' | 'no-url-param' | 'decode';

/** Error thrown by the safelink decoder. Carries a stage tag for UI surfacing. */
export class SafelinkParseError extends Error {
  readonly stage: SafelinkParseStage;
  constructor(message: string, stage: SafelinkParseStage) {
    super(message);
    this.name = 'SafelinkParseError';
    this.stage = stage;
  }
}

/** Parsed `data` field — pipe-delimited metadata embedded in the safelink. */
export interface SafelinkData {
  /** Raw `data` query parameter value (already percent-decoded). */
  raw: string;
  /** Pipe-separated fields, in order. Empty array when `data` is absent. */
  fields: string[];
  /**
   * Recipient email address (field index 2 in modern format, index 1 in v1).
   * `null` when not present or unparseable.
   */
  recipient: string | null;
  /**
   * Unix-epoch milliseconds timestamp encoded as a field (modern format only).
   * `null` when not present or unparseable.
   */
  timestamp: number | null;
}

/** Full result of `extractSafelink`. */
export interface ParsedSafelink {
  /** Original input string (trimmed). */
  raw: string;
  /** Parsed safelink `URL` object. */
  url: URL;
  /** Regional host (e.g. `nam04.safelinks.protection.outlook.com`). */
  host: string;
  /** Region prefix (e.g. `nam04`), or empty string if absent. */
  region: string;
  /** Decoded original destination URL. */
  originalUrl: string;
  /** Number of percent-decoding passes applied to recover `originalUrl`. */
  decodePasses: number;
  /** Parsed `data` field metadata, or `null` when the field is absent. */
  data: SafelinkData | null;
  /** Raw `sdata` query parameter value (already percent-decoded), or `null`. */
  sdata: string | null;
  /** Raw `reserved` query parameter value, or `null`. */
  reserved: string | null;
}

/**
 * Detect whether a URL string is a Microsoft Safelinks redirect.
 *
 * Accepts the raw input (with or without a scheme). Returns `false` for empty
 * or unparseable input rather than throwing.
 */
export function isSafelinkUrl(input: string): boolean {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;
  const normalized = ensureScheme(trimmed);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return false;
  }
  return url.hostname.toLowerCase().endsWith(SAFELINK_HOST_SUFFIX);
}

/**
 * Decode the safelink `url` query parameter into the original destination URL.
 *
 * Safelinks percent-encode the destination once, but some clients/forwards
 * double-encode it. We repeatedly `decodeURIComponent` until the result stops
 * changing (max 3 passes) — this recovers the original URL regardless of how
 * many times it was encoded, without over-decoding a legitimately-encoded
 * destination.
 *
 * If a *later* decode pass fails (e.g. the decoded URL legitimately contains
 * a literal `%` character that is not a valid percent-encoding), we stop and
 * return the last successfully-decoded value rather than throwing — that value
 * is the real destination URL. A failure on the *first* pass, however,
 * indicates the `url` parameter itself is malformed and is re-thrown as a
 * `SafelinkParseError`.
 *
 * Returns the decoded URL string and the number of passes applied.
 */
export function decodeSafelink(encodedUrl: string): {
  url: string;
  passes: number;
} {
  let current = encodedUrl;
  let passes = 0;
  // Cap at 3 passes — anything beyond that is almost certainly a legitimately
  // percent-encoded destination that should be left alone.
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch (err) {
      if (i === 0) {
        throw new SafelinkParseError(
          `Malformed percent-encoding in url parameter: ${
            (err as Error).message
          }`,
          'decode',
        );
      }
      // A later pass hit a literal `%` in the decoded URL — stop here; the
      // current value is the real destination.
      break;
    }
    if (next === current) break;
    current = next;
    passes = i + 1;
  }
  return { url: current, passes };
}

/**
 * Parse the safelink `data` query parameter into its pipe-delimited fields.
 *
 * The modern format is:
 *
 *   <ver>|<flag>|<recipient-email>|<hash1>|<hash2>|0|0|<timestamp-ms>|<client>|<base64-blob>|0|||
 *
 * The v1 format is shorter and lacks the timestamp/client fields. We extract
 * the recipient email (field index 2 in modern, 1 in v1) and the timestamp
 * (field index 7 in modern) defensively — any field may be missing or in a
 * different position, so we fall back to `null` rather than throwing.
 *
 * `rawData` should already be percent-decoded (the raw query value).
 */
export function parseSafelinkData(rawData: string): SafelinkData {
  const fields = rawData.length > 0 ? rawData.split('|') : [];

  // Recipient email: look for the first field that looks like an email.
  let recipient: string | null = null;
  for (const field of fields) {
    const decoded = tryDecodeURIComponent(field);
    if (isEmailLike(decoded)) {
      recipient = decoded;
      break;
    }
  }

  // Timestamp: look for the first numeric field that is either a 13-digit
  // Unix millisecond timestamp or an 18-19 digit .NET DateTime ticks value
  // (100-nanosecond intervals since 0001-01-01, used by modern Safelinks).
  let timestamp: number | null = null;
  for (const field of fields) {
    if (/^\d{13}$/.test(field)) {
      const ms = Number(field);
      const d = new Date(ms);
      if (Number.isFinite(d.getTime())) {
        timestamp = ms;
        break;
      }
    } else if (/^\d{18,19}$/.test(field)) {
      // .NET ticks → Unix ms. The constant is the .NET tick value at the
      // Unix epoch (1970-01-01 UTC).
      const ticks = Number(field);
      const ms = Math.floor((ticks - DOTNET_EPOCH_TICKS) / 10000);
      const d = new Date(ms);
      if (Number.isFinite(d.getTime()) && ms > 0 && ms < Date.now() * 2) {
        timestamp = ms;
        break;
      }
    }
  }

  return { raw: rawData, fields, recipient, timestamp };
}

/**
 * Extract the original destination URL and metadata from a safelink URL.
 *
 * Accepts the raw input (with or without a scheme). Throws
 * `SafelinkParseError` (stage `not-safelink`) when the input is not a
 * safelink URL, or (stage `no-url-param`) when the safelink has no `url`
 * query parameter.
 */
export function extractSafelink(input: string): ParsedSafelink {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new SafelinkParseError('Input is empty.', 'not-safelink');
  }

  const normalized = ensureScheme(trimmed);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch (err) {
    throw new SafelinkParseError(
      `Invalid URL: ${(err as Error).message}`,
      'not-safelink',
    );
  }

  if (!url.hostname.toLowerCase().endsWith(SAFELINK_HOST_SUFFIX)) {
    throw new SafelinkParseError(
      `Not a Safelinks URL (host must end with "${SAFELINK_HOST_SUFFIX}").`,
      'not-safelink',
    );
  }

  const encodedUrl = url.searchParams.get('url');
  if (encodedUrl === null) {
    throw new SafelinkParseError(
      'Safelinks URL is missing the required "url" query parameter.',
      'no-url-param',
    );
  }

  const { url: originalUrl, passes } = decodeSafelink(encodedUrl);

  const host = url.hostname.toLowerCase();
  const region = host.slice(0, host.length - SAFELINK_HOST_SUFFIX.length);

  const rawData = url.searchParams.get('data');
  const data = rawData !== null ? parseSafelinkData(rawData) : null;

  const sdataRaw = url.searchParams.get('sdata');
  const sdata = sdataRaw !== null ? tryDecodeURIComponent(sdataRaw) : null;

  const reserved = url.searchParams.get('reserved');

  return {
    raw: trimmed,
    url,
    host,
    region,
    originalUrl,
    decodePasses: passes,
    data,
    sdata,
    reserved,
  };
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Ensure a URL string has a scheme. Bare hosts like
 * `nam04.safelinks.protection.outlook.com/?url=…` are prefixed with `https://`
 * so the `URL` constructor can parse them.
 */
function ensureScheme(input: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) return input;
  return `https://${input}`;
}

/** `decodeURIComponent` that never throws — returns the input on failure. */
function tryDecodeURIComponent(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

/** Loose email-shape check for the `data` field recipient extraction. */
function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseOutlookSafelinkDecoderReturn {
  input: Ref<string>;
  result: Ref<ParsedSafelink | null>;
  error: Ref<SafelinkParseError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useOutlookSafelinkDecoder(): UseOutlookSafelinkDecoderReturn {
  const input = ref<string>('');
  const result = ref<ParsedSafelink | null>(null);
  const error = ref<SafelinkParseError | null>(null);

  function recompute(): void {
    const trimmed = input.value.trim();
    if (trimmed.length === 0) {
      result.value = null;
      error.value = null;
      return;
    }
    try {
      result.value = extractSafelink(input.value);
      error.value = null;
    } catch (err) {
      result.value = null;
      error.value = err as SafelinkParseError;
    }
  }

  watch(input, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.url === 'string') input.value = p.url;
      else if (typeof p.safelink === 'string') input.value = p.safelink;
    },
  });

  watch([result, error], () => {
    if (!isEmbed.value) return;
    if (error.value) {
      sendOutput({ error: error.value.message, stage: error.value.stage });
    } else if (result.value) {
      const r = result.value;
      sendOutput({
        originalUrl: r.originalUrl,
        host: r.host,
        region: r.region,
        decodePasses: r.decodePasses,
        recipient: r.data?.recipient ?? null,
        timestamp: r.data?.timestamp ?? null,
        sdata: r.sdata,
        reserved: r.reserved,
      });
    } else {
      sendOutput({});
    }
  });

  return {
    input,
    result,
    error,
    isEmbed,
    embedInput,
  };
}
