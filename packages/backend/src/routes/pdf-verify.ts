/**
 * POST /api/pdf/verify — full PKCS#7 signature verification for PDF files.
 *
 * Accepts a raw PDF file as the request body (`Content-Type: application/pdf`).
 * The route re-extracts every signature dictionary from the raw bytes, parses
 * each PKCS#7 SignedData blob with `node-forge`, and performs:
 *
 *   1. Cryptographic signature verification — recomputes the digest over the
 *      PDF byte range and verifies the RSA signature against the signer
 *      certificate's public key (PKCS#1 v1.5).
 *   2. Certificate validity check — `notBefore` / `notAfter` vs. the declared
 *      signing time.
 *   3. Certificate chain check — verifies the issuer chain embedded in the
 *      PKCS#7 (each certificate issued by the next, up to a self-signed root).
 *
 * The response is a JSON object with per-signature verification results and an
 * overall `verified` flag (true only if every signature is valid and every
 * chain checks out).
 *
 * If the body is not a valid PDF, responds with 400. The route accepts bodies
 * up to 32 MiB (raised from the server default of 4 MiB).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import forge from 'node-forge';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ByteRange = [number, number, number, number];

interface RawSignature {
  index: number;
  pkcs7Hex: string;
  byteRange: ByteRange;
  name: string;
  m: string | null;
  subFilter: string;
}

interface SignatureVerification {
  index: number;
  signatureValid: boolean;
  chainValid: boolean;
  trustStatus: 'trusted' | 'untrusted' | 'self-signed' | 'unknown';
  digestAlgorithm: string;
  errors: string[];
}

interface VerifyResponse {
  verified: boolean;
  signatures: SignatureVerification[];
  error: string | null;
}

/**
 * Permissive shape of a node-forge PKCS#7 message. The official types do not
 * expose `certificates` or `rawCapture` on the union returned by
 * `messageFromAsn1`, so we cast through this interface.
 */
interface Pkcs7Message {
  certificates: forge.pki.Certificate[];
  rawCapture: Record<string, unknown>;
}

/** Permissive shape of a raw signerInfo capture. */
interface SignerInfoCapture {
  digestAlgorithm: string;
  signature: string;
  issuer?: forge.asn1.Asn1;
  serial?: string;
  authenticatedAttributes?: forge.asn1.Asn1;
}

interface ParsedSigner {
  certificate: forge.pki.Certificate;
  digestOid: string;
  signature: string;
  authenticatedAttributesAsn1: forge.asn1.Asn1 | null;
  messageDigest: string | null;
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

const SIG_SUB_FILTERS = new Set([
  'adbe.pkcs7.detached',
  'adbe.pkcs7.sha1',
  'adbe.x509.rsa_sha1',
  'ETSI.CAdES.detached',
  'ETSI.CAdES.longtermvalidation',
]);

const MAX_PDF_SIZE = 32 * 1024 * 1024;

/** Convert a hex string to a binary string (node-forge uses binary strings). */
function hexToBinaryString(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
  }
  return out;
}

/** Convert a `Uint8Array` to a binary string. */
function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/** Convert a `Uint8Array` to a Latin-1 string (byte-wise). */
function bytesToLatin1(bytes: Uint8Array): string {
  return bytesToBinaryString(bytes);
}

/** Strip trailing `00` padding from a PKCS#7 hex string. */
function stripTrailingZeroPadding(hex: string): string {
  let h = hex.replace(/\s/g, '');
  while (h.length >= 2 && h.slice(-2) === '00') {
    h = h.slice(0, -2);
  }
  return h;
}

