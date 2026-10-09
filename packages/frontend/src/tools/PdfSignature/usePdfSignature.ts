/**
 * usePdfSignature - composable + pure logic for the PDF signature checker tool.
 *
 * Extracts and verifies digital signatures embedded in PDF files.
 *
 * **Client-side** (this module): parses the PDF with `pdfjs-dist` (lazy-loaded)
 * to validate the document and load page metadata, then scans the raw PDF bytes
 * for PKCS#7 signature dictionaries (`/Type /Sig` / `/SubFilter
 * /adbe.pkcs7.detached`). Each signature's PKCS#7 SignedData is parsed with
 * `node-forge` (lazy-loaded) to extract the signer certificate, subject /
 * issuer names, validity window, and serial number - enough to display
 * signature metadata without a backend round-trip.
 *
 * **Server-side** (`/api/pdf/verify`): the raw PDF bytes are POSTed to the
 * backend, which re-extracts the signatures and performs full cryptographic
 * verification (digest recomputation + RSA signature check over the PDF byte
 * range, certificate chain validation, and trust status). If the backend is
 * unreachable, the tool falls back to metadata-only display with a warning.
 *
 * The pure helpers (`bytesToLatin1`, `extractSignatures`, `parsePdfDate`,
 * `hexToBytes`, `extractCoveredData`, `parsePkcs7Metadata`) have no Vue
 * dependency and can be imported standalone. The `usePdfSignature()` composable
 * wraps them in reactive state and wires up the embed PostMessage protocol.
 *
 * Dependencies: `pdfjs-dist` + `node-forge` (both lazy-loaded) - listed in
 * tech-stack.md.
 */
