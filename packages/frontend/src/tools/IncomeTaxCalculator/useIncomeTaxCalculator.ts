/**
 * useIncomeTaxCalculator - composable + pure logic for progressive
 * income tax bracket calculation.
 *
 * The user provides an income amount and a set of tax brackets
 * (lower bound, upper bound, rate). The calculator computes the
 * tax owed per bracket, total tax, effective rate, and marginal rate.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface TaxBracket {
  /** Lower bound (inclusive). */
  min: number;
  /** Upper bound (exclusive). Infinity for the last bracket. */
  max: number;
  /** Tax rate as percentage (e.g. 10 for 10%). */
  rate: number;
}

export interface BracketResult {
  bracket: TaxBracket;
  taxableAmount: number;
  tax: number;
}

export interface IncomeTaxResult {
  ok: boolean;
  message?: string;
  income: number;
  totalTax: number;
  netIncome: number;
  effectiveRate: number;
  marginalRate: number;
  brackets: BracketResult[];
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

export function calculateIncomeTax(
  income: number,
  brackets: TaxBracket[],
): IncomeTaxResult {
  if (!Number.isFinite(income) || income < 0) {
    return { ok: false, message: 'Enter a valid income amount.', income: NaN, totalTax: NaN, netIncome: NaN, effectiveRate: NaN, marginalRate: NaN, brackets: [] };
  }
  if (brackets.length === 0) {
    return { ok: false, message: 'Add at least one tax bracket.', income, totalTax: NaN, netIncome: NaN, effectiveRate: NaN, marginalRate: NaN, brackets: [] };
  }

  let totalTax = 0;
  let marginalRate = 0;
  const results: BracketResult[] = [];

  for (const bracket of brackets) {
    if (income <= bracket.min) {
      results.push({ bracket, taxableAmount: 0, tax: 0 });
      continue;
    }

    const upper = bracket.max === Infinity ? income : Math.min(income, bracket.max);
    const taxableAmount = Math.max(0, upper - bracket.min);

    if (taxableAmount > 0) {
      const tax = round2(taxableAmount * (bracket.rate / 100));
      totalTax += tax;
      marginalRate = bracket.rate;
      results.push({ bracket, taxableAmount: round2(taxableAmount), tax });
    } else {
      results.push({ bracket, taxableAmount: 0, tax: 0 });
    }
  }

  const netIncome = round2(income - totalTax);
  const effectiveRate = income > 0 ? round4((totalTax / income) * 100) : 0;

  return {
    ok: true,
    income,
    totalTax: round2(totalTax),
    netIncome,
    effectiveRate,
    marginalRate,
    brackets: results,
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

export function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(2)}%`;
}

/** Default US 2024 single-filer brackets. */
export const DEFAULT_BRACKETS: TaxBracket[] = [
  { min: 0, max: 11600, rate: 10 },
  { min: 11600, max: 47150, rate: 12 },
  { min: 47150, max: 100525, rate: 22 },
  { min: 100525, max: 191950, rate: 24 },
  { min: 191950, max: 243725, rate: 32 },
  { min: 243725, max: 609350, rate: 35 },
  { min: 609350, max: Infinity, rate: 37 },
];

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseIncomeTaxCalculatorReturn {
  income: Ref<string>;
  brackets: Ref<TaxBracket[]>;
  snapshot: Ref<IncomeTaxResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
  addBracket: () => void;
  removeBracket: (index: number) => void;
  updateBracket: (index: number, field: keyof TaxBracket, value: string) => void;
}

export function useIncomeTaxCalculator(): UseIncomeTaxCalculatorReturn {
  const income = ref<string>('');
  const brackets = ref<TaxBracket[]>(DEFAULT_BRACKETS.map((b) => ({ ...b })));
  const snapshot = ref<IncomeTaxResult | null>(null);

  function recompute(): void {
    const inc = parseNumber(income.value);
    if (inc === null) {
      snapshot.value = null;
      return;
    }
    snapshot.value = calculateIncomeTax(inc, brackets.value);
  }

  function reset(): void {
    income.value = '';
    brackets.value = DEFAULT_BRACKETS.map((b) => ({ ...b }));
    snapshot.value = null;
  }

  function addBracket(): void {
    const last = brackets.value[brackets.value.length - 1];
    const lastMax = last ? last.max : 0;
    brackets.value.push({
      min: lastMax === Infinity ? 0 : lastMax,
      max: Infinity,
      rate: 0,
    });
  }

  function removeBracket(index: number): void {
    if (brackets.value.length <= 1) return;
    brackets.value.splice(index, 1);
  }

  function updateBracket(index: number, field: keyof TaxBracket, value: string): void {
    const bracket = brackets.value[index];
    if (!bracket) return;
    if (field === 'max') {
      const v = value.trim().toLowerCase();
      bracket.max = v === '' || v === 'inf' || v === 'infinity' ? Infinity : (parseNumber(value) ?? Infinity);
    } else if (field === 'rate') {
      bracket.rate = parseNumber(value) ?? 0;
    } else {
      (bracket as Record<string, unknown>)[field] = parseNumber(value) ?? 0;
    }
  }

  watch([income, brackets], () => recompute(), { deep: true });
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.income === 'string' || typeof p.income === 'number') {
        income.value = String(p.income);
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        income.value = String(p.input);
      }
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        income.value = String(p.value);
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return {
    income,
    brackets,
    snapshot,
    isEmbed,
    embedInput,
    reset,
    addBracket,
    removeBracket,
    updateBracket,
  };
}