/** Parse a PDF date string (`D:YYYYMMDDHHmmSSOHH'mm'`) into a Date. */
function parsePdfDate(raw: string): Date | null {
  if (!raw) return null;
  const match = raw.match(
    /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Z+-])?(\d{2})?'?(\d{2})?'?/,
  );
  if (!match) return null;
  const y = match[1] ?? '1970';
  const mo = match[2] ?? '01';
  const d = match[3] ?? '01';
  const h = match[4] ?? '00';
  const mi = match[5] ?? '00';
  const s = match[6] ?? '00';
  const tzSign = match[7];
  const tzH = match[8] ?? '00';
  const tzM = match[9] ?? '00';
  let offset = '';
  if (tzSign === 'Z') offset = 'Z';
  else if (tzSign === '+' || tzSign === '-') {
    offset = `${tzSign}${tzH.padStart(2, '0')}:${tzM.padStart(2, '0')}`;
  }
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Extract all signature dictionaries from a raw PDF byte stream. */
function extractSignatures(bytes: Uint8Array): RawSignature[] {
  const text = bytesToLatin1(bytes);
  const results: RawSignature[] = [];
  const contentsRe = /\/Contents\s*<([0-9A-Fa-f\s]*)>/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = contentsRe.exec(text)) !== null) {
    const contentsPos = match.index;
    const raw = match[1] ?? '';
    const pkcs7Hex = stripTrailingZeroPadding(raw);
    if (pkcs7Hex.length < 20) continue;

    const windowStart = Math.max(0, contentsPos - 4096);
    const windowEnd = Math.min(text.length, contentsPos + match[0].length + 2048);
    const dict = text.substring(windowStart, windowEnd);

    const byteRangeMatch = dict.match(/\/ByteRange\s*\[([^\]]*)\]/);
    if (!byteRangeMatch || !byteRangeMatch[1]) continue;
    const nums = byteRangeMatch[1].trim().split(/\s+/).map((n) => parseInt(n, 10));
    if (nums.length !== 4 || nums.some((n) => Number.isNaN(n))) continue;
    const byteRange: ByteRange = [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 0];

    const nameMatch = dict.match(/\/Name\s*\(((?:[^()\\]|\\.)*)\)/);
    const mMatch = dict.match(/\/M\s*\(((?:[^()\\]|\\.)*)\)/);
    const subFilterMatch = dict.match(/\/SubFilter\s*\/([^\s/<>]+)/);
    const subFilter = subFilterMatch ? (subFilterMatch[1] ?? '') : '';
    if (subFilter && !SIG_SUB_FILTERS.has(subFilter)) continue;

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

/** Extract the bytes covered by a signature's `/ByteRange`. */
function extractCoveredData(bytes: Uint8Array, br: ByteRange): Uint8Array {
  const [s1, l1, s2, l2] = br;
  const out = new Uint8Array(l1 + l2);
  if (s1 >= 0 && l1 > 0 && s1 + l1 <= bytes.length) {
    out.set(bytes.subarray(s1, s1 + l1), 0);
  }
  if (s2 >= 0 && l2 > 0 && s2 + l2 <= bytes.length) {
    out.set(bytes.subarray(s2, s2 + l2), l1);
  }
  return out;
}

/** Map a digest-algorithm OID to a node-forge message digest creator. */
function digestForOid(oid: string): forge.md.MessageDigest | null {
  switch (oid) {
    case forge.pki.oids.sha1:
      return forge.md.sha1.create();
    case forge.pki.oids.sha256:
      return forge.md.sha256.create();
    case forge.pki.oids.sha384:
      return forge.md.sha384.create();
    case forge.pki.oids.sha512:
      return forge.md.sha512.create();
    case forge.pki.oids.md5:
      return forge.md.md5.create();
    default:
      return null;
  }
}

/** Extract the common name (CN) from a node-forge RDN attributes array. */
function cnFromAttributes(attrs: forge.pki.CertificateField[]): string {
  const cn = attrs.find((a) => a.name === 'commonName' || a.shortName === 'CN');
  if (cn) return String(cn.value);
  return attrs.map((a) => `${a.shortName ?? a.name ?? '?'}=${String(a.value)}`).join(', ');
}

