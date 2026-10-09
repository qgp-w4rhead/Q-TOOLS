/**
 * useOtpCodeGenerator - composable + pure logic for the OTP code generator
 * tool.
 *
 * Implements TOTP (RFC 6238) and HOTP (RFC 4226) one-time passwords using the
 * Web Crypto API (`crypto.subtle.importKey` + `crypto.subtle.sign` with the
 * `HMAC` algorithm). Supported hash functions: SHA-1 (default, RFC 6238),
 * SHA-256, SHA-512. A pure-JS SHA-1 + HMAC-SHA-1 fallback is provided for
 * environments where SHA-1 is restricted by the Web Crypto policy (rare, but
 * the spec requires the fallback).
 *
 * Secrets are decoded from RFC 4648 base32 (the canonical TOTP secret
 * encoding). The tool also builds an `otpauth://` provisioning URI (RFC 6238
 * §3.4 / Google Authenticator Key URI Format) and renders it as a QR code via
 * the `qrcode` package (initial bundle, statically imported).
 *
 * Pure helpers (`base32Decode`, `base32Encode`, `computeHotp`, `computeTotp`,
 * `buildOtpAuthUri`, `hotpFromHmac`) have no Vue dependency and can be imported
 * standalone for unit testing or reuse. The `useOtpCodeGenerator()` composable
 * wraps them in reactive state, ticks a countdown timer, and wires up the embed
 * PostMessage protocol.
 *
 * No external dependencies beyond `qrcode` (initial bundle).
 */
import { ref, watch, onBeforeUnmount, type Ref } from 'vue';
import QRCode from 'qrcode';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types & constants - no Vue dependency below this point                       */
/* -------------------------------------------------------------------------- */

/** Hash algorithm identifiers supported by the tool. */
export type OtpAlgorithm = 'sha-1' | 'sha-256' | 'sha-512';

export interface OtpAlgorithmInfo {
  id: OtpAlgorithm;
  /** Human-readable label. */
  label: string;
  /** Web Crypto hash name passed to `importKey`/`sign`. */
  webCrypto: string;
  /** Output length in bits. */
  bits: number;
}

export const ALGORITHMS: OtpAlgorithmInfo[] = [
  { id: 'sha-1', label: 'SHA-1', webCrypto: 'SHA-1', bits: 160 },
  { id: 'sha-256', label: 'SHA-256', webCrypto: 'SHA-256', bits: 256 },
  { id: 'sha-512', label: 'SHA-512', webCrypto: 'SHA-512', bits: 512 },
];

export const ALGORITHM_MAP: Record<OtpAlgorithm, OtpAlgorithmInfo> =
  Object.fromEntries(ALGORITHMS.map((a) => [a.id, a])) as Record<
    OtpAlgorithm,
    OtpAlgorithmInfo
  >;

export const DEFAULT_ALGORITHM: OtpAlgorithm = 'sha-1';

/** Allowed digit counts (RFC 4226 default is 6; 8 is the common extension). */
export const DIGIT_OPTIONS = [6, 8] as const;
export type OtpDigits = (typeof DIGIT_OPTIONS)[number];
export const DEFAULT_DIGITS: OtpDigits = 6;

/** Allowed step periods (seconds). RFC 6238 default is 30. */
export const PERIOD_OPTIONS = [15, 30, 60] as const;
export type OtpPeriod = (typeof PERIOD_OPTIONS)[number];
export const DEFAULT_PERIOD: OtpPeriod = 30;

/** RFC 4648 base32 alphabet (no padding). */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/* -------------------------------------------------------------------------- */
/* Base32 (RFC 4648) - tolerant decode, canonical encode                       */
/* -------------------------------------------------------------------------- */

/**
 * Decode an RFC 4648 base32 string into raw bytes.
 *
 * Tolerant of: lowercase, whitespace, hyphens, missing padding. Strict about
 * alphabet characters - invalid characters cause an error. Padding (`=`) is
 * accepted but not required.
 */
