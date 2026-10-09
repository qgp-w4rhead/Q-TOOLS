/**
 * useTemperatureConverter - composable + pure logic for the temperature
 * converter tool.
 *
 * Converts between eight temperature scales via a Kelvin canonical
 * intermediate:
 *
 *   - Celsius (°C)
 *   - Fahrenheit (°F)
 *   - Kelvin (K)
 *   - Rankine (°R)
 *   - Delisle (°De)
 *   - Newton (°N)
 *   - Réaumur (°Ré)
 *   - Rømer (°Rø)
 *
 * All computations are pure arithmetic - no external dependencies. The
 * composable wires up reactive state and the embed PostMessage protocol.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type TemperatureUnit =
  | 'celsius'
  | 'fahrenheit'
  | 'kelvin'
  | 'rankine'
  | 'delisle'
  | 'newton'
  | 'reaumur'
  | 'romer';

export interface UnitMeta {
  /** Short symbol shown next to values, e.g. "°C". */
  symbol: string;
  /** Full unit name, e.g. "Celsius". */
  name: string;
  /** Lowercase aliases accepted when parsing a unit string from input. */
  aliases: string[];
}

/** Ordered list of all supported units (used for the output grid). */
export const UNIT_ORDER: TemperatureUnit[] = [
  'celsius',
  'fahrenheit',
  'kelvin',
  'rankine',
  'delisle',
  'newton',
  'reaumur',
  'romer',
];

export const UNIT_META: Record<TemperatureUnit, UnitMeta> = {
  celsius: { symbol: '°C', name: 'Celsius', aliases: ['c', 'celsius', 'centigrade', '°c'] },
  fahrenheit: { symbol: '°F', name: 'Fahrenheit', aliases: ['f', 'fahrenheit', '°f'] },
  kelvin: { symbol: 'K', name: 'Kelvin', aliases: ['k', 'kelvin'] },
  rankine: { symbol: '°R', name: 'Rankine', aliases: ['r', 'rankine', '°r', 'ra'] },
  delisle: { symbol: '°De', name: 'Delisle', aliases: ['de', 'delisle', '°de', 'd'] },
  newton: { symbol: '°N', name: 'Newton', aliases: ['n', 'newton', '°n'] },
  reaumur: { symbol: '°Ré', name: 'Réaumur', aliases: ['re', 'reaumur', 'réaumur', '°re', '°ré', 'reu'] },
  romer: { symbol: '°Rø', name: 'Rømer', aliases: ['ro', 'romer', 'rømer', '°ro', '°rø'] },
};

/** Result of a single conversion. */
export interface ConvertResult {
  ok: boolean;
  message?: string;
  result: number;
  from: TemperatureUnit;
  to: TemperatureUnit;
  input: number;
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
 * Resolve a unit string (case-insensitive) into a `TemperatureUnit`.
 * Returns `null` if no match.
 */
export function parseUnit(input: unknown): TemperatureUnit | null {
  if (typeof input !== 'string') return null;
  const key = input.trim().toLowerCase();
  if (key.length === 0) return null;
  for (const unit of UNIT_ORDER) {
    if (unit === key) return unit;
    if (UNIT_META[unit].aliases.includes(key)) return unit;
  }
  return null;
}

/**
 * Convert a value in the given unit to Kelvin (the canonical intermediate).
 *
 * Formulas sourced from Wikipedia's "Conversion of units of temperature".
 */
export function toKelvin(value: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'celsius':
      return value + 273.15;
    case 'fahrenheit':
      return (value + 459.67) * (5 / 9);
    case 'kelvin':
      return value;
    case 'rankine':
      return value * (5 / 9);
    case 'delisle':
      return 373.15 - value * (2 / 3);
    case 'newton':
      return (value * (100 / 33)) + 273.15;
    case 'reaumur':
      return (value * (5 / 4)) + 273.15;
    case 'romer':
      return ((value - 7.5) * (40 / 21)) + 273.15;
  }
}

/**
 * Convert a Kelvin value to the given unit.
 */
