/**
 * RandomPortGenerator tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'random-port-generator',
  name: 'Random port generator',
  description: 'Generate cryptographically secure random network ports.',
  category: 'dev',
  icon: 'plug',
  keywords: ['port', 'random', 'network', 'tcp', 'udp', 'socket'],
  dependencies: [],
};

export {
  useRandomPortGenerator,
  secureRandomIntInRange,
  generatePort,
  generatePorts,
  validateConfig,
  clamp,
  DEFAULT_CONFIG,
  PORT_MIN,
  PORT_MAX,
  WELL_KNOWN_BOUNDARY,
  DEFAULT_MIN,
  DEFAULT_MAX,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './useRandomPortGenerator';
export type {
  RandomPortConfig,
  ConfigValidation,
  ConfigErrorCode,
  UseRandomPortGeneratorReturn,
} from './useRandomPortGenerator';

const RandomPortGenerator = defineAsyncComponent(
  () => import('./RandomPortGenerator.vue'),
);

export default RandomPortGenerator;