export function base32Decode(input: string): Uint8Array {
  const cleaned = input
    .replace(/[\s-]/g, '')
    .replace(/=+$/g, '')
    .toUpperCase();
  if (cleaned.length === 0) return new Uint8Array(0);
  if (!/^[A-Z2-7]*$/.test(cleaned)) {
    throw new Error(
      'Invalid base32 secret - only A–Z and 2–7 are allowed (plus optional spaces, hyphens, and = padding).',
    );
  }
  // Accumulate 5-bit values and drain 8-bit bytes. The accumulator stays
  // small (< 2^12) so plain Number arithmetic is exact (well within the
  // double-precision mantissa).
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]!);
    value = value * 32 + idx;
    bits += 5;
    while (bits >= 8) {
      const byte = Math.floor(value / 2 ** (bits - 8));
      out.push(byte);
      value = value % 2 ** (bits - 8);
      bits -= 8;
    }
  }
  if (bits > 0) {
    // Remaining partial byte: left-pad with zeros to 8 bits.
    out.push((value << (8 - bits)) & 0xff);
  }
  return new Uint8Array(out);
}

/**
 * Encode raw bytes as canonical RFC 4648 base32 (uppercase, with padding).
 */
export function base32Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  // Accumulate bytes and drain 5-bit indices. The accumulator stays small
  // (< 2^13) so plain Number arithmetic is exact.
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = value * 256 + bytes[i]!;
    bits += 8;
    while (bits >= 5) {
      const idx = Math.floor(value / 2 ** (bits - 5)) & 0x1f;
      out += BASE32_ALPHABET[idx]!;
      value = value % 2 ** (bits - 5);
      bits -= 5;
    }
  }
  if (bits > 0) {
    const idx = (value << (5 - bits)) & 0x1f;
    out += BASE32_ALPHABET[idx]!;
  }
  // Pad to the next 8-char boundary.
  while (out.length % 8 !== 0) out += '=';
  return out;
}

/* -------------------------------------------------------------------------- */
/* Pure-JS SHA-1 + HMAC-SHA-1 fallback                                         */
/* -------------------------------------------------------------------------- */

/**
 * Pure-JS SHA-1 implementation (FIPS 180-4). Used only as a fallback when the
 * Web Crypto API rejects SHA-1 (some restricted contexts disallow it). The
 * implementation processes the input in 64-byte blocks and returns a 20-byte
 * ArrayBuffer.
 *
 * This is NOT constant-time and is not intended for general use - only as a
 * fallback for the rare SHA-1-restricted environment.
 */