import { ref, shallowRef, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/** A raw signature dictionary extracted from the PDF byte stream. */
export interface RawSignature {
  /** Zero-based index of the signature in the file (display order). */
  index: number;
  /** PKCS#7 SignedData as a hex string (trailing zero padding stripped). */
  pkcs7Hex: string;
  /** Byte range `[start1, end1, start2, end2]` covered by the signature. */
  byteRange: [number, number, number, number];
  /** Signer name from the `/Name` entry (may be empty). */
  name: string;
  /** Raw PDF date string from the `/M` entry (e.g. `D:20240101120000Z`). */
  m: string | null;
  /** Sub-filter (e.g. `adbe.pkcs7.detached`, `adbe.pkcs7.sha1`). */
  subFilter: string;
}

/** Certificate metadata extracted from a PKCS#7 SignedData (client-side). */
export interface CertificateInfo {
  /** Subject common name (CN), or full DN fallback. */
  subject: string;
  /** Issuer common name (CN), or full DN fallback. */
  issuer: string;
  /** Serial number as an uppercase hex string. */
  serialNumber: string;
  /** `notBefore` as an ISO 8601 string. */
  notBefore: string;
  /** `notAfter` as an ISO 8601 string. */
  notAfter: string;
  /** Whether the certificate was valid at the declared signing time. */
  isValidAtSigningTime: boolean;
}

/** A fully parsed signature (metadata only - no cryptographic verification). */
export interface SignatureInfo {
  index: number;
  signerName: string;
  /** Raw PDF date string. */
  signingTimeRaw: string | null;
  /** ISO 8601 signing time, or `null` if unparseable / absent. */
  signingTimeISO: string | null;
  subFilter: string;
  byteRange: [number, number, number, number];
  certificate: CertificateInfo | null;
  /** True if the PKCS#7 could not be parsed (cert info unavailable). */
  parseError: string | null;
}

/** Verification result returned by the backend for a single signature. */
export interface SignatureVerification {
  index: number;
  /** Cryptographic signature check over the PDF byte range. */
  signatureValid: boolean;
  /** Certificate chain validation (issuer chain + validity dates). */
  chainValid: boolean;
  /** Trust status: `trusted` (chain to a known root), `untrusted`,
   *  `self-signed`, or `unknown`. */
  trustStatus: 'trusted' | 'untrusted' | 'self-signed' | 'unknown';
  /** Digest algorithm OID used for the signature. */
  digestAlgorithm: string;
  /** Human-readable errors collected during verification. */
  errors: string[];
}

/** Full backend verification response. */
export interface VerifyResponse {
  verified: boolean;
  signatures: SignatureVerification[];
  /** Backend-side parse error (whole file rejected). */
  error: string | null;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Maximum PDF size accepted (32 MiB - matches the backend route limit). */
export const MAX_PDF_SIZE = 32 * 1024 * 1024;

/** PKCS#7 sub-filters recognised as digital signatures. */
const SIG_SUB_FILTERS = new Set([
  'adbe.pkcs7.detached',
  'adbe.pkcs7.sha1',
  'adbe.x509.rsa_sha1',
  'ETSI.CAdES.detached',
  'ETSI.CAdES.longtermvalidation',
]);

/**
 * Convert a `Uint8Array` to a Latin-1 string. PDF content streams use
 * Latin-1 (byte-wise) encoding for dictionary keys and literal strings, so
 * this preserves every byte as a single char without re-encoding.
 */
export function bytesToLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000; // 32 KiB - avoid String.fromCharCode call-stack limits
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/** Convert a hex string to a `Uint8Array` (whitespace tolerated). */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/** Strip trailing `00` padding from a PKCS#7 hex string. */
function stripTrailingZeroPadding(hex: string): string {
  let h = hex.replace(/\s/g, '');
  // PKCS#7 DER ends on a non-zero byte; the /Contents hex string is padded
  // with zeros to its declared length. Strip pairs of `00` from the end.
  while (h.length >= 2 && h.slice(-2) === '00') {
    h = h.slice(0, -2);
  }
  return h;
}

/**
 * Parse a PDF date string (`D:YYYYMMDDHHmmSSOHH'mm'`) into an ISO 8601 string.
 * Returns `null` if the input is not a valid PDF date.
 */
export function parsePdfDate(raw: string): string | null {
  if (!raw) return null;
  // PDF date: D:YYYYMMDDHHmmSS[OHH'mm'] - prefix `D:` is optional.
  const match = raw.match(
    /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Z+-])?(\d{2})?'?(\d{2})?'?/,
  );
  if (!match) return null;
  const [, y, mo = '01', d = '01', h = '00', mi = '00', s = '00', tzSign, tzH = '00', tzM = '00'] = match;
  let offset = '';
  if (tzSign === 'Z') {
    offset = 'Z';
  } else if (tzSign === '+' || tzSign === '-') {
    offset = `${tzSign}${tzH.padStart(2, '0')}:${tzM.padStart(2, '0')}`;
  } else {
    // No timezone - treat as local (return as-is without offset).
    offset = '';
  }
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Extract all signature dictionaries from a raw PDF byte stream.
 *
 * Scans for `/Contents <hex>` patterns (the PKCS#7 token), then looks
 * backwards within a ~4 KiB window for the enclosing dictionary's `/ByteRange`,
 * `/Name`, `/M`, and `/SubFilter` entries. Only entries whose sub-filter is a
 * recognised digital-signature sub-filter are returned.
 */
export function extractSignatures(bytes: Uint8Array): RawSignature[] {
  const text = bytesToLatin1(bytes);
  const results: RawSignature[] = [];
  // Match /Contents <hexstring> - the hex string may contain whitespace.
  const contentsRe = /\/Contents\s*<([0-9A-Fa-f\s]*)>/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = contentsRe.exec(text)) !== null) {
    const contentsPos = match.index;
    const raw = match[1] ?? '';
    const pkcs7Hex = stripTrailingZeroPadding(raw);
    if (pkcs7Hex.length < 20) continue; // too short to be a real PKCS#7

    // Look backwards for the enclosing dictionary entries.
    const windowStart = Math.max(0, contentsPos - 4096);
    const windowEnd = Math.min(text.length, contentsPos + match[0].length + 2048);
    const dict = text.substring(windowStart, windowEnd);

    const byteRangeMatch = dict.match(/\/ByteRange\s*\[([^\]]*)\]/);
    if (!byteRangeMatch || !byteRangeMatch[1]) continue;
    const nums = byteRangeMatch[1]
      .trim()
      .split(/\s+/)
      .map((n) => parseInt(n, 10));
    if (nums.length !== 4 || nums.some((n) => Number.isNaN(n))) continue;
    const byteRange: [number, number, number, number] = [
      nums[0] ?? 0,
      nums[1] ?? 0,
      nums[2] ?? 0,
      nums[3] ?? 0,
    ];

    const nameMatch = dict.match(/\/Name\s*\(((?:[^()\\]|\\.)*)\)/);
    const mMatch = dict.match(/\/M\s*\(((?:[^()\\]|\\.)*)\)/);
    const subFilterMatch = dict.match(/\/SubFilter\s*\/([^\s/<>]+)/);

    const subFilter = subFilterMatch ? (subFilterMatch[1] ?? '') : '';
    if (subFilter && !SIG_SUB_FILTERS.has(subFilter)) continue;

    // Unescape PDF literal-string escapes (\\, \), \n, \r, \t).
    const unescape = (s: string): string =>
      s.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\(.)/g, '$1');

    results.push({
      index: idx++,
      pkcs7Hex,
      byteRange,
      name: nameMatch && nameMatch[1] ? unescape(nameMatch[1]) : '',
      m: mMatch && mMatch[1] ? unescape(mMatch[1]) : null,
      subFilter,
    });
  }
  return results;
}

