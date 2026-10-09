/**
 * useDataRateConverter - composable + unit definitions for the data rate
 * converter.
 *
 * Converts between data rate units using bits per second (bps) as the base
 * unit: bps, kbps, Mbps, Gbps, Tbps, B/s, KB/s, MB/s, GB/s, KiB/s, MiB/s,
 * GiB/s, and baud. Includes a transfer-time helper: given a file size and
 * the current rate, computes the download duration.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import {
  useUnitConverter,
  findUnit,
  formatUnitValue,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export {
  convertUnit as convertDataRate,
  formatUnitValue as formatDataRate,
} from '@/composables/useUnitConverter';

export interface UseDataRateConverterReturn extends UseUnitConverterReturn {
  /** File size for the transfer-time helper (string input). */
  fileSize: Ref<string>;
  /** Unit id of the file size (from FILE_SIZE_UNITS). */
  fileSizeUnit: Ref<string>;
  /** Formatted transfer duration, or '-' when not computable. */
  transferTime: ComputedRef<string>;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const DATA_RATE_UNITS: UnitSet[] = [
  {
    id: 'rate',
    label: 'Data rate',
    units: [
      { id: 'bps', label: 'Bit per second', symbol: 'bps', toBase: 1 },
      { id: 'kbps', label: 'Kilobit per second', symbol: 'kbps', toBase: 1e3 },
      { id: 'mbps', label: 'Megabit per second', symbol: 'Mbps', toBase: 1e6 },
      { id: 'gbps', label: 'Gigabit per second', symbol: 'Gbps', toBase: 1e9 },
      { id: 'tbps', label: 'Terabit per second', symbol: 'Tbps', toBase: 1e12 },
      { id: 'B_s', label: 'Byte per second', symbol: 'B/s', toBase: 8 },
      { id: 'KB_s', label: 'Kilobyte per second', symbol: 'KB/s', toBase: 8e3 },
      { id: 'MB_s', label: 'Megabyte per second', symbol: 'MB/s', toBase: 8e6 },
      { id: 'GB_s', label: 'Gigabyte per second', symbol: 'GB/s', toBase: 8e9 },
      { id: 'KiB_s', label: 'Kibibyte per second', symbol: 'KiB/s', toBase: 8192 },
      { id: 'MiB_s', label: 'Mebibyte per second', symbol: 'MiB/s', toBase: 8 * 1048576 },
      { id: 'GiB_s', label: 'Gibibyte per second', symbol: 'GiB/s', toBase: 8 * 1073741824 },
      { id: 'baud', label: 'Baud', symbol: 'Bd', toBase: 1 },
    ],
  },
];

/** File-size units for the transfer-time helper, factor to bytes. */
export const FILE_SIZE_UNITS: { id: string; label: string; toBytes: number }[] = [
  { id: 'B', label: 'Bytes', toBytes: 1 },
  { id: 'KB', label: 'Kilobytes (KB)', toBytes: 1e3 },
  { id: 'MB', label: 'Megabytes (MB)', toBytes: 1e6 },
  { id: 'GB', label: 'Gigabytes (GB)', toBytes: 1e9 },
  { id: 'TB', label: 'Terabytes (TB)', toBytes: 1e12 },
  { id: 'KiB', label: 'Kibibytes (KiB)', toBytes: 1024 },
  { id: 'MiB', label: 'Mebibytes (MiB)', toBytes: 1048576 },
  { id: 'GiB', label: 'Gibibytes (GiB)', toBytes: 1073741824 },
  { id: 'TiB', label: 'Tebibytes (TiB)', toBytes: 1099511627776 },
];

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Compute transfer time in seconds for `bytes` at `bitsPerSecond`.
 * Returns `null` when inputs are not finite or non-positive.
 */
export function transferSeconds(bytes: number, bitsPerSecond: number): number | null {
  if (!Number.isFinite(bytes) || !Number.isFinite(bitsPerSecond)) return null;
  if (bytes < 0 || bitsPerSecond <= 0) return null;
  return (bytes * 8) / bitsPerSecond;
}

/** Format a duration in seconds as a compact human-readable string. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-';
  if (seconds === 0) return '0 s';
  if (seconds < 1e-3) return `${formatUnitValue(seconds * 1e6)} µs`;
  if (seconds < 1) return `${formatUnitValue(seconds * 1e3)} ms`;
  if (seconds < 60) return `${formatUnitValue(seconds)} s`;
  const parts: string[] = [];
  let rest = Math.round(seconds);
  const days = Math.floor(rest / 86400);
  rest -= days * 86400;
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const mins = Math.floor(rest / 60);
  const secs = rest - mins * 60;
  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (mins) parts.push(`${mins} min`);
  if (secs || parts.length === 0) parts.push(`${secs} s`);
  return parts.join(' ');
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useDataRateConverter(): UseDataRateConverterReturn {
  const base = useUnitConverter({
    sets: DATA_RATE_UNITS,
    defaultUnitId: 'mbps',
  });

  const fileSize = ref<string>('100');
  const fileSizeUnit = ref<string>('MB');

  const transferTime = computed<string>(() => {
    const size = Number(fileSize.value);
    const sizeUnit = FILE_SIZE_UNITS.find((u) => u.id === fileSizeUnit.value);
    const rateUnit = findUnit(base.units.value, base.inputUnit.value);
    const rate = Number(base.inputValue.value);
    if (!sizeUnit || !rateUnit || !Number.isFinite(size) || !Number.isFinite(rate)) {
      return '-';
    }
    const secs = transferSeconds(size * sizeUnit.toBytes, rate * rateUnit.toBase);
    return secs === null ? '-' : formatDuration(secs);
  });

  // Keep transfer time reactive to file-size inputs (computed covers it).
  watch([fileSize, fileSizeUnit], () => {
    /* computed re-evaluates automatically; watch kept for embed output parity */
  });

  return {
    ...base,
    fileSize,
    fileSizeUnit,
    transferTime,
  };
}
