/**
 * useAreaConverter - composable + unit definitions for the area converter.
 *
 * Converts between metric and imperial area units using square metres as
 * the base unit. Supports: mm², cm², m², ha, km², in², ft², yd², ac, mi².
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertArea } from '@/composables/useUnitConverter';

export type UseAreaConverterReturn = UseUnitConverterReturn;

export const AREA_UNITS: UnitSet[] = [
  {
    id: 'area',
    label: 'Area',
    units: [
      { id: 'mm2', label: 'Square millimetre', symbol: 'mm2', toBase: 0.000001 },
      { id: 'cm2', label: 'Square centimetre', symbol: 'cm2', toBase: 0.0001 },
      { id: 'm2', label: 'Square metre', symbol: 'm2', toBase: 1 },
      { id: 'ha', label: 'Hectare', symbol: 'ha', toBase: 10000 },
      { id: 'km2', label: 'Square kilometre', symbol: 'km2', toBase: 1_000_000 },
      { id: 'in2', label: 'Square inch', symbol: 'in2', toBase: 0.00064516 },
      { id: 'ft2', label: 'Square foot', symbol: 'ft2', toBase: 0.09290304 },
      { id: 'yd2', label: 'Square yard', symbol: 'yd2', toBase: 0.83612736 },
      { id: 'ac', label: 'Acre', symbol: 'ac', toBase: 4046.8564224 },
      { id: 'mi2', label: 'Square mile', symbol: 'mi2', toBase: 2_589_988.110336 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatArea(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function useAreaConverter(): UseAreaConverterReturn {
  return useUnitConverter({
    sets: AREA_UNITS,
    defaultUnitId: 'm2',
    format: formatArea,
  });
}
