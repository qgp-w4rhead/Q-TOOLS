/**
 * useTimeUnitConverter - composable + unit definitions for the time unit
 * converter.
 *
 * Converts between time units using seconds as the base unit.
 * Supports: ms, s, min, h, day, week, month, year.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export { convertUnit as convertTimeUnit } from '@/composables/useUnitConverter';

export type UseTimeUnitConverterReturn = UseUnitConverterReturn;

export const TIME_UNITS: UnitSet[] = [
  {
    id: 'time',
    label: 'Time',
    units: [
      { id: 'ms', label: 'Milliseconds', symbol: '', toBase: 0.001 },
      { id: 's', label: 'Seconds', symbol: '', toBase: 1 },
      { id: 'min', label: 'Minutes', symbol: '', toBase: 60 },
      { id: 'h', label: 'Hours', symbol: '', toBase: 3600 },
      { id: 'day', label: 'Days', symbol: '', toBase: 86400 },
      { id: 'week', label: 'Weeks', symbol: '', toBase: 604800 },
      // Average: 365.25 / 12 * 86400
      { id: 'month', label: 'Months', symbol: '', toBase: 2629800 },
      // Average: 365.25 * 86400
      { id: 'year', label: 'Years', symbol: '', toBase: 31557600 },
    ],
  },
];

/**
 * Format a number for display: trims trailing zeros, keeps up to 6 decimal
 * places, returns '-' for non-finite values.
 */
export function formatTime(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '0';
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

export function useTimeUnitConverter(): UseTimeUnitConverterReturn {
  return useUnitConverter({
    sets: TIME_UNITS,
    defaultUnitId: 'h',
    format: formatTime,
  });
}
