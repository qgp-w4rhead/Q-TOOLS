/**
 * FileChecksumVerifier tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'file-checksum-verifier',
    name: 'File Checksum Verifier',
    description:
      'Hash a local file (MD5/SHA-1/SHA-256/384/512) and compare against a published checksum.',
    category: 'security',
    icon: 'file-check',
    keywords: [
      'checksum', 'verify', 'hash', 'sha256', 'sha512', 'md5', 'sha1', 'file',
      'integrity', 'download',
    ],
    dependencies: ['hash-wasm'],
  },
  () => import('./FileChecksumVerifier.vue'),
);

export { metadata };

export {
  useFileChecksumVerifier,
  extractHexDigest,
  algorithmFromHexLength,
  bufferToHex,
  hashBytes,
  readFileBytes,
  formatSize,
  CHECKSUM_ALGORITHMS,
  HEX_LENGTH,
  MAX_FILE_SIZE,
} from './useFileChecksumVerifier';
export type {
  ChecksumAlgorithm,
  ChecksumResult,
  Verdict,
  UseFileChecksumVerifierReturn,
} from './useFileChecksumVerifier';

export default component;
