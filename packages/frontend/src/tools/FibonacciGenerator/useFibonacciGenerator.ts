/**
 * useFibonacciGenerator - composable + pure logic for the Fibonacci generator tool.
 *
 * Generates Fibonacci sequence numbers using BigInt for arbitrary-precision
 * arithmetic. Supports configurable count, starting index, and custom
 * starting values (F(0) and F(1)).
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface UseFibonacciGeneratorReturn {
  count: Ref<number>;
  startIndex: Ref<number>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  generate: () => void;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Generate `count` Fibonacci numbers starting from index `startIndex`.
 * Uses BigInt for arbitrary-precision arithmetic.
 * Returns an array of BigInt strings.
 */
export function generateFibonacci(count: number, startIndex: number = 0): string[] {
  const n = Math.max(0, Math.min(count, 10000));
  const start = Math.max(0, Math.floor(startIndex));

  if (n === 0) return [];

  // Compute up to start + n using iterative approach
  const results: string[] = [];
  let a = 0n;
  let b = 1n;

  // Fast-forward to startIndex
  for (let i = 0; i < start; i++) {
    [a, b] = [b, a + b];
  }

  for (let i = 0; i < n; i++) {
    results.push(a.toString());
    [a, b] = [b, a + b];
  }

  return results;
}

/**
 * Compute the Fibonacci number at index `n` using fast doubling.
 * Returns the result as a BigInt string.
 */
export function fibonacciAt(n: number): string {
  if (n < 0 || !Number.isFinite(n)) return '-';
  const idx = Math.floor(n);

  // Fast doubling: F(2k) = F(k) * (2*F(k+1) - F(k)), F(2k+1) = F(k+1)^2 + F(k)^2
  function fib(k: number): [bigint, bigint] {
    if (k === 0) return [0n, 1n];
    const [a, b] = fib(Math.floor(k / 2));
    const c = a * (2n * b - a);
    const d = a * a + b * b;
    if (k % 2 === 0) return [c, d];
    return [d, c + d];
  }

  return fib(idx)[0].toString();
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useFibonacciGenerator(): UseFibonacciGeneratorReturn {
  const count = ref<number>(20);
  const startIndex = ref<number>(0);
  const output = ref<string>('');

  function generate(): void {
    const nums = generateFibonacci(count.value, startIndex.value);
    output.value = nums
      .map((n, i) => `F(${startIndex.value + i}) = ${n}`)
      .join('\n');
  }

  function reset(): void {
    count.value = 20;
    startIndex.value = 0;
    generate();
  }

  watch([count, startIndex], () => {
    generate();
  });

  generate();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.count !== undefined) count.value = Math.max(1, Math.min(10000, Number(p.count) || 20));
      if (p.start !== undefined || p.startIndex !== undefined) {
        startIndex.value = Math.max(0, Number(p.start ?? p.startIndex) || 0);
      }
      if (typeof p.action === 'string' && p.action === 'reset') {
        reset();
      }
    },
    output,
    toOutput: () => ({
      output: output.value,
      count: count.value,
      startIndex: startIndex.value,
    }),
  });

  return {
    count,
    startIndex,
    output,
    isEmbed,
    embedInput,
    generate,
    reset,
  };
}
