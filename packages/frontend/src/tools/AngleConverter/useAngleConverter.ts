/**
 * useAngleConverter - composable + unit definitions for the angle converter.
 *
 * Converts between angle units using degrees as the base unit.
 * Supports: deg, rad, grad, turn, arcmin, arcsec.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertAngle } from '@/composables/useUnitConverter';

export type UseAngleConverterReturn = UseUnitConverterReturn;

export const ANGLE_UNITS: UnitSet[] = [
  {
    id: 'angle',
    label: 'Angle',
    units: [
      { id: 'deg', label: 'Degree', symbol: 'deg', toBase: 1 },
      { id: 'rad', label: 'Radian', symbol: 'rad', toBase: 180 / Math.PI },
      { id: 'grad', label: 'Gradian', symbol: 'grad', toBase: 0.9 },
      { id: 'turn', label: 'Turn', symbol: 'turn', toBase: 360 },
      { id: 'arcmin', label: 'Arcminute', symbol: 'arcmin', toBase: 1 / 60 },
      { id: 'arcsec', label: 'Arcsecond', symbol: 'arcsec', toBase: 1 / 3600 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 8 decimal
 * places, returns '-' for non-finite values.
 */
export function formatAngle(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(8);
  return fixed.replace(/\.?0+$/, '');
}

export function useAngleConverter(): UseAngleConverterReturn {
  return useUnitConverter({
    sets: ANGLE_UNITS,
    defaultUnitId: 'deg',
    defaultValue: '90',
    format: formatAngle,
  });
}
