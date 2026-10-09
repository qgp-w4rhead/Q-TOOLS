/**
 * useUnitConverter - generic linear unit-converter engine shared by the
 * physical-quantity converter tools (force, power, torque, density, ...).
 *
 * A converter is described by one or more `UnitSet`s (a set = a quantity
 * mode such as "dynamic viscosity" vs "kinematic viscosity"). Each unit is
 * defined by a `toBase` factor expressing the value of 1 unit in the set's
 * base unit, so conversion is `value * from.toBase / to.toBase`.
 *
 * `sets` may be a plain array or a (computed) ref - tools whose factors
 * depend on a user option (e.g. DPI for px) can pass a ComputedRef and the
 * results recompute automatically.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { computed, ref, unref, watch, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface UnitDef {
  /** Stable id used in embed payloads and as the select value. */
  id: string;
  /** Human-readable name, e.g. "Pound-force". */
  label: string;
  /** Symbol shown after the value, e.g. "lbf". */
  symbol: string;
  /** Value of 1 unit expressed in the set's base unit. */
  toBase: number;
}

export interface UnitSet {
  /** Stable id for the quantity mode, e.g. "dynamic". */
  id: string;
  /** Tab/label for the mode, e.g. "Dynamic". */
  label: string;
  units: UnitDef[];
}

export interface UseUnitConverterOptions {
  /** One or more unit sets. Multiple sets render as mode tabs. */
  sets: UnitSet[] | Ref<UnitSet[]> | ComputedRef<UnitSet[]>;
  /** Initial set id (defaults to the first set). */
  defaultSetId?: string;
  /** Initial input unit id (defaults to the first unit of the set). */
  defaultUnitId?: string;
  /** Initial input value (defaults to '1'). */
  defaultValue?: string;
  /** Result formatter (defaults to `formatUnitValue`). */
  format?: (n: number) => string;
}

export interface UseUnitConverterReturn {
  inputValue: Ref<string>;
  inputUnit: Ref<string>;
  activeSetId: Ref<string>;
  /** Units of the currently active set. */
  units: ComputedRef<UnitDef[]>;
  /** All sets (resolved). */
  allSets: ComputedRef<UnitSet[]>;
  /** Formatted result per unit id of the active set. */
  results: Ref<Record<string, string>>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Convert `value` from unit `from` to unit `to` via their base-unit factors.
 * Returns `null` when the input is not a finite number.
 */
export function convertUnit(
  value: number,
  from: UnitDef,
  to: UnitDef,
): number | null {
  if (!Number.isFinite(value)) return null;
  return (value * from.toBase) / to.toBase;
}

/**
 * Format a converted value for display: up to 10 significant digits with
 * trailing zeros trimmed, exponential notation for extreme magnitudes,
 * '-' for non-finite values.
 */
export function formatUnitValue(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-6) {
    return n.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(parseFloat(n.toPrecision(10)));
}

/** Find a unit definition by id within a list. */
export function findUnit(units: UnitDef[], id: string): UnitDef | undefined {
  return units.find((u) => u.id === id);
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useUnitConverter(
  options: UseUnitConverterOptions,
): UseUnitConverterReturn {
  const allSets = computed<UnitSet[]>(() => unref(options.sets));

  const firstSet = (): UnitSet | undefined => allSets.value[0];

  const activeSetId = ref<string>(
    options.defaultSetId ?? firstSet()?.id ?? '',
  );
  const activeSet = computed<UnitSet | undefined>(
    () => allSets.value.find((s) => s.id === activeSetId.value) ?? firstSet(),
  );
  const units = computed<UnitDef[]>(() => activeSet.value?.units ?? []);

  const inputValue = ref<string>(options.defaultValue ?? '1');
  const inputUnit = ref<string>(
    options.defaultUnitId ?? units.value[0]?.id ?? '',
  );
  const results = ref<Record<string, string>>({});
  const format = options.format ?? formatUnitValue;

  function recompute(): void {
    const num = Number(inputValue.value);
    const from = findUnit(units.value, inputUnit.value) ?? units.value[0];
    const out: Record<string, string> = {};
    if (from) {
      for (const unit of units.value) {
        const converted = convertUnit(num, from, unit);
        out[unit.id] = converted === null ? '-' : format(converted);
      }
    }
    results.value = out;
  }

  function reset(): void {
    activeSetId.value = options.defaultSetId ?? firstSet()?.id ?? '';
    inputUnit.value =
      options.defaultUnitId ?? activeSet.value?.units[0]?.id ?? '';
    inputValue.value = options.defaultValue ?? '1';
    recompute();
  }

  // When the active set changes, keep the input unit valid.
  watch(activeSetId, () => {
    if (!findUnit(units.value, inputUnit.value)) {
      inputUnit.value = units.value[0]?.id ?? '';
    }
    recompute();
  });

  watch([inputValue, inputUnit, units], () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;

      const setKey = p.set ?? p.mode ?? p.quantity;
      if (
        typeof setKey === 'string' &&
        allSets.value.some((s) => s.id === setKey)
      ) {
        activeSetId.value = setKey;
      }

      const v = p.value ?? p.input ?? p.amount;
      if (typeof v === 'string' || typeof v === 'number') {
        inputValue.value = String(v);
      }

      const u = p.unit ?? p.from ?? p.inputUnit;
      if (typeof u === 'string') {
        const match =
          findUnit(units.value, u) ??
          units.value.find(
            (x) => x.symbol.toLowerCase() === u.toLowerCase(),
          );
        if (match) inputUnit.value = match.id;
      }
    },
    output: results,
    toOutput: () => ({
      results: results.value,
      inputValue: inputValue.value,
      inputUnit: inputUnit.value,
      set: activeSetId.value,
    }),
  });

  return {
    inputValue,
    inputUnit,
    activeSetId,
    units,
    allSets,
    results,
    isEmbed,
    embedInput,
    reset,
  };
}
