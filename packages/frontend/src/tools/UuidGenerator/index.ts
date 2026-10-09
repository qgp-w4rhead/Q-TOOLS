/**
 * UuidGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'uuid-generator',
  name: 'UUIDs generator',
  description: 'Generate UUID v1, v3, v4, v5.',
  category: 'crypto',
  icon: 'fingerprint',
  keywords: ['uuid', 'guid', 'v1', 'v3', 'v4', 'v5'],
  dependencies: [],
};

export {
  useUuidGenerator,
  md5,
  sha1Bytes,
  bytesToHex,
  uuidToBytes,
  formatUuid,
  isValidUuid,
  generateV1,
  generateV3,
  generateV4,
  generateV5,
  generateUuids,
  MIN_QUANTITY,
  MAX_QUANTITY,
  DEFAULT_QUANTITY,
  NIL_UUID,
  NAMESPACE_DNS,
  NAMESPACE_URL,
  NAMESPACE_OID,
  NAMESPACE_X500,
  NAMESPACE_PRESETS,
  UUID_RE,
} from './useUuidGenerator';
export type {
  UuidVersion,
  NamespacePreset,
  GenerateUuidsOptions,
  UseUuidGeneratorReturn,
} from './useUuidGenerator';

const UuidGenerator = defineAsyncComponent(() => import('./UuidGenerator.vue'));

export default UuidGenerator;
