/**
 * useRoiCalculator - composable + pure logic for ROI calculation.
 *
 * Inputs: initial investment, final value, optional time period (years).
 * Outputs: ROI %, gain/loss, annualized return.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface RoiResult {
  ok: boolean;
  message?: string;
  initialInvestment: number;
  finalValue: number;
  gainLoss: number;
  roi: number;
  annualizedReturn: number | null;
  years: number | null;
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

export function calculateRoi(
  initialInvestment: number,
  finalValue: number,
  years?: number,
): RoiResult {
  if (!Number.isFinite(initialInvestment) || initialInvestment <= 0) {
    return { ok: false, message: 'Enter a valid initial investment (> 0).', initialInvestment: NaN, finalValue, gainLoss: NaN, roi: NaN, annualizedReturn: null, years: years ?? null };
  }
  if (!Number.isFinite(finalValue)) {
    return { ok: false, message: 'Enter a valid final value.', initialInvestment, finalValue: NaN, gainLoss: NaN, roi: NaN, annualizedReturn: null, years: years ?? null };
  }

  const gainLoss = round2(finalValue - initialInvestment);
  const roi = round4(((finalValue - initialInvestment) / initialInvestment) * 100);

  let annualizedReturn: number | null = null;
  if (years !== undefined && Number.isFinite(years) && years > 0) {
    const ratio = finalValue / initialInvestment;
    annualizedReturn = round4((Math.pow(ratio, 1 / years) - 1) * 100);
  }

  return {
    ok: true,
    initialInvestment,
    finalValue,
    gainLoss,
    roi,
    annualizedReturn,
    years: years ?? null,
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

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseRoiCalculatorReturn {
  initialInvestment: Ref<string>;
  finalValue: Ref<string>;
  years: Ref<string>;
  snapshot: Ref<RoiResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useRoiCalculator(): UseRoiCalculatorReturn {
  const initialInvestment = ref<string>('');
  const finalValue = ref<string>('');
  const years = ref<string>('');
  const snapshot = ref<RoiResult | null>(null);

  function recompute(): void {
    const init = parseNumber(initialInvestment.value);
    const final = parseNumber(finalValue.value);
    if (init === null || final === null) {
      snapshot.value = null;
      return;
    }
    const y = parseNumber(years.value);
    snapshot.value = calculateRoi(init, final, y ?? undefined);
  }

  function reset(): void {
    initialInvestment.value = '';
    finalValue.value = '';
    years.value = '';
    snapshot.value = null;
  }

  watch([initialInvestment, finalValue, years], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.initial === 'string' || typeof p.initial === 'number') {
        initialInvestment.value = String(p.initial);
      }
      if (typeof p.final === 'string' || typeof p.final === 'number') {
        finalValue.value = String(p.final);
      }
      if (typeof p.years === 'string' || typeof p.years === 'number') {
        years.value = String(p.years);
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        initialInvestment.value = String(p.input);
      }
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        finalValue.value = String(p.value);
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return {
    initialInvestment,
    finalValue,
    years,
    snapshot,
    isEmbed,
    embedInput,
    reset,
  };
}
