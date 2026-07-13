/**
 * usePercentageCalculator — composable + pure logic for the percentage
 * calculator tool.
 *
 * Three calculation modes:
 *
 *   - **ofTotal** — "X is what % of Y" → `(X / Y) * 100`
 *   - **percentValue** — "X% of Y is" → `(X / 100) * Y`
 *   - **change** — "% increase/decrease from X to Y" → `((Y - X) / X) * 100`
 *
 * All computations are pure arithmetic — no external dependencies. The
 * composable wires up reactive state and the embed PostMessage protocol.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type PercentMode = 'ofTotal' | 'percentValue' | 'change';

/** Inputs to the three pure compute functions. */
export interface PercentResult {
  /** `true` when the computation succeeded. */
  ok: boolean;
  /** Human-readable message when `ok === false`. */
  message?: string;
  /** Numeric result (the percentage or value). */
  result: number;
  /** For `change` mode: the direction of the change. */
  direction?: 'increase' | 'decrease' | 'none';
  /** Original inputs echoed back for convenience. */
  inputs: { x?: number; y?: number; pct?: number; from?: number; to?: number };
}

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Parse a string into a finite number. Returns `null` for empty/whitespace,
 * `NaN`, or non-finite values. Accepts numbers verbatim.
 */
export function parseNumber(input: unknown): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  // Tolerate a leading percent sign for percentage inputs ("25%" → 25).
  const cleaned = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
  if (cleaned.length === 0) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * "X is what % of Y" → `(X / Y) * 100`.
 *
 * Edge cases:
 *   - `Y === 0` → error "Cannot divide by zero — Y must be non-zero."
 */
export function computePercentOfTotal(x: number, y: number): PercentResult {
  const inputs = { x, y };
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { ok: false, message: 'Enter valid numbers for X and Y.', result: NaN, inputs };
  }
  if (y === 0) {
    return {
      ok: false,
      message: 'Cannot divide by zero — Y must be non-zero.',
      result: NaN,
      inputs,
    };
  }
  const result = (x / y) * 100;
  return { ok: true, result, inputs };
}

/**
 * "X% of Y is" → `(X / 100) * Y`.
 */
export function computePercentValue(pct: number, y: number): PercentResult {
  const inputs = { pct, y };
  if (!Number.isFinite(pct) || !Number.isFinite(y)) {
    return { ok: false, message: 'Enter valid numbers for the percentage and Y.', result: NaN, inputs };
  }
  const result = (pct / 100) * y;
  return { ok: true, result, inputs };
}

/**
 * "% increase/decrease from X to Y" → `((Y - X) / X) * 100`.
 *
 * Edge cases:
 *   - `X === 0` → error "Cannot compute change from zero — original must be non-zero."
 *   - `Y > X` → direction `increase`
 *   - `Y < X` → direction `decrease`
 *   - `Y === X` → direction `none`, result 0
 */
export function computePercentChange(from: number, to: number): PercentResult {
  const inputs = { from, to };
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return { ok: false, message: 'Enter valid numbers for the original and new value.', result: NaN, inputs };
  }
  if (from === 0) {
    return {
      ok: false,
      message: 'Cannot compute change from zero — original must be non-zero.',
      result: NaN,
      inputs,
    };
  }
  const result = ((to - from) / from) * 100;
  let direction: 'increase' | 'decrease' | 'none';
  if (to > from) direction = 'increase';
  else if (to < from) direction = 'decrease';
  else direction = 'none';
  return { ok: true, result, direction, inputs };
}

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns `—` for non-finite values.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Number.isInteger(n)) return n.toString();
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UsePercentageCalculatorReturn {
  mode: Ref<PercentMode>;
  /** "X is what % of Y" inputs. */
  xOfTotal: Ref<string>;
  yOfTotal: Ref<string>;
  /** "X% of Y is" inputs. */
  pctValue: Ref<string>;
  yValue: Ref<string>;
  /** "% increase/decrease from X to Y" inputs. */
  fromChange: Ref<string>;
  toChange: Ref<string>;
  snapshot: Ref<PercentResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function usePercentageCalculator(): UsePercentageCalculatorReturn {
  const mode = ref<PercentMode>('ofTotal');
  const xOfTotal = ref<string>('');
  const yOfTotal = ref<string>('');
  const pctValue = ref<string>('');
  const yValue = ref<string>('');
  const fromChange = ref<string>('');
  const toChange = ref<string>('');
  const snapshot = ref<PercentResult | null>(null);

  function recompute(): void {
    if (mode.value === 'ofTotal') {
      const x = parseNumber(xOfTotal.value);
      const y = parseNumber(yOfTotal.value);
      if (x === null || y === null) {
        snapshot.value = null;
        return;
      }
      snapshot.value = computePercentOfTotal(x, y);
    } else if (mode.value === 'percentValue') {
      const pct = parseNumber(pctValue.value);
      const y = parseNumber(yValue.value);
      if (pct === null || y === null) {
        snapshot.value = null;
        return;
      }
      snapshot.value = computePercentValue(pct, y);
    } else {
      const from = parseNumber(fromChange.value);
      const to = parseNumber(toChange.value);
      if (from === null || to === null) {
        snapshot.value = null;
        return;
      }
      snapshot.value = computePercentChange(from, to);
    }
  }

  function reset(): void {
    xOfTotal.value = '';
    yOfTotal.value = '';
    pctValue.value = '';
    yValue.value = '';
    fromChange.value = '';
    toChange.value = '';
    snapshot.value = null;
  }

  watch(
    [mode, xOfTotal, yOfTotal, pctValue, yValue, fromChange, toChange],
    () => {
      recompute();
    },
  );

  recompute();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (
        p.mode === 'ofTotal' ||
        p.mode === 'percentValue' ||
        p.mode === 'change'
      ) {
        mode.value = p.mode as PercentMode;
      }
      // ofTotal: x, y
      if (typeof p.x === 'string' || typeof p.x === 'number') {
        xOfTotal.value = String(p.x);
      }
      if (typeof p.y === 'string' || typeof p.y === 'number') {
        yOfTotal.value = String(p.y);
      }
      // percentValue: pct / percent, y
      if (typeof p.pct === 'string' || typeof p.pct === 'number') {
        pctValue.value = String(p.pct);
      } else if (typeof p.percent === 'string' || typeof p.percent === 'number') {
        pctValue.value = String(p.percent);
      }
      if (typeof p.y === 'string' || typeof p.y === 'number') {
        yValue.value = String(p.y);
      }
      // change: from, to
      if (typeof p.from === 'string' || typeof p.from === 'number') {
        fromChange.value = String(p.from);
      }
      if (typeof p.to === 'string' || typeof p.to === 'number') {
        toChange.value = String(p.to);
      }
      // Generic `input`/`value` → fill the active mode's first field.
      if (typeof p.input === 'string' || typeof p.input === 'number') {
        const v = String(p.input);
        if (mode.value === 'ofTotal') xOfTotal.value = v;
        else if (mode.value === 'percentValue') pctValue.value = v;
        else fromChange.value = v;
      }
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        const v = String(p.value);
        if (mode.value === 'ofTotal') yOfTotal.value = v;
        else if (mode.value === 'percentValue') yValue.value = v;
        else toChange.value = v;
      }
    },
  });

  watch(snapshot, (s) => {
    if (isEmbed.value) {
      sendOutput(s ?? {});
    }
  });

  return {
    mode,
    xOfTotal,
    yOfTotal,
    pctValue,
    yValue,
    fromChange,
    toChange,
    snapshot,
    isEmbed,
    embedInput,
    reset,
  };
}
