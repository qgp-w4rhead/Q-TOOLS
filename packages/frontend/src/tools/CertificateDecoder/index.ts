/**
 * CertificateDecoder tool module - exports the lazy-loaded component plus
 * its metadata and composable.
 *
 * Paste PEM certificate → parsed issuer, subject, validity, SAN, key usage,
 * serial.
 *
 * Lazy-loads node-forge for ASN.1 parsing.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'certificate-decoder',
    name: 'Certificate Decoder',
    description: 'Paste PEM certificate to parse issuer, subject, validity, SAN, key usage, and serial.',
    category: 'security',
    icon: 'file-check',
    keywords: ['certificate', 'x509', 'pem', 'ssl', 'tls', 'decoder', 'parser', 'asn1'],
    dependencies: ['node-forge'],
  },
  () => import('./CertificateDecoder.vue'),
);

export { metadata };

export {
  useCertificateDecoder,
  decodeCertificate,
} from './useCertificateDecoder';
export type {
  CertificateInfo,
  UseCertificateDecoderReturn,
} from './useCertificateDecoder';

export default component;
