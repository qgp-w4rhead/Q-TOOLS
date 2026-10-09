/**
 * FlowRateConverter tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Convert between volumetric flow rate units: L/s, L/min, L/h, mL/s, m³/s,
 * m³/h, gpm (US/UK), cfm, and ft³/s.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'flow-rate-converter',
    name: 'Flow rate converter',
    description: 'Convert between volumetric flow rate units (L/s, L/min, m³/h, gpm US/UK, cfm, ft³/s).',
    category: 'measurement',
    icon: 'waves',
    keywords: ['flow rate', 'litre per second', 'litre per minute', 'gpm', 'gallons per minute', 'cfm', 'cubic feet per minute', 'm3/h'],
    dependencies: [],
  },
  () => import('./FlowRateConverter.vue'),
);

export { metadata };

export {
  useFlowRateConverter,
  FLOW_RATE_UNITS,
  convertFlowRate,
  formatFlowRate,
} from './useFlowRateConverter';
export type { UseFlowRateConverterReturn } from './useFlowRateConverter';

export default component;
