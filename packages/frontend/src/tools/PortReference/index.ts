/**
 * PortReference tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in the
 * registry and routed dynamically.
 *
 * No external dependencies - the curated IANA port subset is bundled in
 * `ports.ts` inside the tool chunk.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'port-reference',
  name: 'Well-known ports reference',
  description:
    'Searchable port → service table (0-65535, TCP/UDP, curated IANA assignments).',
  category: 'network',
  icon: 'list',
  keywords: ['port', 'ports', 'iana', 'tcp', 'udp', 'service', 'well-known'],
  dependencies: [],
};

export {
  usePortReference,
  searchPorts,
  filterByProtocol,
  formatPort,
} from './usePortReference';
export type {
  ProtocolFilter,
  PortSearchResult,
  UsePortReferenceReturn,
} from './usePortReference';
export { PORTS, portCategory } from './ports';
export type { PortEntry } from './ports';

const PortReference = defineAsyncComponent(
  () => import('./PortReference.vue'),
);

export default PortReference;