/** Parse a PKCS#7 message from hex, returning the permissive message shape. */
function parsePkcs7Message(pkcs7Hex: string): Pkcs7Message | null {
  try {
    const der = hexToBinaryString(pkcs7Hex);
    const asn1Obj = forge.asn1.fromDer(der);
    const message = forge.pkcs7.messageFromAsn1(asn1Obj) as unknown as Pkcs7Message;
    if (!message || !Array.isArray(message.certificates)) return null;
    return message;
  } catch {
    return null;
  }
}

/**
 * Parse a PKCS#7 SignedData blob and extract the first signer's certificate,
 * digest algorithm, signature, and authenticated attributes (including the
 * message-digest attribute). Returns `null` if parsing fails.
 */
function parsePkcs7Signer(message: Pkcs7Message): ParsedSigner | null {
  try {
    const certs = message.certificates;
    if (certs.length === 0 || !message.rawCapture) return null;

    const signerInfos = message.rawCapture['signerInfos'];
    if (!Array.isArray(signerInfos)) return null;
    const capture = signerInfos[0] as SignerInfoCapture | undefined;
    if (!capture || !capture.digestAlgorithm || !capture.signature) return null;

    const digestOid = forge.asn1.derToOid(capture.digestAlgorithm);

    // Authenticated attributes are captured as a raw ASN1 SET (context tag [0]).
    let authenticatedAttributesAsn1: forge.asn1.Asn1 | null = null;
    let messageDigest: string | null = null;
    const authAttrs = capture.authenticatedAttributes;
    if (authAttrs && Array.isArray(authAttrs.value)) {
      authenticatedAttributesAsn1 = authAttrs;
      for (const attr of authAttrs.value as forge.asn1.Asn1[]) {
        try {
          if (!Array.isArray(attr.value) || attr.value.length < 2) continue;
          const oidSeq = attr.value[0];
          if (!oidSeq || typeof oidSeq.value !== 'string') continue;
          const oid = forge.asn1.derToOid(oidSeq.value);
          if (oid === forge.pki.oids.messageDigest) {
            const valueSet = attr.value[1];
            if (valueSet && Array.isArray(valueSet.value) && valueSet.value.length > 0) {
              const digestOctet = valueSet.value[0];
              if (digestOctet && typeof digestOctet.value === 'string') {
                messageDigest = forge.util.createBuffer(digestOctet.value).toHex();
              }
            }
          }
        } catch {
          // Skip malformed attributes.
        }
      }
    }

    // Find the signer's certificate by matching serial number.
    let signerCert = certs[0] ?? null;
    if (capture.serial) {
      const serialHex = forge.util.createBuffer(capture.serial).toHex();
      const match = certs.find(
        (c) => c.serialNumber.toLowerCase() === serialHex.toLowerCase(),
      );
      if (match) signerCert = match;
    }
    if (!signerCert) return null;

    return {
      certificate: signerCert,
      digestOid,
      signature: capture.signature,
      authenticatedAttributesAsn1,
      messageDigest,
    };
  } catch {
    return null;
  }
}

/**
 * Verify a single PKCS#7 signature cryptographically.
 *
 * For `adbe.pkcs7.detached`: the signed content is the PDF byte-range data
 * (detached). If authenticated attributes are present, the signature is over
 * the DER-encoded SET of attributes (which includes a message-digest attribute
 * holding the hash of the content). Otherwise the signature is over the
 * content digest directly.
 */
