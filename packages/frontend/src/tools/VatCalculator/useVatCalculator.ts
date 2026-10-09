/**
 * useVatCalculator - composable + pure logic for VAT / sales tax calculator.
 *
 * Two modes:
 *   - "add" - add VAT to a net amount → gross amount
 *   - "remove" - remove VAT from a gross amount → net amount
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type VatMode = 'add' | 'remove';

export interface VatResult {
  ok: boolean;
  message?: string;
  mode: VatMode;
  inputAmount: number;
  rate: number;
  vatAmount: number;
  outputAmount: number;
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

export function calculateVat(
  amount: number,
  rate: number,
  mode: VatMode,
): VatResult {
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: 'Enter a valid amount.', mode, inputAmount: NaN, rate, vatAmount: NaN, outputAmount: NaN };
  }
  if (!Number.isFinite(rate) || rate < 0) {
    return { ok: false, message: 'Enter a valid VAT rate.', mode, inputAmount: amount, rate: NaN, vatAmount: NaN, outputAmount: NaN };
  }

  if (mode === 'add') {
    const vatAmount = round2(amount * (rate / 100));
    return {
      ok: true,
      mode,
      inputAmount: amount,
      rate,
      vatAmount,
      outputAmount: round2(amount + vatAmount),
    };
  } else {
    const netAmount = round2(amount / (1 + rate / 100));
    return {
      ok: true,
      mode,
      inputAmount: amount,
      rate,
      vatAmount: round2(amount - netAmount),
      outputAmount: netAmount,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCurrency(n: number, symbol = '$'): string {
  if (!Number.isFinite(n)) return '-';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Common VAT rates by country/region. */
export const VAT_PRESETS: { label: string; rate: number }[] = [
  { label: 'Custom', rate: 0 },
  { label: 'UK VAT (20%)', rate: 20 },
  { label: 'EU Standard (19%)', rate: 19 },
  { label: 'France (20%)', rate: 20 },
  { label: 'Germany (19%)', rate: 19 },
  { label: 'Italy (22%)', rate: 22 },
  { label: 'Spain (21%)', rate: 21 },
  { label: 'Ireland (23%)', rate: 23 },
  { label: 'Australia GST (10%)', rate: 10 },
  { label: 'New Zealand GST (15%)', rate: 15 },
  { label: 'Canada GST (5%)', rate: 5 },
  { label: 'US Sales Tax (avg 7%)', rate: 7 },
];

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseVatCalculatorReturn {
  amount: Ref<string>;
  rate: Ref<string>;
  mode: Ref<VatMode>;
  snapshot: Ref<VatResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useVatCalculator(): UseVatCalculatorReturn {
  const amount = ref<string>('');
  const rate = ref<string>('20');
  const mode = ref<VatMode>('add');
  const snapshot = ref<VatResult | null>(null);

  function recompute(): void {
    const a = parseNumber(amount.value);
    const r = parseNumber(rate.value);
    if (a === null || r === null) {
      snapshot.value = null;
      return;
    }
    snapshot.value = calculateVat(a, r, mode.value);
  }

  function reset(): void {
    amount.value = '';
    rate.value = '20';
    mode.value = 'add';
    snapshot.value = null;
  }

  watch([amount, rate, mode], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.amount === 'string' || typeof p.amount === 'number') {
        amount.value = String(p.amount);
      }
      if (typeof p.rate === 'string' || typeof p.rate === 'number') {
        rate.value = String(p.rate);
      }
      if (p.mode === 'add' || p.mode === 'remove') {
        mode.value = p.mode as VatMode;
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        amount.value = String(p.input);
      }
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        amount.value = String(p.value);
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return {
    amount,
    rate,
    mode,
    snapshot,
    isEmbed,
    embedInput,
    reset,
  };
}
