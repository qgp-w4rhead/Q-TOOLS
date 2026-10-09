/**
 * useCertificateDecoder - composable + pure logic for parsing PEM-encoded
 * X.509 certificates. Uses lazy-loaded node-forge for full ASN.1 parsing.
 *
 * Extracts: issuer, subject, validity, SAN, key usage, serial number,
 * signature algorithm, public key info.
 */
import { ref, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface CertificateInfo {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  isValid: boolean;
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  publicKeySize: number;
  san: string[];
  keyUsage: string[];
  extKeyUsage: string[];
  version: number;
  fingerprintSha256: string;
  isExpired: boolean;
  isNotYetValid: boolean;
}

export interface UseCertificateDecoderReturn {
  pemInput: Ref<string>;
  result: Ref<{ info: CertificateInfo | null; error: string | null }>;
  isParsing: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  decode: () => Promise<void>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

let forgeModule: typeof import('node-forge') | null = null;

async function ensureForge(): Promise<typeof import('node-forge')> {
  if (!forgeModule) {
    forgeModule = await import('node-forge');
  }
  return forgeModule;
}

export async function decodeCertificate(pem: string): Promise<{ info: CertificateInfo | null; error: string | null }> {
  if (!pem.trim()) {
    return { info: null, error: 'No PEM certificate provided.' };
  }

  try {
    const forge = await ensureForge();
    const cert = forge.pki.certificateFromPem(pem);

    const subject: Record<string, string> = {};
    for (const attr of cert.subject.attributes) {
      const key = attr.shortName ?? attr.name ?? 'unknown';
      subject[key] = String(attr.value ?? '');
    }

    const issuer: Record<string, string> = {};
    for (const attr of cert.issuer.attributes) {
      const key = attr.shortName ?? attr.name ?? 'unknown';
      issuer[key] = String(attr.value ?? '');
    }

    const now = new Date();
    const validFrom = cert.validity.notBefore;
    const validTo = cert.validity.notAfter;
    const isExpired = now > validTo;
    const isNotYetValid = now < validFrom;

    // SAN (Subject Alternative Names)
    const san: string[] = [];
    const sanExt = cert.getExtension('subjectAltName') as { altNames?: Array<{ type: number; value: string }> } | null;
    if (sanExt && sanExt.altNames) {
      for (const alt of sanExt.altNames) {
        if (alt.type === 2) san.push(`DNS: ${alt.value}`);
        else if (alt.type === 6) san.push(`URI: ${alt.value}`);
        else if (alt.type === 7) san.push(`IP: ${alt.value}`);
        else san.push(`Other: ${alt.value}`);
      }
    }

    // Key Usage
    const keyUsage: string[] = [];
    const keyUsageExt = cert.getExtension('keyUsage');
    if (keyUsageExt) {
      const ku = keyUsageExt as { digitalSignature?: boolean; nonRepudiation?: boolean; keyEncipherment?: boolean; dataEncipherment?: boolean; keyAgreement?: boolean; keyCertSign?: boolean; cRLSign?: boolean; encipherOnly?: boolean; decipherOnly?: boolean };
      if (ku.digitalSignature) keyUsage.push('Digital Signature');
      if (ku.nonRepudiation) keyUsage.push('Non Repudiation');
      if (ku.keyEncipherment) keyUsage.push('Key Encipherment');
      if (ku.dataEncipherment) keyUsage.push('Data Encipherment');
      if (ku.keyAgreement) keyUsage.push('Key Agreement');
      if (ku.keyCertSign) keyUsage.push('Key Cert Sign');
      if (ku.cRLSign) keyUsage.push('CRL Sign');
      if (ku.encipherOnly) keyUsage.push('Encipher Only');
      if (ku.decipherOnly) keyUsage.push('Decipher Only');
    }

    // Extended Key Usage
    const extKeyUsage: string[] = [];
    const extKeyUsageExt = cert.getExtension('extKeyUsage');
    if (extKeyUsageExt) {
      const eku = extKeyUsageExt as { serverAuth?: boolean; clientAuth?: boolean; codeSigning?: boolean; emailProtection?: boolean; timeStamping?: boolean };
      if (eku.serverAuth) extKeyUsage.push('Server Auth');
      if (eku.clientAuth) extKeyUsage.push('Client Auth');
      if (eku.codeSigning) extKeyUsage.push('Code Signing');
      if (eku.emailProtection) extKeyUsage.push('Email Protection');
      if (eku.timeStamping) extKeyUsage.push('Time Stamping');
    }

    // Public key info
    const publicKey = cert.publicKey as { n?: { bitLength: () => number }; e?: number };
    let publicKeyAlgorithm = 'Unknown';
    let publicKeySize = 0;
    if (publicKey.n && typeof publicKey.n.bitLength === 'function') {
      publicKeyAlgorithm = 'RSA';
      publicKeySize = publicKey.n.bitLength();
    }

    // Fingerprint
    const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(derBytes);
    const fingerprintSha256 = md.digest().toHex().match(/.{2}/g)?.join(':').toUpperCase() ?? '';

    // Signature algorithm
    let sigAlg = 'Unknown';
    const sigOid = cert.signatureOid;
    if (sigOid) {
      const oidMap: Record<string, string> = {
        '1.2.840.113549.1.1.5': 'SHA1-RSA',
        '1.2.840.113549.1.1.11': 'SHA256-RSA',
        '1.2.840.113549.1.1.12': 'SHA384-RSA',
        '1.2.840.113549.1.1.13': 'SHA512-RSA',
        '1.2.840.10045.4.3.2': 'ECDSA-SHA256',
        '1.2.840.10045.4.3.3': 'ECDSA-SHA384',
        '1.2.840.10045.4.3.4': 'ECDSA-SHA512',
      };
      sigAlg = oidMap[sigOid] ?? sigOid;
    }

    const info: CertificateInfo = {
      subject,
      issuer,
      serialNumber: cert.serialNumber,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      isValid: !isExpired && !isNotYetValid,
      signatureAlgorithm: sigAlg,
      publicKeyAlgorithm,
      publicKeySize,
      san,
      keyUsage,
      extKeyUsage,
      version: cert.version + 1,
      fingerprintSha256,
      isExpired,
      isNotYetValid,
    };

    return { info, error: null };
  } catch (err) {
    return {
      info: null,
      error: err instanceof Error ? err.message : 'Failed to parse certificate. Ensure it is a valid PEM-encoded X.509 certificate.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useCertificateDecoder(): UseCertificateDecoderReturn {
  const pemInput = ref<string>('');
  const result = ref<{ info: CertificateInfo | null; error: string | null }>({ info: null, error: null });
  const isParsing = ref<boolean>(false);

  async function decode(): Promise<void> {
    if (!pemInput.value.trim() || isParsing.value) return;
    isParsing.value = true;
    result.value = await decodeCertificate(pemInput.value);
    isParsing.value = false;
  }

  function reset(): void {
    pemInput.value = '';
    result.value = { info: null, error: null };
    isParsing.value = false;
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: async (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.pem === 'string') {
        pemInput.value = p.pem;
        await decode();
      }
      if (typeof p.input === 'string') {
        pemInput.value = p.input;
        await decode();
      }
    },
    output: result,
    toOutput: () => ({ info: result.value.info, error: result.value.error }),
  });

  return {
    pemInput,
    result,
    isParsing,
    isEmbed,
    embedInput,
    decode,
    reset,
  };
}
