/**
 * useLoanCalculator - composable + pure logic for the loan / mortgage
 * calculator tool.
 *
 * Given a principal, annual interest rate, and term (in years or months),
 * computes the monthly payment, total payment, total interest, and a full
 * amortization schedule.
 *
 * Formula (standard amortization):
 *   M = P * r(1+r)^n / ((1+r)^n - 1)
 * where:
 *   P = principal
 *   r = monthly interest rate (annual rate / 12 / 100)
 *   n = total number of payments
 *
 * Edge case: when r === 0, M = P / n (simple division).
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type TermUnit = 'years' | 'months';

/** A single row in the amortization schedule. */
export interface AmortizationRow {
  /** 1-based payment number. */
  payment: number;
  /** Beginning balance for this period. */
  balance: number;
  /** Payment amount for this period. */
  paymentAmount: number;
  /** Interest portion of the payment. */
  interest: number;
  /** Principal portion of the payment. */
  principal: number;
  /** Ending balance after this payment. */
  endingBalance: number;
}

/** Result of the loan calculation. */
export interface LoanResult {
  ok: boolean;
  message?: string;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  numberOfPayments: number;
  schedule: AmortizationRow[];
  inputs: { principal: number; annualRate: number; term: number; termUnit: TermUnit };
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Parse a string into a finite number. Returns `null` for empty/whitespace,
 * `NaN`, or non-finite values.
 */
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

/**
 * Compute the monthly payment and full amortization schedule.
 *
 * @param principal - Loan amount.
 * @param annualRate - Annual interest rate as a percentage (e.g. 5.5 for 5.5%).
 * @param term - Loan term.
 * @param termUnit - 'years' or 'months'.
 */
export function calculateLoan(
  principal: number,
  annualRate: number,
  term: number,
  termUnit: TermUnit,
): LoanResult {
  const inputs = { principal, annualRate, term, termUnit };

  if (!Number.isFinite(principal) || principal < 0) {
    return { ok: false, message: 'Enter a valid principal amount.', monthlyPayment: NaN, totalPayment: NaN, totalInterest: NaN, numberOfPayments: 0, schedule: [], inputs };
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    return { ok: false, message: 'Enter a valid annual interest rate.', monthlyPayment: NaN, totalPayment: NaN, totalInterest: NaN, numberOfPayments: 0, schedule: [], inputs };
  }
  if (!Number.isFinite(term) || term <= 0) {
    return { ok: false, message: 'Enter a valid loan term.', monthlyPayment: NaN, totalPayment: NaN, totalInterest: NaN, numberOfPayments: 0, schedule: [], inputs };
  }

  const n = termUnit === 'years' ? Math.round(term * 12) : Math.round(term);
  if (n <= 0) {
    return { ok: false, message: 'Term must result in at least 1 payment.', monthlyPayment: NaN, totalPayment: NaN, totalInterest: NaN, numberOfPayments: 0, schedule: [], inputs };
  }

  const monthlyRate = annualRate / 100 / 12;
  let monthlyPayment: number;

  if (monthlyRate === 0) {
    monthlyPayment = principal / n;
  } else {
    const factor = Math.pow(1 + monthlyRate, n);
    monthlyPayment = (principal * monthlyRate * factor) / (factor - 1);
  }

  const schedule: AmortizationRow[] = [];
  let balance = principal;
  let totalInterest = 0;

  for (let i = 1; i <= n; i++) {
    const interest = balance * monthlyRate;
    const principalPart = monthlyPayment - interest;
    const endingBalance = Math.max(0, balance - principalPart);

    schedule.push({
      payment: i,
      balance: round2(balance),
      paymentAmount: round2(monthlyPayment),
      interest: round2(interest),
      principal: round2(principalPart),
      endingBalance: round2(endingBalance),
    });

    totalInterest += interest;
    balance = endingBalance;
  }

  const totalPayment = monthlyPayment * n;

  return {
    ok: true,
    monthlyPayment: round2(monthlyPayment),
    totalPayment: round2(totalPayment),
    totalInterest: round2(totalInterest),
    numberOfPayments: n,
    schedule,
    inputs,
  };
}

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Format a number as currency. Returns `-` for non-finite values.
 */
export function formatCurrency(n: number, symbol = '$'): string {
  if (!Number.isFinite(n)) return '-';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a plain number for display.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseLoanCalculatorReturn {
  principal: Ref<string>;
  annualRate: Ref<string>;
  term: Ref<string>;
  termUnit: Ref<TermUnit>;
  snapshot: Ref<LoanResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useLoanCalculator(): UseLoanCalculatorReturn {
  const principal = ref<string>('');
  const annualRate = ref<string>('');
  const term = ref<string>('');
  const termUnit = ref<TermUnit>('years');
  const snapshot = ref<LoanResult | null>(null);

  function recompute(): void {
    const p = parseNumber(principal.value);
    const r = parseNumber(annualRate.value);
    const t = parseNumber(term.value);
    if (p === null || r === null || t === null) {
      snapshot.value = null;
      return;
    }
    snapshot.value = calculateLoan(p, r, t, termUnit.value);
  }

  function reset(): void {
    principal.value = '';
    annualRate.value = '';
    term.value = '';
    termUnit.value = 'years';
    snapshot.value = null;
  }

  watch([principal, annualRate, term, termUnit], () => recompute());
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.principal === 'string' || typeof p.principal === 'number') {
        principal.value = String(p.principal);
      }
      if (typeof p.rate === 'string' || typeof p.rate === 'number') {
        annualRate.value = String(p.rate);
      } else if (typeof p.annualRate === 'string' || typeof p.annualRate === 'number') {
        annualRate.value = String(p.annualRate);
      }
      if (typeof p.term === 'string' || typeof p.term === 'number') {
        term.value = String(p.term);
      }
      if (p.termUnit === 'years' || p.termUnit === 'months') {
        termUnit.value = p.termUnit as TermUnit;
      }
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        principal.value = String(p.input);
      }
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        principal.value = String(p.value);
      }
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return {
    principal,
    annualRate,
    term,
    termUnit,
    snapshot,
    isEmbed,
    embedInput,
    reset,
  };
}
