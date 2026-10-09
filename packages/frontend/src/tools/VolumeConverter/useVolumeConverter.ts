/**
 * useVolumeConverter - composable + unit definitions for the volume converter.
 *
 * Converts between metric and imperial volume units using litres as the
 * base unit. Supports: mL, L, m³, cm³, gal US, gal UK, qt, pt, cup, fl oz US.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertVolume } from '@/composables/useUnitConverter';

export type UseVolumeConverterReturn = UseUnitConverterReturn;

export const VOLUME_UNITS: UnitSet[] = [
  {
    id: 'volume',
    label: 'Volume',
    units: [
      { id: 'mL', label: 'Millilitre', symbol: 'mL', toBase: 0.001 },
      { id: 'L', label: 'Litre', symbol: 'L', toBase: 1 },
      { id: 'm3', label: 'Cubic metre', symbol: 'm3', toBase: 1000 },
      { id: 'cm3', label: 'Cubic centimetre', symbol: 'cm3', toBase: 0.001 },
      { id: 'gal_us', label: 'Gallon (US)', symbol: 'gal_us', toBase: 3.785411784 },
      { id: 'gal_uk', label: 'Gallon (UK)', symbol: 'gal_uk', toBase: 4.54609 },
      { id: 'qt', label: 'Quart (US)', symbol: 'qt', toBase: 0.946352946 },
      { id: 'pt', label: 'Pint (US)', symbol: 'pt', toBase: 0.473176473 },
      { id: 'cup', label: 'Cup (US)', symbol: 'cup', toBase: 0.2365882365 },
      { id: 'floz_us', label: 'Fluid ounce (US)', symbol: 'floz_us', toBase: 0.0295735295625 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatVolume(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function useVolumeConverter(): UseVolumeConverterReturn {
  return useUnitConverter({
    sets: VOLUME_UNITS,
    defaultUnitId: 'L',
    format: formatVolume,
  });
}
