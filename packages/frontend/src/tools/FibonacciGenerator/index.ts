/**
 * FibonacciGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Generate Fibonacci sequence numbers with configurable count and starting
 * point. Uses BigInt for arbitrary-precision arithmetic.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'fibonacci-generator',
    name: 'Fibonacci generator',
    description: 'Generate Fibonacci sequence numbers with arbitrary-precision BigInt arithmetic.',
    category: 'math',
    icon: 'sigma',
    keywords: ['fibonacci', 'sequence', 'series', 'math', 'bigint', 'golden ratio'],
    dependencies: [],
  },
  () => import('./FibonacciGenerator.vue'),
);

export { metadata };

export {
  useFibonacciGenerator,
  generateFibonacci,
  fibonacciAt,
} from './useFibonacciGenerator';
export type {
  UseFibonacciGeneratorReturn,
} from './useFibonacciGenerator';

export default component;
