/**
 * useCurrencyConverter - composable + pure logic for currency conversion.
 *
 * Uses static user-defined exchange rates. The user enters an amount,
 * selects a source and target currency, and provides the exchange rate.
 * Optionally, a rate table can be built for multiple currencies.
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface CurrencyRate {
  code: string;
  name: string;
  rate: number;
}

export interface ConversionResult {
  ok: boolean;
  message?: string;
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  convertedAmount: number;
}

export interface RateTableRow {
  currency: string;
  rate: number;
  converted: number;
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

export function convertCurrency(
  amount: number,
  rate: number,
  fromCurrency: string,
  toCurrency: string,
): ConversionResult {
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: 'Enter a valid amount.', amount: NaN, fromCurrency, toCurrency, rate, convertedAmount: NaN };
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, message: 'Enter a valid exchange rate.', amount, fromCurrency, toCurrency, rate, convertedAmount: NaN };
  }
  return {
    ok: true,
    amount,
    fromCurrency,
    toCurrency,
    rate,
    convertedAmount: round2(amount * rate),
  };
}

export function buildRateTable(
  amount: number,
  rates: CurrencyRate[],
): RateTableRow[] {
  return rates
    .filter((r) => Number.isFinite(r.rate) && r.rate > 0)
    .map((r) => ({
      currency: r.code,
      rate: r.rate,
      converted: round2(amount * r.rate),
    }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCurrency(n: number, symbol = ''): string {
  if (!Number.isFinite(n)) return '-';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Default static rates (relative to USD). */
export const DEFAULT_RATES: CurrencyRate[] = [
  { code: 'USD', name: 'US Dollar', rate: 1 },
  { code: 'EUR', name: 'Euro', rate: 0.92 },
  { code: 'GBP', name: 'British Pound', rate: 0.79 },
  { code: 'JPY', name: 'Japanese Yen', rate: 149.5 },
  { code: 'CAD', name: 'Canadian Dollar', rate: 1.36 },
  { code: 'AUD', name: 'Australian Dollar', rate: 1.52 },
  { code: 'CHF', name: 'Swiss Franc', rate: 0.88 },
  { code: 'CNY', name: 'Chinese Yuan', rate: 7.24 },
  { code: 'INR', name: 'Indian Rupee', rate: 83.1 },
  { code: 'BRL', name: 'Brazilian Real', rate: 4.97 },
];

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseCurrencyConverterReturn {
  amount: Ref<string>;
  fromCurrency: Ref<string>;
  toCurrency: Ref<string>;
  rate: Ref<string>;
  rates: Ref<CurrencyRate[]>;
  snapshot: Ref<ConversionResult | null>;
  rateTable: Ref<RateTableRow[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useCurrencyConverter(): UseCurrencyConverterReturn {
  const amount = ref<string>('');
  const fromCurrency = ref<string>('USD');
  const toCurrency = ref<string>('EUR');
  const rate = ref<string>('');
  const rates = ref<CurrencyRate[]>([...DEFAULT_RATES]);
  const snapshot = ref<ConversionResult | null>(null);
  const rateTable = ref<RateTableRow[]>([]);

  function recompute(): void {
    const amt = parseNumber(amount.value);
    if (amt === null) {
      snapshot.value = null;
      rateTable.value = [];
      return;
    }

    // Auto-fill rate from the rates table if available
    const fromRate = rates.value.find((r) => r.code === fromCurrency.value);
    const toRate = rates.value.find((r) => r.code === toCurrency.value);

    let usedRate: number | null = null;

    // If user manually entered a rate, use it
    const manualRate = parseNumber(rate.value);
    if (manualRate !== null && manualRate > 0) {
      usedRate = manualRate;
    } else if (fromRate && toRate) {
      // Derive cross rate from USD-based rates
      if (fromRate.code === toRate.code) {
        usedRate = 1;
      } else {
        usedRate = toRate.rate / fromRate.rate;
      }
    }

    if (usedRate === null) {
      snapshot.value = null;
      rateTable.value = [];
      return;
    }

    snapshot.value = convertCurrency(amt, usedRate, fromCurrency.value, toCurrency.value);

    // Build rate table (convert from source currency to all others)
    if (fromRate) {
      const baseRate = fromRate.rate;
      rateTable.value = rates.value
        .filter((r) => r.code !== fromCurrency.value)
        .map((r) => ({
          currency: r.code,
          rate: round2(r.rate / baseRate),
          converted: round2(amt * (r.rate / baseRate)),
        }));
    } else {
      rateTable.value = [];
    }
  }

  function reset(): void {
    amount.value = '';
    fromCurrency.value = 'USD';
    toCurrency.value = 'EUR';
    rate.value = '';
    snapshot.value = null;
    rateTable.value = [];
  }

  watch([amount, fromCurrency, toCurrency, rate, rates], () => recompute(), { deep: true });
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.amount === 'string' || typeof p.amount === 'number') {
        amount.value = String(p.amount);
      }
      if (typeof p.from === 'string') fromCurrency.value = String(p.from).toUpperCase();
      if (typeof p.to === 'string') toCurrency.value = String(p.to).toUpperCase();
      if (typeof p.rate === 'string' || typeof p.rate === 'number') {
        rate.value = String(p.rate);
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
    fromCurrency,
    toCurrency,
    rate,
    rates,
    snapshot,
    rateTable,
    isEmbed,
    embedInput,
    reset,
  };
}