/**
 * Extract the bytes covered by a signature's `/ByteRange`. The byte range is
 * `[start1, length1, start2, length2]` - the signed content is the
 * concatenation of bytes `[start1, start1+length1)` and
 * `[start2, start2+length2)`.
 */
export function extractCoveredData(
  bytes: Uint8Array,
  byteRange: [number, number, number, number],
): Uint8Array {
  const [s1, l1, s2, l2] = byteRange;
  const total = l1 + l2;
  const out = new Uint8Array(total);
  if (s1 >= 0 && l1 > 0 && s1 + l1 <= bytes.length) {
    out.set(bytes.subarray(s1, s1 + l1), 0);
  }
  if (s2 >= 0 && l2 > 0 && s2 + l2 <= bytes.length) {
    out.set(bytes.subarray(s2, s2 + l2), l1);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* node-forge PKCS#7 metadata extraction (client-side, lazy-loaded)           */
/* -------------------------------------------------------------------------- */

let cachedForge: typeof import('node-forge') | null = null;

/** Resolve and cache the `node-forge` module (async, lazy-loaded). */
export async function ensureForgeModule(): Promise<typeof import('node-forge')> {
  if (!cachedForge) {
    cachedForge = await import('node-forge');
  }
  return cachedForge;
}

/** Convert a `Uint8Array` to a binary string (each byte → one char). */
function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/** Extract the common name (CN) from a node-forge RDN attributes array. */
function cnFromAttributes(attrs: { name?: string; shortName?: string; value?: unknown }[]): string {
  const cn = attrs.find((a) => a.name === 'commonName' || a.shortName === 'CN');
  if (cn && typeof cn.value === 'string') return cn.value;
  // Fallback: join all attribute values into a full DN string.
  return attrs
    .map((a) => `${a.shortName ?? a.name ?? '?'}=${typeof a.value === 'string' ? a.value : Array.isArray(a.value) ? a.value.join(',') : '?'}`)
    .join(', ');
}

/**
 * Parse a PKCS#7 SignedData blob (hex) and extract signer certificate metadata.
 * Returns `null` if the PKCS#7 cannot be parsed or no signer certificate is
 * found.
 *
 * @param signingTimeISO - used to check certificate validity at signing time.
 */
export async function parsePkcs7Metadata(
  pkcs7Hex: string,
  signingTimeISO: string | null,
): Promise<{ certificate: CertificateInfo; digestOid: string } | null> {
  const forge = await ensureForgeModule();
  try {
    const der = hexToBytes(pkcs7Hex);
    const asn1 = forge.asn1.fromDer(bytesToBinaryString(der));
    const message = forge.pkcs7.messageFromAsn1(asn1) as unknown as {
      certificates?: import('node-forge').pki.Certificate[];
      rawCapture?: Record<string, unknown>;
    };
    const certs = message.certificates ?? [];
    if (certs.length === 0) return null;

    // The signer certificate is typically the first (leaf) certificate.
    const signerCert = certs[0];
    if (!signerCert) return null;
    const subject = cnFromAttributes(signerCert.subject.attributes);
    const issuer = cnFromAttributes(signerCert.issuer.attributes);
    const notBefore = signerCert.validity.notBefore instanceof Date
      ? signerCert.validity.notBefore.toISOString()
      : new Date(signerCert.validity.notBefore).toISOString();
    const notAfter = signerCert.validity.notAfter instanceof Date
      ? signerCert.validity.notAfter.toISOString()
      : new Date(signerCert.validity.notAfter).toISOString();

    let isValidAtSigningTime = true;
    if (signingTimeISO) {
      const t = new Date(signingTimeISO).getTime();
      const nb = new Date(notBefore).getTime();
      const na = new Date(notAfter).getTime();
      isValidAtSigningTime = t >= nb && t <= na;
    }

    // Digest algorithm OID from the first signerInfo (raw capture).
    let digestOid = '';
    const rawCapture = message.rawCapture;
    if (rawCapture && Array.isArray(rawCapture['signerInfos'])) {
      const first = rawCapture['signerInfos'][0] as { digestAlgorithm?: string } | undefined;
      if (first && typeof first.digestAlgorithm === 'string') {
        digestOid = forge.asn1.derToOid(first.digestAlgorithm);
      }
    }

    return {
      certificate: {
        subject,
        issuer,
        serialNumber: signerCert.serialNumber.toUpperCase(),
        notBefore,
        notAfter,
        isValidAtSigningTime,
      },
      digestOid,
    };
  } catch {
    return null;
  }
}

/**
 * Fully parse all signatures in a PDF byte stream into `SignatureInfo[]`.
 * Uses `pdfjs-dist` to validate the document, then extracts PKCS#7 metadata
 * with `node-forge`. Both libraries are lazy-loaded.
 */
export async function parsePdfSignatures(bytes: Uint8Array): Promise<{
  signatures: SignatureInfo[];
  pageCount: number;
  metadata: Record<string, string>;
}> {
  // Lazy-load pdfjs-dist and configure the worker.
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
    } catch {
      // Fall back to fake worker (main-thread) if the worker URL can't resolve.
      pdfjs.GlobalWorkerOptions.workerSrc = '';
    }
  }

  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    disableAutoFetch: true,
  });
  let pageCount = 0;
  let metadata: Record<string, string> = {};
  try {
    const doc = await loadingTask.promise;
    pageCount = doc.numPages;
    try {
      const meta = await doc.getMetadata();
      metadata = { ...(meta.info as Record<string, string>) };
    } catch {
      // Metadata is optional.
    }
    await (doc as unknown as { destroy: () => Promise<void> }).destroy();
  } catch {
    // Even if pdfjs fails to fully load (e.g. encrypted / malformed), we can
    // still scan the raw bytes for signatures. Leave pageCount at 0.
  }

  const raw = extractSignatures(bytes);
  const signatures: SignatureInfo[] = [];
  for (const r of raw) {
    const signingTimeISO = r.m ? parsePdfDate(r.m) : null;
    let certInfo: CertificateInfo | null = null;
    let parseError: string | null = null;
    try {
      const meta = await parsePkcs7Metadata(r.pkcs7Hex, signingTimeISO);
      certInfo = meta?.certificate ?? null;
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }
    signatures.push({
      index: r.index,
      signerName: r.name,
      signingTimeRaw: r.m,
      signingTimeISO,
      subFilter: r.subFilter,
      byteRange: r.byteRange,
      certificate: certInfo,
      parseError,
    });
  }
  return { signatures, pageCount, metadata };
}

