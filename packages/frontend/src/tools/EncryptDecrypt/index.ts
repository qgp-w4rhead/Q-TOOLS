/**
 * EncryptDecrypt tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'encrypt-decrypt-text',
  name: 'Encrypt / decrypt text',
  description: 'Symmetric AES-GCM encryption and decryption.',
  category: 'crypto',
  icon: 'lock-keyhole',
  keywords: ['aes', 'gcm', 'encrypt', 'decrypt', 'pbkdf2'],
  dependencies: [],
};

export {
  useEncryptDecrypt,
  generateSalt,
  generateIv,
  deriveKey,
  encryptText,
  decryptText,
  toBase64,
  fromBase64,
  encodeUtf8,
  decodeUtf8,
  IV_LENGTH,
  KEY_LENGTH,
  KEY_LENGTH_BITS,
  PBKDF2_HASH,
  DEFAULT_ITERATIONS,
  MIN_ITERATIONS,
  MAX_ITERATIONS,
  DEFAULT_SALT_LENGTH,
  SALT_LENGTH_OPTIONS,
  MAX_SALT_LENGTH,
} from './useEncryptDecrypt';
export type {
  EncryptMode,
  EncryptTextOptions,
  DecryptTextOptions,
  UseEncryptDecryptReturn,
} from './useEncryptDecrypt';

const EncryptDecrypt = defineAsyncComponent(() => import('./EncryptDecrypt.vue'));

export default EncryptDecrypt;
