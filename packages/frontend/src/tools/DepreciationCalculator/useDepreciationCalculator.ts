/**
 * useDepreciationCalculator - composable + pure logic for depreciation
 * schedules.
 *
 * Three methods:
 *   - "straight-line" - (cost - salvage) / usefulLife
 *   - "declining-balance" - bookValue * (rate / 100) per year
 *   - "sum-of-years" - (cost - salvage) * (remainingLife / sumOfYears)
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type DepreciationMethod = 'straight-line' | 'declining-balance' | 'sum-of-years';

export interface DepreciationRow {
  year: number;
  depreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

export interface DepreciationResult {
  ok: boolean;
  message?: string;
  method: DepreciationMethod;
  cost: number;
  salvageValue: number;
  usefulLife: number;
  rate: number;
  annualDepreciation: number;
  schedule: DepreciationRow[];
  totalDepreciation: number;
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

export function calculateDepreciation(
  cost: number,
  salvageValue: number,
  usefulLife: number,
  method: DepreciationMethod,
  rate = 0,
): DepreciationResult {
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, message: 'Enter a valid asset cost.', method, cost: NaN, salvageValue, usefulLife, rate, annualDepreciation: NaN, schedule: [], totalDepreciation: NaN };
  }
  if (!Number.isFinite(salvageValue) || salvageValue < 0 || salvageValue > cost) {
    return { ok: false, message: 'Salvage value must be between 0 and cost.', method, cost, salvageValue: NaN, usefulLife, rate, annualDepreciation: NaN, schedule: [], totalDepreciation: NaN };
  }
  if (!Number.isFinite(usefulLife) || usefulLife <= 0) {
    return { ok: false, message: 'Enter a valid useful life (> 0).', method, cost, salvageValue, usefulLife: NaN, rate, annualDepreciation: NaN, schedule: [], totalDepreciation: NaN };
  }

  const depreciableAmount = cost - salvageValue;
  const schedule: DepreciationRow[] = [];
  let totalDepreciation = 0;

  if (method === 'straight-line') {
    const annualDepreciation = round2(depreciableAmount / usefulLife);
    let accumulated = 0;
    let bookValue = cost;

    for (let year = 1; year <= Math.round(usefulLife); year++) {
      const dep = Math.min(annualDepreciation, bookValue - salvageValue);
      accumulated = round2(accumulated + dep);
      bookValue = round2(cost - accumulated);
      schedule.push({ year, depreciation: round2(dep), accumulatedDepreciation: accumulated, bookValue });
      totalDepreciation = accumulated;
    }

    return {
      ok: true,
      method,
      cost,
      salvageValue,
      usefulLife,
      rate,
      annualDepreciation,
      schedule,
      totalDepreciation,
    };
  }

  if (method === 'declining-balance') {
    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, message: 'Enter a valid depreciation rate (> 0).', method, cost, salvageValue, usefulLife, rate: NaN, annualDepreciation: NaN, schedule: [], totalDepreciation: NaN };
    }

    let bookValue = cost;
    let accumulated = 0;

    for (let year = 1; year <= Math.round(usefulLife); year++) {
      let dep = round2(bookValue * (rate / 100));
      if (bookValue - dep < salvageValue) {
        dep = round2(bookValue - salvageValue);
      }
      if (dep <= 0) break;
      accumulated = round2(accumulated + dep);
      bookValue = round2(cost - accumulated);
      schedule.push({ year, depreciation: dep, accumulatedDepreciation: accumulated, bookValue });
      totalDepreciation = accumulated;
    }

    return {
      ok: true,
      method,
      cost,
      salvageValue,
      usefulLife,
      rate,
      annualDepreciation: schedule[0]?.depreciation ?? 0,
      schedule,
      totalDepreciation,
    };
  }

  // sum-of-years
  const sumOfYears = (Math.round(usefulLife) * (Math.round(usefulLife) + 1)) / 2;
  let accumulated = 0;
  let bookValue = cost;

  for (let year = 1; year <= Math.round(usefulLife); year++) {
    const remainingLife = Math.round(usefulLife) - year + 1;
    const dep = round2(depreciableAmount * (remainingLife / sumOfYears));
    accumulated = round2(accumulated + dep);
    bookValue = round2(cost - accumulated);
    schedule.push({ year, depreciation: dep, accumulatedDepreciation: accumulated, bookValue });
    totalDepreciation = accumulated;
  }

  return {
    ok: true,
    method,
    cost,
    salvageValue,
    usefulLife,
    rate,
    annualDepreciation: schedule[0]?.depreciation ?? 0,
    schedule,
    totalDepreciation,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCurrency(n: number, symbol = '$'): string {
  if (!Number.isFinite(n)) return '-';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseDepreciationCalculatorReturn {
  cost: Ref<string>;
  salvageValue: Ref<string>;
  usefulLife: Ref<string>;
  method: Ref<DepreciationMethod>;
  rate: Ref<string>;
  snapshot: Ref<DepreciationResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useDepreciationCalculator(): UseDepreciationCalculatorReturn {
  const cost = ref<string>('');
  const salvageValue = ref<string>('');
  const usefulLife = ref<string>('');
  const method = ref<DepreciationMethod>('straight-line');
  const rate = ref<string>('20');
  const snapshot = ref<DepreciationResult | null>(null);

  function recompute(): void {
    const c = parseNumber(cost.value);
    const s = parseNumber(salvageValue.value);
    const l = parseNumber(usefulLife.value);
    if (c === null || s === null || l === null) {
      snapshot.value = null;
      return;
    }
    const r = parseNumber(rate.value) ?? 0;
    snapshot.value = calculateDepreciation(c, s, l, method.value, r);
  }

  function reset(): void {
    cost.value = '';
    salvageValue.value = '';
    usefulLife.value = '';
    method.value = 'straight-line';
    rate.value = '20';
    snapshot.value = null;
  }

  watch([cost, salvageValue, usefulLife, method, rate], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.cost === 'string' || typeof p.cost === 'number') cost.value = String(p.cost);
      if (typeof p.salvage === 'string' || typeof p.salvage === 'number') salvageValue.value = String(p.salvage);
      if (typeof p.life === 'string' || typeof p.life === 'number') usefulLife.value = String(p.life);
      if (typeof p.rate === 'string' || typeof p.rate === 'number') rate.value = String(p.rate);
      if (p.method === 'straight-line' || p.method === 'declining-balance' || p.method === 'sum-of-years') {
        method.value = p.method as DepreciationMethod;
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') cost.value = String(p.input);
      if (typeof p.value === 'string' || typeof p.value === 'number') cost.value = String(p.value);
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return {
    cost,
    salvageValue,
    usefulLife,
    method,
    rate,
    snapshot,
    isEmbed,
    embedInput,
    reset,
  };
}
