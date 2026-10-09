/**
 * PdfSignature tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'pdf-signature-checker',
  name: 'PDF signature checker',
  description: 'Check digital signatures in PDF files.',
  category: 'crypto',
  icon: 'file-check',
  keywords: ['pdf', 'signature', 'pkcs7', 'certificate'],
  dependencies: ['pdfjs-dist', 'node-forge'],
};

export {
  usePdfSignature,
  parsePdfSignatures,
  parsePkcs7Metadata,
  extractSignatures,
  extractCoveredData,
  parsePdfDate,
  bytesToLatin1,
  hexToBytes,
  verifyWithBackend,
  ensureForgeModule,
  MAX_PDF_SIZE,
} from './usePdfSignature';
export type {
  RawSignature,
  CertificateInfo,
  SignatureInfo,
  SignatureVerification,
  VerifyResponse,
  UsePdfSignatureReturn,
} from './usePdfSignature';

const PdfSignature = defineAsyncComponent(() => import('./PdfSignature.vue'));

export default PdfSignature;