export function fromKelvin(k: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'celsius':
      return k - 273.15;
    case 'fahrenheit':
      return (k * (9 / 5)) - 459.67;
    case 'kelvin':
      return k;
    case 'rankine':
      return k * (9 / 5);
    case 'delisle':
      return (373.15 - k) * (3 / 2);
    case 'newton':
      return (k - 273.15) * (33 / 100);
    case 'reaumur':
      return (k - 273.15) * (4 / 5);
    case 'romer':
      return ((k - 273.15) * (21 / 40)) + 7.5;
  }
}

/**
 * Convert a value from one unit to another via the Kelvin intermediate.
 */
export function convertTemperature(
  value: number,
  from: TemperatureUnit,
  to: TemperatureUnit,
): ConvertResult {
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      message: 'Enter a valid numeric temperature.',
      result: NaN,
      from,
      to,
      input: value,
    };
  }
  const k = toKelvin(value, from);
  // Negative Kelvin is physically meaningless - surface as a warning but
  // still compute (some scales like Delisle produce values below absolute
  // zero for very hot inputs, which is fine). We only flag when the
  // *Kelvin* intermediate is below 0.
  const result = fromKelvin(k, to);
  if (k < 0) {
    return {
      ok: true,
      message: 'Below absolute zero (0 K) - physically impossible.',
      result,
      from,
      to,
      input: value,
    };
  }
  return { ok: true, result, from, to, input: value };
}

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns `-` for non-finite values.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (Number.isInteger(n)) return n.toString();
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseTemperatureConverterReturn {
  inputValue: Ref<string>;
  inputUnit: Ref<TemperatureUnit>;
  /** Map of every target unit → its converted value (or null when invalid). */
  outputs: Ref<Record<TemperatureUnit, ConvertResult | null>>;
  /** True when the input is below absolute zero. */
  belowAbsoluteZero: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useTemperatureConverter(): UseTemperatureConverterReturn {
  const inputValue = ref<string>('');
  const inputUnit = ref<TemperatureUnit>('celsius');
  const outputs = ref<Record<TemperatureUnit, ConvertResult | null>>(
    emptyOutputs(),
  );
  const belowAbsoluteZero = ref<boolean>(false);

  function emptyOutputs(): Record<TemperatureUnit, ConvertResult | null> {
    const out = {} as Record<TemperatureUnit, ConvertResult | null>;
    for (const u of UNIT_ORDER) out[u] = null;
    return out;
  }

  function recompute(): void {
    const v = parseNumber(inputValue.value);
    const next = emptyOutputs();
    let below = false;
    if (v === null) {
      outputs.value = next;
      belowAbsoluteZero.value = false;
      return;
    }
    const k = toKelvin(v, inputUnit.value);
    below = k < 0;
    for (const u of UNIT_ORDER) {
      next[u] = convertTemperature(v, inputUnit.value, u);
    }
    outputs.value = next;
    belowAbsoluteZero.value = below;
  }

  function reset(): void {
    inputValue.value = '';
    inputUnit.value = 'celsius';
    outputs.value = emptyOutputs();
    belowAbsoluteZero.value = false;
  }

  watch([inputValue, inputUnit], () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.value === 'string' || typeof p.value === 'number') {
        inputValue.value = String(p.value);
      } else if (typeof p.input === 'string' || typeof p.input === 'number') {
        inputValue.value = String(p.input);
      } else if (typeof p.from === 'string' || typeof p.from === 'number') {
        inputValue.value = String(p.from);
      }
      const unit = parseUnit(p.unit) ?? parseUnit(p.fromUnit) ?? parseUnit(p.inputUnit);
      if (unit) inputUnit.value = unit;
    },
    output: outputs,
    toOutput: () => {
      const v = parseNumber(inputValue.value);
      const map: Record<string, { value: number | null; symbol: string; name: string }> = {};
      for (const u of UNIT_ORDER) {
        const r = outputs.value[u];
        map[u] = {
          value: r && r.ok ? r.result : null,
          symbol: UNIT_META[u].symbol,
          name: UNIT_META[u].name,
        };
      }
      return {
        value: v,
        unit: inputUnit.value,
        belowAbsoluteZero: belowAbsoluteZero.value,
        outputs: map,
      };
    },
  });

  return {
    inputValue,
    inputUnit,
    outputs,
    belowAbsoluteZero,
    isEmbed,
    embedInput,
    reset,
  };
}
