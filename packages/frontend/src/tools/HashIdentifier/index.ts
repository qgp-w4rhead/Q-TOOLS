/**
 * HashIdentifier tool module - exports the lazy-loaded component plus its
 * metadata and composable.
 *
 * Paste a hash string → identify likely algorithm (MD5, SHA-1, SHA-256,
 * bcrypt, etc.) by length and format.
 *
 * No external dependencies - pure pattern matching.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'hash-identifier',
    name: 'Hash Identifier',
    description: 'Identify the likely hash algorithm (MD5, SHA-1, SHA-256, bcrypt, etc.) by length and format.',
    category: 'security',
    icon: 'fingerprint',
    keywords: ['hash', 'identify', 'md5', 'sha1', 'sha256', 'sha512', 'bcrypt', 'argon2', 'algorithm'],
    dependencies: [],
  },
  () => import('./HashIdentifier.vue'),
);

export { metadata };

export {
  useHashIdentifier,
  identifyHash,
} from './useHashIdentifier';
export type {
  HashMatch,
  UseHashIdentifierReturn,
} from './useHashIdentifier';

export default component;
