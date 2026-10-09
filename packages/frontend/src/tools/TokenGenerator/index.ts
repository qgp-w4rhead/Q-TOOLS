/**
 * TokenGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'token-generator',
  name: 'Token generator',
  description: 'Generate cryptographically secure random tokens.',
  category: 'crypto',
  icon: 'key-round',
  keywords: ['random', 'token', 'secure', 'password', 'charset'],
  dependencies: [],
};

export {
  useTokenGenerator,
  generateToken,
  generateTokens,
  buildCharset,
  secureRandomInt,
  DEFAULT_CONFIG,
  CHARSET_LOWER,
  CHARSET_UPPER,
  CHARSET_NUMBERS,
  CHARSET_SYMBOLS,
  AMBIGUOUS_CHARS,
  MIN_LENGTH,
  MAX_LENGTH,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useTokenGenerator';
export type {
  TokenGeneratorConfig,
  UseTokenGeneratorReturn,
} from './useTokenGenerator';

const TokenGenerator = defineAsyncComponent(() => import('./TokenGenerator.vue'));

export default TokenGenerator;
