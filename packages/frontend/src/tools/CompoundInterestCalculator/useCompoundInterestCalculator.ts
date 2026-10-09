/**
 * useCompoundInterestCalculator - composable + pure logic for compound
 * interest calculation.
 *
 * Formula: A = P(1 + r/n)^(nt)
 * where:
 *   P = principal
 *   r = annual rate (decimal, e.g. 0.05 for 5%)
 *   n = compounding frequency per year
 *   t = time in years
 *
 * Also supports regular contributions (future value of a series).
 *
 * No external dependencies - pure arithmetic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type CompoundingFrequency =
  | '1' // annually
  | '2' // semi-annually
  | '4' // quarterly
  | '12' // monthly
  | '52' // weekly
  | '365'; // daily

export type ContributionFrequency =
  | 'none'
  | '1'
  | '12'
  | '52'
  | '365';

export interface CompoundInterestResult {
  ok: boolean;
  message?: string;
  finalAmount: number;
  totalInterest: number;
  totalContributions: number;
  principal: number;
  inputs: {
    principal: number;
    annualRate: number;
    years: number;
    compoundingFreq: number;
    contribution: number;
    contributionFreq: number;
  };
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

/**
 * Compute compound interest with optional regular contributions.
 *
 * @param principal - Initial amount.
 * @param annualRate - Annual interest rate as percentage (e.g. 5 for 5%).
 * @param years - Time in years.
 * @param compoundingFreq - Compounding periods per year (1, 2, 4, 12, 52, 365).
 * @param contribution - Regular contribution amount (0 if none).
 * @param contributionFreq - Contribution frequency per year (0 = none, 1, 12, 52, 365).
 */
export function calculateCompoundInterest(
  principal: number,
  annualRate: number,
  years: number,
  compoundingFreq: number,
  contribution = 0,
  contributionFreq: number = 0,
): CompoundInterestResult {
  const inputs = {
    principal,
    annualRate,
    years,
    compoundingFreq,
    contribution,
    contributionFreq,
  };

  if (!Number.isFinite(principal) || principal < 0) {
    return { ok: false, message: 'Enter a valid principal amount.', finalAmount: NaN, totalInterest: NaN, totalContributions: 0, principal: NaN, inputs };
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    return { ok: false, message: 'Enter a valid annual interest rate.', finalAmount: NaN, totalInterest: NaN, totalContributions: 0, principal: NaN, inputs };
  }
  if (!Number.isFinite(years) || years <= 0) {
    return { ok: false, message: 'Enter a valid time period.', finalAmount: NaN, totalInterest: NaN, totalContributions: 0, principal: NaN, inputs };
  }
  if (!Number.isFinite(compoundingFreq) || compoundingFreq <= 0) {
    return { ok: false, message: 'Enter a valid compounding frequency.', finalAmount: NaN, totalInterest: NaN, totalContributions: 0, principal: NaN, inputs };
  }

  const r = annualRate / 100;
  const n = compoundingFreq;
  const t = years;

  // Compound interest for the principal: P(1 + r/n)^(nt)
  const principalGrowth = principal * Math.pow(1 + r / n, n * t);

  // Future value of regular contributions (if any)
  let contributionGrowth = 0;
  let totalContributions = 0;

  if (contribution > 0 && contributionFreq > 0) {
    totalContributions = contribution * contributionFreq * t;
    // FV of a series: PMT * [((1 + r/n)^(nt) - 1) / (r/n)]
    // where PMT is per-period contribution, adjusted for frequency
    const periodicRate = r / n;
    const periods = n * t;
    const contributionsPerPeriod = (contribution * contributionFreq) / n;

    if (periodicRate === 0) {
      contributionGrowth = contributionsPerPeriod * periods;
    } else {
      contributionGrowth = contributionsPerPeriod * ((Math.pow(1 + periodicRate, periods) - 1) / periodicRate);
    }
  }

  const finalAmount = principalGrowth + contributionGrowth;
  const totalInterest = finalAmount - principal - totalContributions;

  return {
    ok: true,
    finalAmount: round2(finalAmount),
    totalInterest: round2(totalInterest),
    totalContributions: round2(totalContributions),
    principal,
    inputs,
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

export interface UseCompoundInterestCalculatorReturn {
  principal: Ref<string>;
  annualRate: Ref<string>;
  years: Ref<string>;
  compoundingFreq: Ref<CompoundingFrequency>;
  contribution: Ref<string>;
  contributionFreq: Ref<ContributionFrequency>;
  snapshot: Ref<CompoundInterestResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useCompoundInterestCalculator(): UseCompoundInterestCalculatorReturn {
  const principal = ref<string>('');
  const annualRate = ref<string>('');
  const years = ref<string>('');
  const compoundingFreq = ref<CompoundingFrequency>('12');
  const contribution = ref<string>('');
  const contributionFreq = ref<ContributionFrequency>('none');
  const snapshot = ref<CompoundInterestResult | null>(null);

  function recompute(): void {
    const p = parseNumber(principal.value);
    const r = parseNumber(annualRate.value);
    const y = parseNumber(years.value);
    if (p === null || r === null || y === null) {
      snapshot.value = null;
      return;
    }
    const c = parseNumber(contribution.value) ?? 0;
    const cf = contributionFreq.value === 'none' ? 0 : Number(contributionFreq.value);
    snapshot.value = calculateCompoundInterest(p, r, y, Number(compoundingFreq.value), c, cf);
  }

  function reset(): void {
    principal.value = '';
    annualRate.value = '';
    years.value = '';
    compoundingFreq.value = '12';
    contribution.value = '';
    contributionFreq.value = 'none';
    snapshot.value = null;
  }

  watch(
    [principal, annualRate, years, compoundingFreq, contribution, contributionFreq],
    () => recompute(),
  );
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
      if (typeof p.years === 'string' || typeof p.years === 'number') {
        years.value = String(p.years);
      } else if (typeof p.time === 'string' || typeof p.time === 'number') {
        years.value = String(p.time);
      }
      if (typeof p.contribution === 'string' || typeof p.contribution === 'number') {
        contribution.value = String(p.contribution);
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
    years,
    compoundingFreq,
    contribution,
    contributionFreq,
    snapshot,
    isEmbed,
    embedInput,
    reset,
  };
}
