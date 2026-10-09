/**
 * useFrequencyConverter - composable + unit definitions for the frequency
 * converter.
 *
 * Converts between frequency units using hertz as the base unit.
 * Supports: Hz, kHz, MHz, GHz, THz, rpm.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertFrequency } from '@/composables/useUnitConverter';

export type UseFrequencyConverterReturn = UseUnitConverterReturn;

export const FREQUENCY_UNITS: UnitSet[] = [
  {
    id: 'frequency',
    label: 'Frequency',
    units: [
      { id: 'Hz', label: 'Hertz', symbol: 'Hz', toBase: 1 },
      { id: 'kHz', label: 'Kilohertz', symbol: 'kHz', toBase: 1000 },
      { id: 'MHz', label: 'Megahertz', symbol: 'MHz', toBase: 1_000_000 },
      { id: 'GHz', label: 'Gigahertz', symbol: 'GHz', toBase: 1_000_000_000 },
      { id: 'THz', label: 'Terahertz', symbol: 'THz', toBase: 1_000_000_000_000 },
      { id: 'rpm', label: 'Revolutions per minute', symbol: 'rpm', toBase: 1 / 60 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatFrequency(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function useFrequencyConverter(): UseFrequencyConverterReturn {
  return useUnitConverter({
    sets: FREQUENCY_UNITS,
    defaultUnitId: 'Hz',
    format: formatFrequency,
  });
}
