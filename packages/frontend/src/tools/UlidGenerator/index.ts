/**
 * UlidGenerator tool module — exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ulid-generator',
  name: 'ULID generator',
  description: 'Generate sortable Universally Unique Lexicographic IDs.',
  category: 'crypto',
  icon: 'hash',
  keywords: ['ulid', 'sortable', 'id'],
  dependencies: ['ulid'],
};

export {
  useUlidGenerator,
  createSecurePrng,
  generateUlid,
  generateUlids,
  decodeUlidTime,
  isValidUlid,
  ensureUlidModule,
  MIN_QUANTITY,
  MAX_QUANTITY,
  DEFAULT_QUANTITY,
  ULID_LENGTH,
  ULID_TIME_LENGTH,
  ULID_RANDOM_LENGTH,
  ULID_RE,
} from './useUlidGenerator';
export type {
  UlidMode,
  GenerateUlidOptions,
  UlidResult,
  UseUlidGeneratorReturn,
} from './useUlidGenerator';

const UlidGenerator = defineAsyncComponent(() => import('./UlidGenerator.vue'));

export default UlidGenerator;
