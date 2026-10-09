/**
 * GcdLcmCalculator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Compute the Greatest Common Divisor (GCD) and Least Common Multiple (LCM)
 * of two or more integers using the Euclidean algorithm.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'gcd-lcm-calculator',
    name: 'GCD & LCM calculator',
    description: 'Compute the Greatest Common Divisor and Least Common Multiple of integers.',
    category: 'math',
    icon: 'divide',
    keywords: ['gcd', 'lcm', 'greatest common divisor', 'least common multiple', 'euclidean', 'hcf'],
    dependencies: [],
  },
  () => import('./GcdLcmCalculator.vue'),
);

export { metadata };

export {
  useGcdLcmCalculator,
  gcd,
  lcm,
  gcdAll,
  lcmAll,
} from './useGcdLcmCalculator';
export type {
  UseGcdLcmCalculatorReturn,
} from './useGcdLcmCalculator';

export default component;
