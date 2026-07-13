/**
 * useJwtParser — composable + pure logic for the JWT parser tool.
 *
 * Decodes a JSON Web Token (JWS compact form: `header.payload.signature`) into
 * its three base64url-encoded parts, parses the header and payload as JSON, and
 * renders the signature as a hex string. Standard registered claims (`exp`,
 * `iat`, `nbf`) are surfaced as human-readable dates, and the token's temporal
 * validity is colour-coded (valid / expired / not-yet-valid).
 *
 * Pure helpers (`base64UrlDecode`, `decodeJwtPart`, `parseJwt`, `formatDate`,
 * `checkValidity`, `bytesToHex`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useJwtParser()` composable wraps
 * them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies — only the native `atob` / `TextDecoder` APIs.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Decode a base64url string (with or without padding) into a `Uint8Array`.
 *
 * JWT parts use the base64url alphabet (`-` and `_` instead of `+` and `/`) and
 * typically omit padding. We restore the standard alphabet and pad to a
 * multiple of 4 before handing the result to `atob`.
 */
export function base64UrlDecode(input: string): Uint8Array {
  if (input.length === 0) return new Uint8Array(0);
  // Convert base64url → base64 alphabet.
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  // Restore missing padding.
  const pad = s.length % 4;
  if (pad !== 0) {
    s += '='.repeat(4 - pad);
  }
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/** Convert a `Uint8Array` to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0;
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Decode a single base64url JWT part into a UTF-8 string.
 *
 * Throws a `JwtParseError` if the part is not valid base64url.
 */
export function decodeJwtPart(part: string): string {
  let bytes: Uint8Array;
  try {
    bytes = base64UrlDecode(part);
  } catch (err) {
    throw new JwtParseError(
      `Invalid base64url segment: ${(err as Error).message}`,
      'segment',
    );
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/** Stage tag for `JwtParseError` — where in the parse pipeline it failed. */
export type JwtParseStage = 'structure' | 'segment' | 'json';

/** Error thrown by the JWT parser. Carries a stage tag for UI surfacing. */
export class JwtParseError extends Error {
  readonly stage: JwtParseStage;
  constructor(message: string, stage: JwtParseStage) {
    super(message);
    this.name = 'JwtParseError';
    this.stage = stage;
  }
}

/** Decoded header or payload part — JSON value plus the raw decoded text. */
export interface JwtPart {
  /** Raw decoded UTF-8 text of the segment (before JSON.parse). */
  raw: string;
  /** Parsed JSON value (object/array/scalar) or `null` if parsing failed. */
  json: unknown;
  /** Pretty-printed JSON (2-space indent) for display. */
  pretty: string;
  /** JSON.parse error message if the segment is not valid JSON, else null. */
  error: string | null;
}

/** Temporal validity status of a token, derived from `exp` / `nbf` claims. */
export type JwtValidityStatus =
  | 'valid'
  | 'expired'
  | 'not-yet-valid'
  | 'unknown';

export interface JwtValidity {
  status: JwtValidityStatus;
  /** Human-readable explanation, e.g. "Expired 3 days ago". */
  message: string;
  /** Seconds until expiry (negative when expired). `null` when unknown. */
  secondsRemaining: number | null;
}

/** Full result of `parseJwt`. */
export interface ParsedJwt {
  /** Original token string. */
  raw: string;
  /** Decoded header part. */
  header: JwtPart;
  /** Decoded payload part. */
  payload: JwtPart;
  /** Signature as a lowercase hex string. */
  signatureHex: string;
  /** Signature bytes length (0 for the "none" alg). */
  signatureLength: number;
  /** Algorithm declared in the header (`alg` claim). */
  algorithm: string | null;
  /** Token type declared in the header (`typ` claim). */
  type: string | null;
  /** Key ID declared in the header (`kid` claim), if present. */
  keyId: string | null;
  /** Temporal validity derived from `exp` / `nbf` claims. */
  validity: JwtValidity;
  /** Human-readable formatted dates for the standard timestamp claims. */
  dates: {
    exp: string | null;
    iat: string | null;
    nbf: string | null;
  };
}

/**
 * Parse a JWT compact serialization string into its decoded components.
 *
 * Accepts leading/trailing whitespace (trimmed). Returns `null` for an empty
 * input. Throws `JwtParseError` (stage `structure`) when the token does not
 * have exactly three `.`-separated parts.
 */
export function parseJwt(token: string): ParsedJwt | null {
  const trimmed = token.trim();
  if (trimmed.length === 0) return null;

  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new JwtParseError(
      `Expected 3 segments separated by ".", got ${parts.length}.`,
      'structure',
    );
  }
  const [headerPart, payloadPart, signaturePart] = parts as [
    string,
    string,
    string,
  ];

  const header = decodePart(headerPart);
  const payload = decodePart(payloadPart);

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlDecode(signaturePart);
  } catch (err) {
    throw new JwtParseError(
      `Invalid signature segment: ${(err as Error).message}`,
      'segment',
    );
  }
  const signatureHex = bytesToHex(signatureBytes);

  const headerObj = isRecord(header.json) ? header.json : {};
  const payloadObj = isRecord(payload.json) ? payload.json : {};

  const algorithm =
    typeof headerObj.alg === 'string' ? headerObj.alg : null;
  const type = typeof headerObj.typ === 'string' ? headerObj.typ : null;
  const keyId = typeof headerObj.kid === 'string' ? headerObj.kid : null;

  const expSec = numericClaim(payloadObj.exp);
  const iatSec = numericClaim(payloadObj.iat);
  const nbfSec = numericClaim(payloadObj.nbf);

  const dates: ParsedJwt['dates'] = {
    exp: expSec === null ? null : formatDate(expSec),
    iat: iatSec === null ? null : formatDate(iatSec),
    nbf: nbfSec === null ? null : formatDate(nbfSec),
  };

  const validity = checkValidity(expSec, nbfSec);

  return {
    raw: trimmed,
    header,
    payload,
    signatureHex,
    signatureLength: signatureBytes.length,
    algorithm,
    type,
    keyId,
    validity,
    dates,
  };
}

/** Decode a base64url segment into a `JwtPart` (raw text + parsed JSON). */
function decodePart(part: string): JwtPart {
  const raw = decodeJwtPart(part);
  let json: unknown = null;
  let pretty = '';
  let error: string | null = null;
  if (raw.length === 0) {
    error = 'Empty segment';
  } else {
    try {
      json = JSON.parse(raw);
      pretty = JSON.stringify(json, null, 2);
    } catch (err) {
      error = (err as Error).message;
    }
  }
  return { raw, json, pretty, error };
}

/** Type guard for a plain record (non-array object). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract a numeric claim value. JWT numeric dates may be numbers or numeric
 * strings (per RFC 7519 §2). Returns `null` when absent or non-numeric.
 */
function numericClaim(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Format a JWT numeric date (seconds since epoch) as a human-readable string.
 *
 * Returns both the local time and the UTC time, plus the relative offset, e.g.
 * `2024-01-15 12:30:00 local (2024-01-15 17:30 UTC) — in 3 days`.
 */
export function formatDate(seconds: number): string {
  const ms = seconds * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  const pad = (n: number): string => n.toString().padStart(2, '0');
  const local = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;

  const utc = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
    date.getUTCSeconds(),
  )}`;

  return `${local} local (${utc} UTC)`;
}

/**
 * Determine the token's temporal validity from its `exp` and `nbf` claims.
 *
 * - `not-yet-valid` when `nbf` is in the future.
 * - `expired` when `exp` is in the past.
 * - `valid` when both claims (if present) are satisfied.
 * - `unknown` when neither `exp` nor `nbf` is present.
 *
 * The reference time is `Date.now()`; pass an explicit `nowMs` for testing.
 */
export function checkValidity(
  expSec: number | null,
  nbfSec: number | null,
  nowMs: number = Date.now(),
): JwtValidity {
  const nowSec = nowMs / 1000;

  if (nbfSec !== null && nbfSec > nowSec) {
    const secondsRemaining = nbfSec - nowSec;
    return {
      status: 'not-yet-valid',
      message: `Not valid yet — becomes valid in ${humanizeDuration(
        secondsRemaining,
      )}`,
      secondsRemaining,
    };
  }

  if (expSec !== null) {
    const secondsRemaining = expSec - nowSec;
    if (secondsRemaining <= 0) {
      return {
        status: 'expired',
        message: `Expired ${humanizeDuration(-secondsRemaining)} ago`,
        secondsRemaining,
      };
    }
    return {
      status: 'valid',
      message: `Valid — expires in ${humanizeDuration(secondsRemaining)}`,
      secondsRemaining,
    };
  }

  if (nbfSec !== null) {
    return {
      status: 'valid',
      message: 'Valid (no expiry claim)',
      secondsRemaining: null,
    };
  }

  return {
    status: 'unknown',
    message: 'No expiry or not-before claim',
    secondsRemaining: null,
  };
}

/** Format a duration in seconds as a compact human-readable string. */
function humanizeDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 60) return `${Math.round(abs)}s`;
  if (abs < 3600) return `${Math.round(abs / 60)}m`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h`;
  if (abs < 2592000) return `${Math.round(abs / 86400)}d`;
  if (abs < 31536000) return `${Math.round(abs / 2592000)}mo`;
  return `${(abs / 31536000).toFixed(1)}y`;
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseJwtParserReturn {
  token: Ref<string>;
  result: Ref<ParsedJwt | null>;
  error: Ref<JwtParseError | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useJwtParser(): UseJwtParserReturn {
  const token = ref<string>('');
  const result = ref<ParsedJwt | null>(null);
  const error = ref<JwtParseError | null>(null);

  function recompute(): void {
    const trimmed = token.value.trim();
    if (trimmed.length === 0) {
      result.value = null;
      error.value = null;
      return;
    }
    try {
      result.value = parseJwt(token.value);
      error.value = null;
    } catch (err) {
      result.value = null;
      error.value = err as JwtParseError;
    }
  }

  watch(token, recompute, { immediate: true });

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.token === 'string') token.value = p.token;
    },
  });

  watch([result, error], () => {
    if (isEmbed.value) {
      if (error.value) {
        sendOutput({ error: error.value.message });
      } else if (result.value) {
        const r = result.value;
        sendOutput({
          header: r.header.json,
          payload: r.payload.json,
          signature: r.signatureHex,
          algorithm: r.algorithm,
          validity: r.validity.status,
          exp: r.dates.exp,
          iat: r.dates.iat,
          nbf: r.dates.nbf,
        });
      } else {
        sendOutput({});
      }
    }
  });

  return {
    token,
    result,
    error,
    isEmbed,
    embedInput,
  };
}
