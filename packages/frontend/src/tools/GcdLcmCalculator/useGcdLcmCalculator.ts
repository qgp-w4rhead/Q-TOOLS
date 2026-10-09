/**
 * useGcdLcmCalculator - composable + pure logic for the GCD & LCM calculator tool.
 *
 * Computes the Greatest Common Divisor (GCD) and Least Common Multiple (LCM)
 * of two or more integers using the Euclidean algorithm.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface UseGcdLcmCalculatorReturn {
  input: Ref<string>;
  gcdResult: Ref<string>;
  lcmResult: Ref<string>;
  parsedNumbers: Ref<number[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Compute the GCD of two non-negative integers using the Euclidean algorithm.
 * Returns 0 if both inputs are 0.
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.trunc(a));
  b = Math.abs(Math.trunc(b));
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Compute the LCM of two integers.
 * Returns 0 if either input is 0.
 */
export function lcm(a: number, b: number): number {
  const aa = Math.abs(Math.trunc(a));
  const bb = Math.abs(Math.trunc(b));
  if (aa === 0 || bb === 0) return 0;
  return (aa / gcd(aa, bb)) * bb;
}

/**
 * Compute the GCD of an array of integers.
 */
export function gcdAll(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((acc, n) => gcd(acc, n));
}

/**
 * Compute the LCM of an array of integers.
 */
export function lcmAll(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((acc, n) => lcm(acc, n));
}

/**
 * Parse a comma/space/newline separated list of integers.
 * Returns an array of valid integers (ignores non-numeric entries).
 */
export function parseNumbers(input: string): number[] {
  return input
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => Number.isFinite(n) && Number.isSafeInteger(n));
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useGcdLcmCalculator(): UseGcdLcmCalculatorReturn {
  const input = ref<string>('48, 18, 36');
  const gcdResult = ref<string>('');
  const lcmResult = ref<string>('');
  const parsedNumbers = ref<number[]>([]);

  function recompute(): void {
    const nums = parseNumbers(input.value);
    parsedNumbers.value = nums;

    if (nums.length === 0) {
      gcdResult.value = '-';
      lcmResult.value = '-';
      return;
    }
    if (nums.length === 1) {
      const n = nums[0] ?? 0;
      gcdResult.value = String(Math.abs(n));
      lcmResult.value = String(Math.abs(n));
      return;
    }

    const g = gcdAll(nums);
    const l = lcmAll(nums);
    gcdResult.value = g.toString();
    lcmResult.value = l.toString();
  }

  function reset(): void {
    input.value = '48, 18, 36';
    recompute();
  }

  watch(input, () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      } else if (Array.isArray(p.numbers)) {
        input.value = p.numbers.join(', ');
      }
    },
    output: [gcdResult, lcmResult],
    toOutput: () => ({
      gcd: gcdResult.value,
      lcm: lcmResult.value,
      numbers: parsedNumbers.value,
    }),
  });

  return {
    input,
    gcdResult,
    lcmResult,
    parsedNumbers,
    isEmbed,
    embedInput,
    reset,
  };
}
