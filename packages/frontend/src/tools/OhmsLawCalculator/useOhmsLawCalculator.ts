/**
 * useOhmsLawCalculator - composable + pure logic for the Ohm's law
 * calculator.
 *
 * Solves for the two unknown electrical quantities given any two of:
 * voltage (V), current (I), resistance (R), power (P). Each input carries
 * an SI prefix (µ, m, base, k, M, G) so values like "5 kΩ" or "20 mA" are
 * first-class.
 *
 * Relations used: V = I·R, P = V·I (and derivations).
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import { formatUnitValue } from '@/composables/useUnitConverter';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type OhmsQuantity = 'v' | 'i' | 'r' | 'p';

export interface OhmsResult {
  v: number | null;
  i: number | null;
  r: number | null;
  p: number | null;
  /** Which two quantities were provided. */
  given: OhmsQuantity[];
}

export interface UseOhmsLawCalculatorReturn {
  /** Raw string inputs for each quantity. */
  inputs: Record<OhmsQuantity, Ref<string>>;
  /** SI prefix multiplier per quantity. */
  prefixes: Record<OhmsQuantity, Ref<number>>;
  /** Solved values in base units (V, A, Ω, W), null when unsolvable. */
  solved: ComputedRef<OhmsResult>;
  /** Formatted solved values with auto-scaled SI prefix + unit symbol. */
  formatted: ComputedRef<Record<OhmsQuantity, string>>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  clear: (q: OhmsQuantity) => void;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export interface SiPrefix {
  id: string;
  label: string;
  factor: number;
}

export const SI_PREFIXES: SiPrefix[] = [
  { id: 'u', label: 'µ', factor: 1e-6 },
  { id: 'm', label: 'm', factor: 1e-3 },
  { id: 'base', label: '', factor: 1 },
  { id: 'k', label: 'k', factor: 1e3 },
  { id: 'M', label: 'M', factor: 1e6 },
  { id: 'G', label: 'G', factor: 1e9 },
];

export const QUANTITY_SYMBOLS: Record<OhmsQuantity, string> = {
  v: 'V',
  i: 'A',
  r: 'Ω',
  p: 'W',
};

export const QUANTITY_LABELS: Record<OhmsQuantity, string> = {
  v: 'Voltage',
  i: 'Current',
  r: 'Resistance',
  p: 'Power',
};

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Solve Ohm's law given up to four quantities (base units, null = unknown).
 * Returns all four values when at least two independent inputs are given,
 * otherwise the known values with nulls for the rest.
 */
export function solveOhmsLaw(
  v: number | null,
  i: number | null,
  r: number | null,
  p: number | null,
): OhmsResult {
  const given: OhmsQuantity[] = [];
  if (v !== null) given.push('v');
  if (i !== null) given.push('i');
  if (r !== null) given.push('r');
  if (p !== null) given.push('p');

  let V = v;
  let I = i;
  let R = r;
  let P = p;

  // Iteratively derive unknowns until stable (handles any pair of inputs).
  for (let pass = 0; pass < 4; pass++) {
    if (V === null && I !== null && R !== null) V = I * R;
    if (V === null && P !== null && I !== null && I !== 0) V = P / I;
    if (V === null && P !== null && R !== null && R > 0 && P >= 0) V = Math.sqrt(P * R);

    if (I === null && V !== null && R !== null && R !== 0) I = V / R;
    if (I === null && P !== null && V !== null && V !== 0) I = P / V;
    if (I === null && P !== null && R !== null && R > 0 && P >= 0) I = Math.sqrt(P / R);

    if (R === null && V !== null && I !== null && I !== 0) R = V / I;
    if (R === null && V !== null && P !== null && P !== 0) R = (V * V) / P;
    if (R === null && P !== null && I !== null && I !== 0) R = P / (I * I);

    if (P === null && V !== null && I !== null) P = V * I;
    if (P === null && I !== null && R !== null) P = I * I * R;
    if (P === null && V !== null && R !== null && R !== 0) P = (V * V) / R;
  }

  return { v: V, i: I, r: R, p: P, given };
}

/**
 * Format a base-unit value with an auto-scaled SI prefix, e.g.
 * 0.02 A → "20 mA", 4700 Ω → "4.7 kΩ".
 */
export function formatSi(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) return '-';
  if (value === 0) return `0 ${unit}`;
  const abs = Math.abs(value);
  const tiers: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, ''],
    [1e-3, 'm'],
    [1e-6, 'µ'],
    [1e-9, 'n'],
  ];
  let scaled = value;
  let prefix = '';
  for (const [factor, sym] of tiers) {
    if (abs >= factor * 0.9999 || factor === 1e-9) {
      scaled = value / factor;
      prefix = sym;
      break;
    }
  }
  return `${formatUnitValue(scaled)} ${prefix}${unit}`;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useOhmsLawCalculator(): UseOhmsLawCalculatorReturn {
  const inputs: Record<OhmsQuantity, Ref<string>> = {
    v: ref(''),
    i: ref(''),
    r: ref(''),
    p: ref(''),
  };
  const prefixes: Record<OhmsQuantity, Ref<number>> = {
    v: ref(1),
    i: ref(1),
    r: ref(1),
    p: ref(1),
  };

  function parse(q: OhmsQuantity): number | null {
    const raw = inputs[q].value.trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n * prefixes[q].value;
  }

  const solved = computed<OhmsResult>(() =>
    solveOhmsLaw(parse('v'), parse('i'), parse('r'), parse('p')),
  );

  const formatted = computed<Record<OhmsQuantity, string>>(() => {
    const s = solved.value;
    return {
      v: formatSi(s.v, QUANTITY_SYMBOLS.v),
      i: formatSi(s.i, QUANTITY_SYMBOLS.i),
      r: formatSi(s.r, QUANTITY_SYMBOLS.r),
      p: formatSi(s.p, QUANTITY_SYMBOLS.p),
    };
  });

  function clear(q: OhmsQuantity): void {
    inputs[q].value = '';
  }

  function reset(): void {
    (Object.keys(inputs) as OhmsQuantity[]).forEach((q) => {
      inputs[q].value = '';
      prefixes[q].value = 1;
    });
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      const map: [string[], OhmsQuantity][] = [
        [['v', 'voltage'], 'v'],
        [['i', 'current'], 'i'],
        [['r', 'resistance'], 'r'],
        [['p', 'power'], 'p'],
      ];
      for (const [keys, q] of map) {
        for (const k of keys) {
          const val = p[k];
          if (typeof val === 'string' || typeof val === 'number') {
            inputs[q].value = String(val);
          }
        }
      }
    },
    output: solved,
    toOutput: () => ({
      v: solved.value.v,
      i: solved.value.i,
      r: solved.value.r,
      p: solved.value.p,
      formatted: formatted.value,
    }),
  });

  return {
    inputs,
    prefixes,
    solved,
    formatted,
    isEmbed,
    embedInput,
    clear,
    reset,
  };
}