function pureSha1(data: Uint8Array): ArrayBuffer {
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const len = data.length;
  const bitLen = BigInt(len) * 8n;
  // Padding: append 0x80, then zeros, then 64-bit big-endian length.
  const padLen = 64 - ((len + 1 + 8) % 64 || 64);
  const buf = new Uint8Array(len + 1 + padLen + 8);
  buf.set(data, 0);
  buf[len] = 0x80;
  // Write 64-bit big-endian length in the last 8 bytes.
  const view = new DataView(buf.buffer);
  view.setUint32(buf.length - 4, Number(bitLen & 0xffffffffn), false);
  view.setUint32(buf.length - 8, Number(bitLen >> 32n), false);

  const w = new Int32Array(80);
  for (let i = 0; i < buf.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getInt32(i + j * 4, false);
    }
    for (let j = 16; j < 80; j++) {
      const n = w[j - 3]! ^ w[j - 8]! ^ w[j - 14]! ^ w[j - 16]!;
      w[j] = (n << 1) | (n >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      let f: number, k: number;
      if (j < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[j]!) | 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const out = new ArrayBuffer(20);
  const ov = new DataView(out);
  ov.setUint32(0, h0, false);
  ov.setUint32(4, h1, false);
  ov.setUint32(8, h2, false);
  ov.setUint32(12, h3, false);
  ov.setUint32(16, h4, false);
  return out;
}

/**
 * Pure-JS HMAC-SHA-1 (used only as a fallback when Web Crypto rejects SHA-1).
 * Follows RFC 2104: HMAC(K, m) = H((K ⊕ opad) ‖ H((K ⊕ ipad) ‖ m)).
 */
function pureHmacSha1(key: Uint8Array, msg: Uint8Array): ArrayBuffer {
  const BLOCK = 64;
  let k = key;
  if (k.length > BLOCK) {
    k = new Uint8Array(pureSha1(k));
  }
  const padded = new Uint8Array(BLOCK);
  padded.set(k, 0);
  const ipad = new Uint8Array(BLOCK);
  const opad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    const b = padded[i]!;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  const inner = new Uint8Array(BLOCK + msg.length);
  inner.set(ipad, 0);
  inner.set(msg, BLOCK);
  const innerHash = new Uint8Array(pureSha1(inner));
  const outer = new Uint8Array(BLOCK + innerHash.length);
  outer.set(opad, 0);
  outer.set(innerHash, BLOCK);
  return pureSha1(outer);
}

/* -------------------------------------------------------------------------- */
/* HMAC + HOTP / TOTP                                                          */
/* -------------------------------------------------------------------------- */

/** Copy a Uint8Array into a fresh ArrayBuffer-backed buffer (BufferSource-safe). */
function copyBytes(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(src.byteLength);
  out.set(src);
  return out;
}

/**
 * Compute HMAC of `msg` under `key` using `algorithm`. Uses the Web Crypto API;
 * falls back to the pure-JS SHA-1 implementation if Web Crypto rejects SHA-1
 * (some restricted contexts disallow it).
 */
export async function hmacBytes(
  algorithm: OtpAlgorithm,
  key: Uint8Array,
  msg: Uint8Array,
): Promise<ArrayBuffer> {
  const info = ALGORITHM_MAP[algorithm];
  if (!info) throw new Error(`Unknown OTP algorithm: ${algorithm}`);
  // SHA-1 may be restricted in some environments - try Web Crypto first, fall
  // back to pure JS only for SHA-1. SHA-256/512 are always available in secure
  // contexts.
  if (algorithm === 'sha-1') {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        copyBytes(key),
        { name: 'HMAC', hash: { name: 'SHA-1' } },
        false,
        ['sign'],
      );
      return crypto.subtle.sign('HMAC', cryptoKey, copyBytes(msg));
    } catch {
      return pureHmacSha1(key, msg);
    }
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    copyBytes(key),
    { name: 'HMAC', hash: { name: info.webCrypto } },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, copyBytes(msg));
}

/**
 * Encode a non-negative integer counter as an 8-byte big-endian buffer (the
 * HOTP message per RFC 4226 §5.3).
 */
function counterToBytes(counter: number): Uint8Array {
  if (!Number.isInteger(counter) || counter < 0) {
    throw new Error(`Counter must be a non-negative integer (got ${counter}).`);
  }
  // Counters above 2^53 lose precision in JS numbers; TOTP counters are
  // floor(unixTime / period) which is well under 2^53 for any realistic time.
  const buf = new Uint8Array(8);
  let v = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = v & 0xff;
    v = Math.floor(v / 0x100);
  }
  return buf;
}

/**
 * Dynamic truncation (RFC 4226 §5.3) - extract a 31-bit positive integer from
 * the HMAC output.
 */
export function dynamicTruncate(hmac: ArrayBuffer): number {
  const bytes = new Uint8Array(hmac);
  if (bytes.length < 20) {
    throw new Error('HMAC output too short for dynamic truncation.');
  }
  const offset = bytes[bytes.length - 1]! & 0x0f;
  const b1 = bytes[offset]!;
  const b2 = bytes[offset + 1]!;
  const b3 = bytes[offset + 2]!;
  const b4 = bytes[offset + 3]!;
  // Mask the high bit per RFC 4226 §5.3 (avoid signed/unsigned ambiguity).
  return ((b1 & 0x7f) << 24) | (b2 << 16) | (b3 << 8) | b4;
}

