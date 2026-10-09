/**
 * useBreakEvenCalculator - composable + pure logic for break-even analysis.
 *
 * Inputs: fixed costs, variable cost per unit, price per unit.
 * Outputs: break-even point in units, break-even revenue, contribution margin,
 * contribution margin ratio.
 *
 * Formulas:
 *   BE units = fixedCosts / (pricePerUnit - variableCostPerUnit)
 *   BE revenue = BE units * pricePerUnit
 *   Contribution margin = pricePerUnit - variableCostPerUnit
 *   CM ratio = CM / pricePerUnit
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface BreakEvenResult {
  ok: boolean;
  message?: string;
  fixedCosts: number;
  variableCostPerUnit: number;
  pricePerUnit: number;
  contributionMargin: number;
  contributionMarginRatio: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export function parseNumber(input: unknown): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function calculateBreakEven(
  fixedCosts: number,
  variableCostPerUnit: number,
  pricePerUnit: number,
): BreakEvenResult {
  if (!Number.isFinite(fixedCosts) || fixedCosts < 0) {
    return { ok: false, message: 'Enter valid fixed costs.', fixedCosts: NaN, variableCostPerUnit, pricePerUnit, contributionMargin: NaN, contributionMarginRatio: NaN, breakEvenUnits: NaN, breakEvenRevenue: NaN };
  }
  if (!Number.isFinite(variableCostPerUnit) || variableCostPerUnit < 0) {
    return { ok: false, message: 'Enter a valid variable cost per unit.', fixedCosts, variableCostPerUnit: NaN, pricePerUnit, contributionMargin: NaN, contributionMarginRatio: NaN, breakEvenUnits: NaN, breakEvenRevenue: NaN };
  }
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    return { ok: false, message: 'Enter a valid price per unit (> 0).', fixedCosts, variableCostPerUnit, pricePerUnit: NaN, contributionMargin: NaN, contributionMarginRatio: NaN, breakEvenUnits: NaN, breakEvenRevenue: NaN };
  }

  const contributionMargin = round2(pricePerUnit - variableCostPerUnit);

  if (contributionMargin <= 0) {
    return {
      ok: false,
      message: 'Price per unit must exceed variable cost per unit.',
      fixedCosts,
      variableCostPerUnit,
      pricePerUnit,
      contributionMargin,
      contributionMarginRatio: NaN,
      breakEvenUnits: NaN,
      breakEvenRevenue: NaN,
    };
  }

  const breakEvenUnits = Math.ceil(fixedCosts / contributionMargin);
  const breakEvenRevenue = round2(breakEvenUnits * pricePerUnit);
  const contributionMarginRatio = round4(contributionMargin / pricePerUnit);

  return {
    ok: true,
    fixedCosts,
    variableCostPerUnit,
    pricePerUnit,
    contributionMargin,
    contributionMarginRatio,
    breakEvenUnits,
    breakEvenRevenue,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function formatCurrency(n: number, symbol = '$'): string {
  if (!Number.isFinite(n)) return '-';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return `${(n * 100).toFixed(2)}%`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseBreakEvenCalculatorReturn {
  fixedCosts: Ref<string>;
  variableCostPerUnit: Ref<string>;
  pricePerUnit: Ref<string>;
  snapshot: Ref<BreakEvenResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useBreakEvenCalculator(): UseBreakEvenCalculatorReturn {
  const fixedCosts = ref<string>('');
  const variableCostPerUnit = ref<string>('');
  const pricePerUnit = ref<string>('');
  const snapshot = ref<BreakEvenResult | null>(null);

  function recompute(): void {
    const fc = parseNumber(fixedCosts.value);
    const vc = parseNumber(variableCostPerUnit.value);
    const pp = parseNumber(pricePerUnit.value);
    if (fc === null || vc === null || pp === null) {
      snapshot.value = null;
      return;
    }
    snapshot.value = calculateBreakEven(fc, vc, pp);
  }

  function reset(): void {
    fixedCosts.value = '';
    variableCostPerUnit.value = '';
    pricePerUnit.value = '';
    snapshot.value = null;
  }

  watch([fixedCosts, variableCostPerUnit, pricePerUnit], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.fixed === 'string' || typeof p.fixed === 'number') {
        fixedCosts.value = String(p.fixed);
      }
      if (typeof p.variable === 'string' || typeof p.variable === 'number') {
        variableCostPerUnit.value = String(p.variable);
      }
      if (typeof p.price === 'string' || typeof p.price === 'number') {
        pricePerUnit.value = String(p.price);
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        fixedCosts.value = String(p.input);
      }
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        pricePerUnit.value = String(p.value);
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return {
    fixedCosts,
    variableCostPerUnit,
    pricePerUnit,
    snapshot,
    isEmbed,
    embedInput,
    reset,
  };
}