/* -------------------------------------------------------------------------- */
/* Backend verification                                                        */
/* -------------------------------------------------------------------------- */

/**
 * POST the raw PDF bytes to `/api/pdf/verify` for full PKCS#7 chain
 * verification. Returns the verification result, or `null` if the backend is
 * unreachable (caller should fall back to metadata-only display).
 */
export async function verifyWithBackend(
  bytes: Uint8Array,
  fileName: string,
): Promise<VerifyResponse | null> {
  try {
    const res = await fetch('/api/pdf/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'X-PDF-Filename': encodeURIComponent(fileName),
      },
      body: bytes as unknown as BodyInit,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      return {
        verified: false,
        signatures: [],
        error: body.error ?? body.message ?? `HTTP ${res.status}`,
      };
    }
    return (await res.json()) as VerifyResponse;
  } catch {
    return null; // backend unreachable
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UsePdfSignatureReturn {
  fileName: Ref<string>;
  fileSize: Ref<number>;
  pageCount: Ref<number>;
  signatures: Ref<SignatureInfo[]>;
  verification: Ref<VerifyResponse | null>;
  backendAvailable: Ref<boolean | null>;
  parsing: Ref<boolean>;
  verifying: Ref<boolean>;
  error: Ref<string>;
  warning: Ref<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  onFile: (file: File) => void;
  onFileBytes: (bytes: Uint8Array, name: string) => void;
  verify: () => void;
  clear: () => void;
}

export function usePdfSignature(): UsePdfSignatureReturn {
  const fileName = ref<string>('');
  const fileSize = ref<number>(0);
  const pageCount = ref<number>(0);
  const signatures = ref<SignatureInfo[]>([]);
  const verification = ref<VerifyResponse | null>(null);
  const backendAvailable = ref<boolean | null>(null);
  const parsing = ref<boolean>(false);
  const verifying = ref<boolean>(false);
  const error = ref<string>('');
  const warning = ref<string>('');

  // Keep the last parsed bytes around for backend verification.
  const lastBytes = shallowRef<Uint8Array | null>(null);

  let parseToken = 0;

  async function parseBytes(bytes: Uint8Array): Promise<void> {
    const token = ++parseToken;
    parsing.value = true;
    error.value = '';
    warning.value = '';
    signatures.value = [];
    verification.value = null;
    backendAvailable.value = null;
    pageCount.value = 0;
    try {
      if (bytes.length > MAX_PDF_SIZE) {
        throw new Error(`File too large (${(bytes.length / 1024 / 1024).toFixed(1)} MiB). Maximum is 32 MiB.`);
      }
      if (bytes.length < 8 || bytesToLatin1(bytes.subarray(0, 5)) !== '%PDF-') {
        throw new Error('Not a valid PDF file (missing %PDF- header).');
      }
      const result = await parsePdfSignatures(bytes);
      if (token !== parseToken) return;
      signatures.value = result.signatures;
      pageCount.value = result.pageCount;
      if (result.signatures.length === 0) {
        warning.value = 'No digital signatures found in this PDF.';
      }
    } catch (e) {
      if (token === parseToken) {
        error.value = e instanceof Error ? e.message : String(e);
      }
    } finally {
      if (token === parseToken) parsing.value = false;
    }
  }

  function onFile(file: File): void {
    fileName.value = file.name;
    fileSize.value = file.size;
    lastBytes.value = null;
    const reader = new FileReader();
    reader.onload = (): void => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      lastBytes.value = bytes;
      void parseBytes(bytes);
    };
    reader.onerror = (): void => {
      error.value = 'Failed to read the file.';
    };
    reader.readAsArrayBuffer(file);
  }

  function onFileBytes(bytes: Uint8Array, name: string): void {
    fileName.value = name;
    fileSize.value = bytes.length;
    lastBytes.value = bytes;
    void parseBytes(bytes);
  }

  async function verify(): Promise<void> {
    const bytes = lastBytes.value;
    if (!bytes || verifying.value) return;
    verifying.value = true;
    error.value = '';
    try {
      const result = await verifyWithBackend(bytes, fileName.value || 'document.pdf');
      if (result === null) {
        backendAvailable.value = false;
        warning.value = 'Backend verification unavailable - showing metadata only.';
      } else {
        backendAvailable.value = !result.error;
        verification.value = result;
        if (result.error) warning.value = result.error;
      }
    } catch (e) {
      backendAvailable.value = false;
      warning.value = e instanceof Error ? e.message : String(e);
    } finally {
      verifying.value = false;
    }
  }

  function clear(): void {
    fileName.value = '';
    fileSize.value = 0;
    pageCount.value = 0;
    signatures.value = [];
    verification.value = null;
    backendAvailable.value = null;
    error.value = '';
    warning.value = '';
    lastBytes.value = null;
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      // Embed mode: parent may send a file URL to fetch + verify.
      const url = p.url;
      if (typeof url === 'string' && url.length > 0) {
        void (async (): Promise<void> => {
          try {
            const res = await fetch(url);
            const buf = new Uint8Array(await res.arrayBuffer());
            onFileBytes(buf, typeof p.fileName === 'string' ? p.fileName : 'document.pdf');
          } catch (e) {
            error.value = `Failed to fetch PDF from URL: ${e instanceof Error ? e.message : String(e)}`;
          }
        })();
      }
      if (p.verify === true) void verify();
      if (p.clear === true) clear();
    },
  });

  // Relay output to the parent whenever signatures or verification change.
  watch(
    [signatures, verification],
    () => {
      if (!isEmbed.value) return;
      sendOutput({
        fileName: fileName.value,
        fileSize: fileSize.value,
        pageCount: pageCount.value,
        signatureCount: signatures.value.length,
        signatures: signatures.value,
        verification: verification.value,
      });
    },
    { deep: true },
  );

  return {
    fileName,
    fileSize,
    pageCount,
    signatures,
    verification,
    backendAvailable,
    parsing,
    verifying,
    error,
    warning,
    isEmbed,
    input,
    onFile,
    onFileBytes,
    verify,
    clear,
  };
}
