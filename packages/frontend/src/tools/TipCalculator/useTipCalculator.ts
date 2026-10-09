/**
 * useTipCalculator - composable + pure logic for tip calculation.
 *
 * Inputs: bill amount, tip percentage, number of people.
 * Outputs: tip amount, total bill, per-person total, per-person tip.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface TipResult {
  ok: boolean;
  message?: string;
  billAmount: number;
  tipPercent: number;
  tipAmount: number;
  totalBill: number;
  perPersonTotal: number;
  perPersonTip: number;
  splitCount: number;
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

export function calculateTip(
  billAmount: number,
  tipPercent: number,
  splitCount: number,
): TipResult {
  if (!Number.isFinite(billAmount) || billAmount < 0) {
    return { ok: false, message: 'Enter a valid bill amount.', billAmount: NaN, tipPercent, tipAmount: NaN, totalBill: NaN, perPersonTotal: NaN, perPersonTip: NaN, splitCount };
  }
  if (!Number.isFinite(tipPercent) || tipPercent < 0) {
    return { ok: false, message: 'Enter a valid tip percentage.', billAmount, tipPercent: NaN, tipAmount: NaN, totalBill: NaN, perPersonTotal: NaN, perPersonTip: NaN, splitCount };
  }
  if (!Number.isFinite(splitCount) || splitCount < 1) {
    return { ok: false, message: 'Split count must be at least 1.', billAmount, tipPercent, tipAmount: NaN, totalBill: NaN, perPersonTotal: NaN, perPersonTip: NaN, splitCount: NaN };
  }

  const tipAmount = round2(billAmount * (tipPercent / 100));
  const totalBill = round2(billAmount + tipAmount);
  const perPersonTotal = round2(totalBill / splitCount);
  const perPersonTip = round2(tipAmount / splitCount);

  return {
    ok: true,
    billAmount,
    tipPercent,
    tipAmount,
    totalBill,
    perPersonTotal,
    perPersonTip,
    splitCount,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCurrency(n: number, symbol = '$'): string {
  if (!Number.isFinite(n)) return '-';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Common tip presets. */
export const TIP_PRESETS = [10, 15, 18, 20, 25];

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseTipCalculatorReturn {
  billAmount: Ref<string>;
  tipPercent: Ref<string>;
  splitCount: Ref<string>;
  snapshot: Ref<TipResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useTipCalculator(): UseTipCalculatorReturn {
  const billAmount = ref<string>('');
  const tipPercent = ref<string>('15');
  const splitCount = ref<string>('1');
  const snapshot = ref<TipResult | null>(null);

  function recompute(): void {
    const bill = parseNumber(billAmount.value);
    const tip = parseNumber(tipPercent.value);
    const split = parseNumber(splitCount.value);
    if (bill === null || tip === null || split === null) {
      snapshot.value = null;
      return;
    }
    snapshot.value = calculateTip(bill, tip, split);
  }

  function reset(): void {
    billAmount.value = '';
    tipPercent.value = '15';
    splitCount.value = '1';
    snapshot.value = null;
  }

  watch([billAmount, tipPercent, splitCount], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.bill === 'string' || typeof p.bill === 'number') {
        billAmount.value = String(p.bill);
      }
      if (typeof p.tip === 'string' || typeof p.tip === 'number') {
        tipPercent.value = String(p.tip);
      }
      if (typeof p.split === 'string' || typeof p.split === 'number') {
        splitCount.value = String(p.split);
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        billAmount.value = String(p.input);
      }
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        billAmount.value = String(p.value);
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return {
    billAmount,
    tipPercent,
    splitCount,
    snapshot,
    isEmbed,
    embedInput,
    reset,
  };
}
