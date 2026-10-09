/**
 * OhmsLawCalculator tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Solve any two of voltage, current, resistance, and power via V = I·R and
 * P = V·I, with SI prefix selectors (µ/m/k/M/G) per quantity.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'ohms-law-calculator',
    name: "Ohm's law calculator",
    description: 'Solve any two of voltage, current, resistance, and power (V = I·R, P = V·I).',
    category: 'measurement',
    icon: 'circuit-board',
    keywords: ['ohm', 'law', 'voltage', 'current', 'resistance', 'power', 'volt', 'amp', 'watt', 'electrical'],
    dependencies: [],
  },
  () => import('./OhmsLawCalculator.vue'),
);

export { metadata };

export {
  useOhmsLawCalculator,
  solveOhmsLaw,
  formatSi,
  SI_PREFIXES,
  QUANTITY_SYMBOLS,
  QUANTITY_LABELS,
} from './useOhmsLawCalculator';
export type {
  OhmsQuantity,
  OhmsResult,
  SiPrefix,
  UseOhmsLawCalculatorReturn,
} from './useOhmsLawCalculator';

export default component;