/**
 * HOTP (RFC 4226): compute a `digits`-digit one-time password for the given
 * `counter` from the shared `secret` bytes.
 */
export async function computeHotp(
  secret: Uint8Array,
  counter: number,
  digits: number = DEFAULT_DIGITS,
  algorithm: OtpAlgorithm = DEFAULT_ALGORITHM,
): Promise<string> {
  if (secret.length === 0) throw new Error('Secret is empty.');
  if (digits < 1 || digits > 10) {
    throw new Error(`digits must be between 1 and 10 (got ${digits}).`);
  }
  const msg = counterToBytes(counter);
  const mac = await hmacBytes(algorithm, secret, msg);
  const num = dynamicTruncate(mac);
  const mod = 10 ** digits;
  const code = num % mod;
  return code.toString().padStart(digits, '0');
}

/**
 * TOTP (RFC 6238): compute a `digits`-digit one-time password for the given
 * Unix time (seconds) using a `period`-second step.
 */
export async function computeTotp(
  secret: Uint8Array,
  timeSeconds: number,
  period: number = DEFAULT_PERIOD,
  digits: number = DEFAULT_DIGITS,
  algorithm: OtpAlgorithm = DEFAULT_ALGORITHM,
): Promise<string> {
  if (period <= 0) throw new Error(`period must be positive (got ${period}).`);
  const counter = Math.floor(timeSeconds / period);
  return computeHotp(secret, counter, digits, algorithm);
}

/** Current TOTP counter for a given time + period. */
export function totpCounter(timeSeconds: number, period: number): number {
  return Math.floor(timeSeconds / period);
}

/** Seconds remaining in the current TOTP period. */
export function secondsRemaining(timeSeconds: number, period: number): number {
  return period - (Math.floor(timeSeconds) % period);
}

/* -------------------------------------------------------------------------- */
/* otpauth:// provisioning URI                                                 */
/* -------------------------------------------------------------------------- */

export interface OtpAuthUriInput {
  type: 'totp' | 'hotp';
  /** Account / label (e.g. `user@example.com`). */
  account: string;
  /** Issuer / site name (e.g. `GitHub`). */
  issuer: string;
  /** Base32 secret (raw string, as the user typed it). */
  secret: string;
  digits: number;
  period: number;
  algorithm: OtpAlgorithm;
  /** Required for HOTP - the initial counter. */
  counter?: number;
}

/**
 * Percent-encode a URI component per RFC 3986 §2.1. We use the standard
 * `encodeURIComponent` but also encode `!` `'` `(` `)` `*` which
 * `encodeURIComponent` leaves intact (some authenticator apps are stricter).
 */
