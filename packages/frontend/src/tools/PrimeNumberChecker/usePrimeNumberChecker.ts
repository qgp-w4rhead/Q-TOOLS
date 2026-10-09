/**
 * usePrimeNumberChecker - composable + pure logic for the prime number checker tool.
 *
 * Three modes:
 *   - **check**    - check if a single number is prime
 *   - **range**    - find all primes in a range [from, to]
 *   - **factorize** - compute the prime factorization of a number
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type PrimeMode = 'check' | 'range' | 'factorize';

export interface UsePrimeNumberCheckerReturn {
  mode: Ref<PrimeMode>;
  inputValue: Ref<string>;
  rangeFrom: Ref<string>;
  rangeTo: Ref<string>;
  factorInput: Ref<string>;
  result: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Check if a number is prime using trial division up to √n.
 * Handles edge cases: n < 2 → false, n === 2 → true, even numbers → false.
 */
export function isPrime(n: number): boolean {
  if (!Number.isFinite(n) || n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  if (!Number.isSafeInteger(n)) return false;
  const limit = Math.floor(Math.sqrt(n));
  for (let i = 3; i <= limit; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * Compute the prime factorization of a number.
 * Returns an array of [prime, exponent] pairs.
 * Returns `null` if the number is not a safe integer or < 2.
 */
export function primeFactorization(n: number): [number, number][] | null {
  if (!Number.isSafeInteger(n) || n < 2) return null;
  const factors: [number, number][] = [];
  let remaining = n;

  for (let d = 2; d * d <= remaining; d++) {
    if (remaining % d !== 0) continue;
    let exp = 0;
    while (remaining % d === 0) {
      remaining = Math.floor(remaining / d);
      exp++;
    }
    factors.push([d, exp]);
  }
  if (remaining > 1) {
    factors.push([remaining, 1]);
  }
  return factors;
}

/**
 * Find all primes in the range [from, to] using a sieve.
 * Returns an array of prime numbers.
 */
export function primesInRange(from: number, to: number): number[] {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return [];
  const lo = Math.max(2, Math.min(from, to));
  const hi = Math.max(from, to);
  if (hi < 2 || lo > hi) return [];

  // Sieve of Eratosthenes
  const size = hi + 1;
  const sieve = new Uint8Array(size);
  sieve.fill(1);
  sieve[0] = 0;
  sieve[1] = 0;

  for (let i = 2; i * i <= hi; i++) {
    if (sieve[i]) {
      for (let j = i * i; j <= hi; j += i) {
        sieve[j] = 0;
      }
    }
  }

  const primes: number[] = [];
  for (let i = lo; i <= hi; i++) {
    if (sieve[i]) primes.push(i);
  }
  return primes;
}

/** Format factorization as a readable string. */
export function formatFactorization(factors: [number, number][] | null): string {
  if (factors === null) return 'Enter an integer ≥ 2.';
  if (factors.length === 0) return '-';
  return factors
    .map(([p, e]) => (e === 1 ? `${p}` : `${p}^${e}`))
    .join(' × ');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function usePrimeNumberChecker(): UsePrimeNumberCheckerReturn {
  const mode = ref<PrimeMode>('check');
  const inputValue = ref<string>('17');
  const rangeFrom = ref<string>('1');
  const rangeTo = ref<string>('100');
  const factorInput = ref<string>('360');
  const result = ref<string>('');

  function recompute(): void {
    if (mode.value === 'check') {
      const n = Number(inputValue.value);
      if (!Number.isFinite(n) || !Number.isSafeInteger(n)) {
        result.value = 'Enter a valid integer.';
        return;
      }
      result.value = isPrime(n)
        ? `${n} is a prime number.`
        : `${n} is not a prime number.`;
    } else if (mode.value === 'range') {
      const from = Number(rangeFrom.value);
      const to = Number(rangeTo.value);
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        result.value = 'Enter valid integers for the range.';
        return;
      }
      const primes = primesInRange(Math.trunc(from), Math.trunc(to));
      result.value = primes.length === 0
        ? 'No primes in the given range.'
        : `Found ${primes.length} prime${primes.length === 1 ? '' : 's'}:\n${primes.join(', ')}`;
    } else {
      const n = Number(factorInput.value);
      if (!Number.isFinite(n) || !Number.isSafeInteger(n)) {
        result.value = 'Enter a valid integer ≥ 2.';
        return;
      }
      const factors = primeFactorization(Math.trunc(n));
      result.value = formatFactorization(factors);
    }
  }

  function reset(): void {
    mode.value = 'check';
    inputValue.value = '17';
    rangeFrom.value = '1';
    rangeTo.value = '100';
    factorInput.value = '360';
    recompute();
  }

  watch([mode, inputValue, rangeFrom, rangeTo, factorInput], () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.mode === 'check' || p.mode === 'range' || p.mode === 'factorize') {
        mode.value = p.mode as PrimeMode;
      }
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        inputValue.value = String(p.value);
        factorInput.value = String(p.value);
      }
      if (typeof p.from === 'string' || typeof p.from === 'number') {
        rangeFrom.value = String(p.from);
      }
      if (typeof p.to === 'string' || typeof p.to === 'number') {
        rangeTo.value = String(p.to);
      }
    },
    output: result,
    toOutput: () => ({ result: result.value, mode: mode.value }),
  });

  return {
    mode,
    inputValue,
    rangeFrom,
    rangeTo,
    factorInput,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
