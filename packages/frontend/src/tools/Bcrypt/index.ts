/**
 * Bcrypt tool module — exports the lazy-loaded component plus its metadata
 * and composable so the tool can be registered in the registry and routed
 * dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'bcrypt',
  name: 'Bcrypt',
  description: 'Hash and verify passwords with bcrypt.',
  category: 'crypto',
  icon: 'lock',
  keywords: ['bcrypt', 'password', 'hash', 'verify', 'rounds'],
  dependencies: ['hash-wasm'],
};

export {
  useBcrypt,
  generateSalt,
  hashPassword,
  verifyPassword,
  isValidBcryptHash,
  parseBcryptHash,
  MIN_COST,
  MAX_COST,
  DEFAULT_COST,
  SALT_BYTES,
  ENCODED_HASH_LENGTH,
  BCRYPT_HASH_RE,
} from './useBcrypt';
export type {
  BcryptMode,
  ParsedBcryptHash,
  BcryptHashOutput,
  BcryptVerifyOutput,
  BcryptOutput,
  UseBcryptReturn,
} from './useBcrypt';

const Bcrypt = defineAsyncComponent(() => import('./Bcrypt.vue'));

export default Bcrypt;
