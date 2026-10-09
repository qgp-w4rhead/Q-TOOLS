/**
 * useLengthConverter - composable + unit definitions for the length converter.
 *
 * Converts between metric and imperial length units using metres as the base
 * unit. Supports: mm, cm, m, km, in, ft, yd, mi, nmi.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertLength } from '@/composables/useUnitConverter';

export type UseLengthConverterReturn = UseUnitConverterReturn;

export const LENGTH_UNITS: UnitSet[] = [
  {
    id: 'length',
    label: 'Length',
    units: [
      { id: 'mm', label: 'Millimetre', symbol: 'mm', toBase: 0.001 },
      { id: 'cm', label: 'Centimetre', symbol: 'cm', toBase: 0.01 },
      { id: 'm', label: 'Metre', symbol: 'm', toBase: 1 },
      { id: 'km', label: 'Kilometre', symbol: 'km', toBase: 1000 },
      { id: 'in', label: 'Inch', symbol: 'in', toBase: 0.0254 },
      { id: 'ft', label: 'Foot', symbol: 'ft', toBase: 0.3048 },
      { id: 'yd', label: 'Yard', symbol: 'yd', toBase: 0.9144 },
      { id: 'mi', label: 'Mile', symbol: 'mi', toBase: 1609.344 },
      { id: 'nmi', label: 'Nautical mile', symbol: 'nmi', toBase: 1852 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatLength(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function useLengthConverter(): UseLengthConverterReturn {
  return useUnitConverter({
    sets: LENGTH_UNITS,
    defaultUnitId: 'm',
    format: formatLength,
  });
}
