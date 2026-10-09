/**
 * PrimeNumberChecker tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Check if a number is prime, find all primes in a range, and compute
 * the prime factorization of a number.
 *
 * No external dependencies - pure arithmetic only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'prime-number-checker',
    name: 'Prime number checker',
    description: 'Check primality, find primes in a range, and compute prime factorization.',
    category: 'math',
    icon: 'hash',
    keywords: ['prime', 'number', 'primality', 'factor', 'factorization', 'sieve', 'range'],
    dependencies: [],
  },
  () => import('./PrimeNumberChecker.vue'),
);

export { metadata };

export {
  usePrimeNumberChecker,
  isPrime,
  primeFactorization,
  primesInRange,
} from './usePrimeNumberChecker';
export type {
  PrimeMode,
  UsePrimeNumberCheckerReturn,
} from './usePrimeNumberChecker';

export default component;