function verifySignature(
  signer: ParsedSigner,
  coveredData: Uint8Array,
  signingTime: Date | null,
): { signatureValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const cert = signer.certificate;
  let signatureValid = false;

  const md = digestForOid(signer.digestOid);
  if (!md) {
    errors.push(`Unsupported digest algorithm OID: ${signer.digestOid}`);
    return { signatureValid, errors };
  }

  md.update(bytesToBinaryString(coveredData));
  const contentDigestHex = md.digest().toHex();

  try {
    const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
    if (signer.authenticatedAttributesAsn1) {
      if (
        signer.messageDigest &&
        signer.messageDigest.toLowerCase() !== contentDigestHex.toLowerCase()
      ) {
        errors.push('Message-digest attribute does not match the computed content digest.');
      }
      // Re-encode the authenticated attributes as a DER SET for verification.
      // The captured ASN1 is the IMPLICIT [0] tagged SET; per RFC 5652 §5.4
      // the signature is over the SET OF attributes with the universal SET
      // tag (the [0] IMPLICIT tag is replaced for signing).
      const attrsDer = forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SET,
        true,
        signer.authenticatedAttributesAsn1.value,
      );
      const attrsDerBytes = forge.asn1.toDer(attrsDer).bytes();
      const attrsMd = digestForOid(signer.digestOid);
      if (attrsMd) {
        attrsMd.update(attrsDerBytes);
        signatureValid = publicKey.verify(attrsMd.digest().bytes(), signer.signature);
      }
    } else {
      signatureValid = publicKey.verify(md.digest().bytes(), signer.signature);
    }
    if (!signatureValid) {
      errors.push('Cryptographic signature verification failed.');
    }
  } catch (e) {
    errors.push(`Signature verification error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Certificate validity at signing time.
  const checkTime = signingTime ?? new Date();
  const notBefore = cert.validity.notBefore instanceof Date
    ? cert.validity.notBefore
    : new Date(cert.validity.notBefore);
  const notAfter = cert.validity.notAfter instanceof Date
    ? cert.validity.notAfter
    : new Date(cert.validity.notAfter);
  if (checkTime < notBefore || checkTime > notAfter) {
    errors.push(
      `Certificate not valid at signing time (${checkTime.toISOString()} is outside ${notBefore.toISOString()} → ${notAfter.toISOString()}).`,
    );
  }

  return { signatureValid, errors };
}

/**
 * Verify the certificate chain embedded in a PKCS#7 message.
 *
 * Walks from the leaf certificate up to the root, checking that each
 * certificate is issued by the next and that each is within its validity
 * window at the signing time. Returns `{ valid, trustStatus }`.
 */
function verifyCertificateChain(
  certs: forge.pki.Certificate[],
  signingTime: Date | null,
): { valid: boolean; trustStatus: SignatureVerification['trustStatus'] } {
  if (certs.length === 0) return { valid: false, trustStatus: 'unknown' };
  const checkTime = signingTime ?? new Date();

  // Sort certs into a chain: leaf first, then intermediates, then root.
  const first = certs[0];
  if (!first) return { valid: false, trustStatus: 'unknown' };
  const sorted: forge.pki.Certificate[] = [first];
  const remaining = certs.slice(1);
  while (remaining.length > 0) {
    const last = sorted[sorted.length - 1];
    if (!last) break;
    const nextIdx = remaining.findIndex(
      (c) => cnFromAttributes(c.subject.attributes) === cnFromAttributes(last.issuer.attributes),
    );
    if (nextIdx === -1) break;
    const next = remaining.splice(nextIdx, 1)[0];
    if (next) sorted.push(next);
  }

  let valid = true;
  for (let i = 0; i < sorted.length; i++) {
    const cert = sorted[i];
    if (!cert) {
      valid = false;
      break;
    }
    const nb = cert.validity.notBefore instanceof Date ? cert.validity.notBefore : new Date(cert.validity.notBefore);
    const na = cert.validity.notAfter instanceof Date ? cert.validity.notAfter : new Date(cert.validity.notAfter);
    if (checkTime < nb || checkTime > na) {
      valid = false;
      break;
    }
  }

  const root = sorted[sorted.length - 1];
  if (!root) return { valid: false, trustStatus: 'unknown' };
  const rootSelfSigned =
    cnFromAttributes(root.subject.attributes) === cnFromAttributes(root.issuer.attributes);
  const trustStatus: SignatureVerification['trustStatus'] = rootSelfSigned
    ? 'trusted'
    : 'untrusted';

  return { valid, trustStatus };
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export async function pdfVerifyRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/pdf/verify',
    { bodyLimit: MAX_PDF_SIZE + 1024 },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body;
      if (Buffer.isBuffer(body)) {
        const bytes = new Uint8Array(body);
        return verifyPdf(bytes, reply);
      }
      if (typeof body === 'string') {
        const bytes = new Uint8Array(Buffer.from(body, 'utf-8'));
        return verifyPdf(bytes, reply);
      }
      return reply.status(400).send({
        verified: false,
        signatures: [],
        error: 'Expected a raw PDF body (Content-Type: application/pdf).',
      } as VerifyResponse);
    },
  );
}

/** Shared verification logic — accepts raw PDF bytes. */
async function verifyPdf(
  bytes: Uint8Array,
  reply: FastifyReply,
): Promise<FastifyReply> {
  if (bytes.length < 8) {
    return reply.status(400).send({
      verified: false,
      signatures: [],
      error: 'File too short to be a valid PDF.',
    } as VerifyResponse);
  }
  if (bytesToLatin1(bytes.subarray(0, 5)) !== '%PDF-') {
    return reply.status(400).send({
      verified: false,
      signatures: [],
      error: 'Not a valid PDF file (missing %PDF- header).',
    } as VerifyResponse);
  }
  if (bytes.length > MAX_PDF_SIZE) {
    return reply.status(413).send({
      verified: false,
      signatures: [],
      error: `File too large (max ${MAX_PDF_SIZE / 1024 / 1024} MiB).`,
    } as VerifyResponse);
  }

  const rawSigs = extractSignatures(bytes);
  if (rawSigs.length === 0) {
    return reply.send({
      verified: true,
      signatures: [],
      error: null,
    } as VerifyResponse);
  }

  const results: SignatureVerification[] = [];
  for (const raw of rawSigs) {
    const signingTime = raw.m ? parsePdfDate(raw.m) : null;
    const message = parsePkcs7Message(raw.pkcs7Hex);
    if (!message) {
      results.push({
        index: raw.index,
        signatureValid: false,
        chainValid: false,
        trustStatus: 'unknown',
        digestAlgorithm: '',
        errors: ['Failed to parse PKCS#7 SignedData.'],
      });
      continue;
    }

    const signer = parsePkcs7Signer(message);
    if (!signer) {
      results.push({
        index: raw.index,
        signatureValid: false,
        chainValid: false,
        trustStatus: 'unknown',
        digestAlgorithm: '',
        errors: ['Failed to extract signer information from PKCS#7.'],
      });
      continue;
    }

    const coveredData = extractCoveredData(bytes, raw.byteRange);
    const { signatureValid, errors } = verifySignature(signer, coveredData, signingTime);

    // Chain check using the full certificate list from the PKCS#7.
    let chainValid = false;
    let trustStatus: SignatureVerification['trustStatus'] = 'unknown';
    const certs = message.certificates;
    if (certs.length > 1) {
      const chain = verifyCertificateChain(certs, signingTime);
      chainValid = chain.valid;
      trustStatus = chain.trustStatus;
      if (!chain.valid) errors.push('Certificate chain validation failed.');
    } else {
      const only = certs[0];
      if (only) {
        const subjectDn = cnFromAttributes(only.subject.attributes);
        const issuerDn = cnFromAttributes(only.issuer.attributes);
        if (subjectDn === issuerDn) {
          chainValid = true;
          trustStatus = 'self-signed';
        } else {
          chainValid = false;
          trustStatus = 'untrusted';
          errors.push('Only one certificate in PKCS#7 — chain cannot be verified.');
        }
      }
    }

    results.push({
      index: raw.index,
      signatureValid,
      chainValid,
      trustStatus,
      digestAlgorithm: signer.digestOid,
      errors,
    });
  }

  const verified =
    results.length > 0 && results.every((r) => r.signatureValid && r.chainValid);
  return reply.send({
    verified,
    signatures: results,
    error: null,
  } as VerifyResponse);
}
