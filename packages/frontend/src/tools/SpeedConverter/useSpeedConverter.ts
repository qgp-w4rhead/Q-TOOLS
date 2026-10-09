/**
 * useSpeedConverter - composable + unit definitions for the speed converter.
 *
 * Converts between speed units using metres per second as the base unit.
 * Supports: m/s, km/h, mph, knots, ft/s, Mach (at sea level, 15 °C).
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertSpeed } from '@/composables/useUnitConverter';

export type UseSpeedConverterReturn = UseUnitConverterReturn;

export const SPEED_UNITS: UnitSet[] = [
  {
    id: 'speed',
    label: 'Speed',
    units: [
      { id: 'mps', label: 'Metres per second', symbol: '', toBase: 1 },
      { id: 'kmh', label: 'Kilometres per hour', symbol: '', toBase: 1 / 3.6 },
      { id: 'mph', label: 'Miles per hour', symbol: '', toBase: 0.44704 },
      { id: 'kn', label: 'Knots', symbol: '', toBase: 0.514444 },
      { id: 'fts', label: 'Feet per second', symbol: '', toBase: 0.3048 },
      { id: 'mach', label: 'Mach (sea level)', symbol: '', toBase: 340.29 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatSpeed(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function useSpeedConverter(): UseSpeedConverterReturn {
  return useUnitConverter({
    sets: SPEED_UNITS,
    defaultUnitId: 'kmh',
    defaultValue: '100',
    format: formatSpeed,
  });
}