function encodeComponent(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Build an `otpauth://` provisioning URI (Google Authenticator Key URI Format).
 *
 * Format: `otpauth://TYPE/ISSUER:ACCOUNT?PARAMS`
 */
export function buildOtpAuthUri(input: OtpAuthUriInput): string {
  const { type, account, issuer, secret, digits, period, algorithm, counter } =
    input;
  const cleanedSecret = secret.replace(/[\s-]/g, '').toUpperCase();
  // Label: `issuer:account` when an issuer is present, else just `account`.
  const label =
    issuer.length > 0
      ? `${encodeComponent(issuer)}:${encodeComponent(account)}`
      : encodeComponent(account);
  const params = new URLSearchParams();
  params.set('secret', cleanedSecret);
  if (issuer.length > 0) params.set('issuer', encodeComponent(issuer));
  params.set('algorithm', algorithm.toUpperCase().replace('-', ''));
  params.set('digits', String(digits));
  if (type === 'totp') {
    params.set('period', String(period));
  } else {
    if (counter === undefined) {
      throw new Error('HOTP URIs require a counter parameter.');
    }
    params.set('counter', String(counter));
  }
  // URLSearchParams encodes spaces as `+`; otpauth URIs use `%20`. Swap.
  const query = params.toString().replace(/\+/g, '%20');
  return `otpauth://${type}/${label}?${query}`;
}

/* -------------------------------------------------------------------------- */
/* QR code generation (qrcode package - initial bundle)                        */
/* -------------------------------------------------------------------------- */

/**
 * Render `text` as a PNG data URL via the `qrcode` package. Returns a
 * `data:image/png;base64,…` string suitable for `<img src>`.
 */
export async function generateQrDataUrl(
  text: string,
  opts?: { margin?: number; size?: number },
): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: opts?.margin ?? 2,
    width: opts?.size ?? 240,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface OtpConfig {
  secret: string;
  account: string;
  issuer: string;
  digits: OtpDigits;
  period: OtpPeriod;
  algorithm: OtpAlgorithm;
}

export const DEFAULT_CONFIG: OtpConfig = {
  secret: '',
  account: '',
  issuer: '',
  digits: DEFAULT_DIGITS,
  period: DEFAULT_PERIOD,
  algorithm: DEFAULT_ALGORITHM,
};

export interface OtpSnapshot {
  /** Current TOTP code (the one to enter now). */
  current: string;
  /** Next TOTP code (the one that will be valid next period). */
  next: string;
  /** Seconds remaining in the current period. */
  remaining: number;
  /** Total period (seconds). */
  period: number;
  /** Progress through the current period, 0..1. */
  progress: number;
  /** Unix time (seconds) the snapshot was computed for. */
  time: number;
}

export interface UseOtpCodeGeneratorReturn {
  secret: Ref<string>;
  account: Ref<string>;
  issuer: Ref<string>;
  digits: Ref<OtpDigits>;
  period: Ref<OtpPeriod>;
  algorithm: Ref<OtpAlgorithm>;
  snapshot: Ref<OtpSnapshot | null>;
  uri: Ref<string>;
  qrDataUrl: Ref<string>;
  error: Ref<string>;
  computing: Ref<boolean>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

export function useOtpCodeGenerator(): UseOtpCodeGeneratorReturn {
  const secret = ref<string>('');
  const account = ref<string>('');
  const issuer = ref<string>('');
  const digits = ref<OtpDigits>(DEFAULT_DIGITS);
  const period = ref<OtpPeriod>(DEFAULT_PERIOD);
  const algorithm = ref<OtpAlgorithm>(DEFAULT_ALGORITHM);

  const snapshot = ref<OtpSnapshot | null>(null);
  const uri = ref<string>('');
  const qrDataUrl = ref<string>('');
  const error = ref<string>('');
  const computing = ref<boolean>(false);

  let runToken = 0;
  let tickTimer: ReturnType<typeof setInterval> | undefined;

  /** Build the otpauth URI from the current config (synchronous). */
  function rebuildUri(): void {
    if (secret.value.trim().length === 0) {
      uri.value = '';
      return;
    }
    try {
      uri.value = buildOtpAuthUri({
        type: 'totp',
        account: account.value,
        issuer: issuer.value,
        secret: secret.value,
        digits: digits.value,
        period: period.value,
        algorithm: algorithm.value,
      });
    } catch (e) {
      uri.value = '';
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  /** Recompute the current + next TOTP codes for the given time. */
  async function run(timeSeconds: number): Promise<void> {
    const rawSecret = secret.value;
    if (rawSecret.trim().length === 0) {
      snapshot.value = null;
      qrDataUrl.value = '';
      error.value = '';
      computing.value = false;
      return;
    }
    const token = ++runToken;
    computing.value = true;
    error.value = '';
    try {
      const keyBytes = base32Decode(rawSecret);
      if (keyBytes.length === 0) {
        if (token === runToken) {
          snapshot.value = null;
          error.value = 'Secret is empty.';
        }
        return;
      }
      const [current, next] = await Promise.all([
        computeTotp(
          keyBytes,
          timeSeconds,
          period.value,
          digits.value,
          algorithm.value,
        ),
        computeTotp(
          keyBytes,
          timeSeconds + period.value,
          period.value,
          digits.value,
          algorithm.value,
        ),
      ]);
      if (token !== runToken) return;
      const remaining = secondsRemaining(timeSeconds, period.value);
      snapshot.value = {
        current,
        next,
        remaining,
        period: period.value,
        progress: 1 - remaining / period.value,
        time: Math.floor(timeSeconds),
      };
    } catch (e) {
      if (token === runToken) {
        snapshot.value = null;
        error.value = e instanceof Error ? e.message : String(e);
      }
    } finally {
      if (token === runToken) computing.value = false;
    }
  }

  /** Refresh the QR code from the current URI (async, fire-and-forget). */
  async function refreshQr(): Promise<void> {
    if (uri.value.length === 0) {
      qrDataUrl.value = '';
      return;
    }
    try {
      const url = await generateQrDataUrl(uri.value, { size: 240, margin: 2 });
      qrDataUrl.value = url;
    } catch {
      // QR generation failure is non-fatal - leave the previous QR in place.
    }
  }

  function recompute(): void {
    void run(Math.floor(Date.now() / 1000));
  }

  // Recompute the URI synchronously whenever URI inputs change.
  watch(
    [secret, account, issuer, digits, period, algorithm],
    () => {
      rebuildUri();
      void refreshQr();
    },
    { immediate: true },
  );

  // Recompute codes when secret/digits/period/algorithm change.
  watch([secret, digits, period, algorithm], () => {
    void run(Math.floor(Date.now() / 1000));
  });

  // Tick the countdown + recompute codes at each period boundary.
  function startTick(): void {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      // Update remaining/progress every second without recomputing the HMAC.
      if (snapshot.value) {
        const remaining = secondsRemaining(now, period.value);
        // When a period boundary is crossed, recompute the codes (current +
        // next rotate). Otherwise just update the countdown.
        if (remaining === period.value) {
          void run(now);
        } else {
          snapshot.value = {
            ...snapshot.value,
            remaining,
            progress: 1 - remaining / period.value,
            time: now,
          };
        }
      } else if (secret.value.trim().length > 0) {
        void run(now);
      }
    }, 1000);
  }

  startTick();
  onBeforeUnmount(() => {
    if (tickTimer) clearInterval(tickTimer);
  });

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.secret === 'string') secret.value = p.secret;
      if (typeof p.account === 'string') account.value = p.account;
      if (typeof p.issuer === 'string') issuer.value = p.issuer;
      if (typeof p.digits === 'number' && (DIGIT_OPTIONS as readonly number[]).includes(p.digits)) {
        digits.value = p.digits as OtpDigits;
      }
      if (typeof p.period === 'number' && (PERIOD_OPTIONS as readonly number[]).includes(p.period)) {
        period.value = p.period as OtpPeriod;
      }
      if (
        typeof p.algorithm === 'string' &&
        p.algorithm in ALGORITHM_MAP
      ) {
        algorithm.value = p.algorithm as OtpAlgorithm;
      }
    },
  });

  // Relay output to the parent whenever the snapshot changes (embed mode only).
  watch(snapshot, (s) => {
    if (isEmbed.value) {
      sendOutput(
        s
          ? {
              current: s.current,
              next: s.next,
              remaining: s.remaining,
              period: s.period,
              uri: uri.value,
            }
          : { current: '', next: '', remaining: 0, period: period.value, uri: uri.value },
      );
    }
  });

  return {
    secret,
    account,
    issuer,
    digits,
    period,
    algorithm,
    snapshot,
    uri,
    qrDataUrl,
    error,
    computing,
    isEmbed,
    input,
    recompute,
  };
}
